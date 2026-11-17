#!/usr/bin/env bash
# Rebuild the tour video from narration.tsv and the scenes in capture.mjs.
#
#   video/build.sh            narration → capture on a demo Garth → render → site
#   video/build.sh voice [ID] only regenerate the narration audio (AWS Polly), or one line
#   video/build.sh scene 04   capture one scene (by id) and stop, for a look
#   video/build.sh record     render again from the frames already captured (no Garth needed)
#
# Needs: aws (Polly), node ≥ 22, google-chrome, ffmpeg, python3, and a demo
# Garth (README.md): GARTH_URL (default http://127.0.0.1:8094) and
# GARTH_PROJECT, the id of the project the session is filmed on.
# Writes out/garth-tour.{mp4,jpg,vtt} and the transcript, then copies them into
# ../public/video with ../scripts/sync-video.sh.
set -euo pipefail
cd "$(dirname "$0")"
VOICE="${VOICE:-Ruth}"
mkdir -p audio out

# say turns a narration line into SSML, with words the voice gets wrong
# spoken through an alias (<sub> works on generative voices; <phoneme> only
# partly). The captions keep the line as written.
say() {
  local t="${1//&/&amp;}"; t="${t//</&lt;}"; t="${t//>/&gt;}"
  t="${t//Kubernetes/<sub alias=\"koo-ber-net-eez\">Kubernetes</sub>}"
  printf '<speak>%s</speak>' "$t"
}

# voice [ID]: every line, or only line ID.
voice() {
  while IFS=$'\t' read -r id text; do
    [ -z "$id" ] && continue
    [ -n "${1:-}" ] && [ "$id" != "$1" ] && continue
    ssml="$(say "$text")"
    aws polly synthesize-speech --engine generative --voice-id "$VOICE" --output-format mp3 --sample-rate 24000 --text-type ssml --text "$ssml" "audio/$id.mp3" >/dev/null
    # PCM only to measure the line: 16 kHz, 16-bit mono = 32000 bytes a second.
    aws polly synthesize-speech --engine generative --voice-id "$VOICE" --output-format pcm --sample-rate 16000 --text-type ssml --text "$ssml" "audio/$id.pcm" >/dev/null
    printf '%s %ss\n' "$id" "$(python3 -c "import os;print(round(os.path.getsize('audio/$id.pcm')/32000,1))")"
  done < narration.tsv
}

[ "${1:-}" = voice ] && { voice "${2:-}"; exit 0; }
ls audio/*.pcm >/dev/null 2>&1 || voice
ln -sfn ../audio web/audio

# Chrome and the frame server only for capturing; record renders offline.
if [ "${1:-}" != record ]; then
  PROFILE="$(mktemp -d)"
  python3 -m http.server 8765 --bind 127.0.0.1 --directory web >/dev/null 2>&1 & HTTP=$!
  google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling \
    --disable-renderer-backgrounding --remote-debugging-port=9222 --user-data-dir="$PROFILE" \
    --window-size=1280,720 about:blank >/dev/null 2>&1 & CHROME=$!
  trap 'kill $HTTP $CHROME 2>/dev/null; rm -rf "$PROFILE"' EXIT
  for _ in $(seq 60); do curl -s localhost:9222/json/version >/dev/null && break; sleep 1; done
fi

if [ "${1:-}" = scene ]; then node capture.mjs "$2"; echo "frames in web/frames"; exit 0; fi
[ "${1:-}" = record ] || node capture.mjs
python3 -I render.py  # offline: frames at their capture times, fades, narration; load-proof
ffmpeg -hide_banner -loglevel error -y -ss 2.5 -i out/garth-tour.mp4 -frames:v 1 \
  -vf scale=1600:-2 -q:v 3 out/garth-tour.jpg
python3 -I captions.py
ffprobe -v error -show_entries format=duration,size -of compact out/garth-tour.mp4
../scripts/sync-video.sh out
