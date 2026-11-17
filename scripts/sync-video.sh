#!/usr/bin/env bash
# Copy the tour into the site from wherever it was built:
#
#   scripts/sync-video.sh <dir>
#
# <dir> holds garth-tour.mp4 and its poster, garth-tour.jpg, and may hold
# captions (garth-tour.vtt) and a transcript (garth-tour-transcript.txt). The
# home page plays the video once the mp4 is here and offers the captions and
# transcript when they are; without the mp4 it says the tour is being filmed.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
src="${1:?usage: scripts/sync-video.sh <dir holding garth-tour.mp4>}"
mkdir -p "$here/public/video"
for f in garth-tour.mp4 garth-tour.jpg; do
  cp "$src/$f" "$here/public/video/$f"
done
for f in garth-tour.vtt garth-tour-transcript.txt; do
  if [ -f "$src/$f" ]; then cp "$src/$f" "$here/public/video/$f"; else rm -f "$here/public/video/$f"; fi
done
echo "synced the tour from $src"
