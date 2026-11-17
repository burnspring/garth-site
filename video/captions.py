#!/usr/bin/env python3
"""Write the tour's captions and transcript from what the take was built from.

    python3 -I captions.py   # after build.sh; writes out/garth-tour.vtt
                             # and out/garth-tour-transcript.txt

Each scene's narration starts LEAD seconds into the scene (capture.mjs) and
lasts as long as its audio; web/manifest.json is where the take put each scene.
A scene's text is split at sentences and given time in proportion to length, so
no cue is longer than two short lines.
"""
import json, os, re

here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)
manifest = json.load(open("web/manifest.json"))
lines = dict(l.rstrip("\n").split("\t", 1) for l in open("narration.tsv") if "\t" in l)

def dur(i):  # 16 kHz mono 16-bit, as capture.mjs reads it
    return os.path.getsize(f"audio/{i}.pcm") / 32000

def stamp(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"

def chunks(text, limit=84):
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+", text.strip()):
        cur = ""
        for w in sentence.split():
            if cur and len(cur) + 1 + len(w) > limit:
                out.append(cur); cur = w
            else:
                cur = f"{cur} {w}".strip()
        if cur:
            out.append(cur)
    return out

cues, transcript = [], []
for scene in manifest["scenes"]:
    i = scene["id"]
    if i not in lines:
        continue
    text = lines[i].replace("getgarth dot com", "getgarth.com")
    transcript.append(text)
    start, length = scene["start"] + scene["lead"], dur(i)
    parts = chunks(text)
    total = sum(len(p) for p in parts)
    t = start
    for p in parts:
        d = length * len(p) / total
        cues.append((t, t + d, p))
        t += d

os.makedirs("out", exist_ok=True)
with open("out/garth-tour.vtt", "w") as f:
    f.write("WEBVTT\n\n")
    for n, (a, b, p) in enumerate(cues, 1):
        f.write(f"{n}\n{stamp(a)} --> {stamp(b)}\n{p}\n\n")
with open("out/garth-tour-transcript.txt", "w") as f:
    f.write("Garth in two minutes — transcript\n\n" + "\n\n".join(transcript) + "\n")
print(f"wrote {len(cues)} cues and the transcript")
