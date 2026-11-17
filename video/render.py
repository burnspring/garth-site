"""Render out/garth-tour.mp4 from the captured frames and the narration, offline.

record.mjs played the frames in Chrome in real time and recorded the screen;
on a busy machine it fell behind and the take came out stretched (2:52 for
1:52 of content). This does the same thing with ffmpeg, from the timestamps
in web/manifest.json, so the result doesn't depend on the machine's load:

- each frame is shown from its own capture time until the next frame's;
- at each scene change the outgoing picture fades out over 0.45 s on top of
  the new scene (as the recorder drew it);
- each scene's narration starts at the scene's start plus its lead.

Run from video/: python3 -I render.py
"""

import json
import os
import subprocess

FADE = 0.45
FPS = 30

m = json.load(open("web/manifest.json"))
frames, scenes, total = m["frames"], m["scenes"], m["total"]
os.makedirs("out", exist_ok=True)

# The frames as a concat list: each one lasts until the next is captured,
# and the last holds to the end.
with open("out/frames.txt", "w") as f:
    for i, fr in enumerate(frames):
        end = frames[i + 1]["t"] if i + 1 < len(frames) else total
        f.write(f"file '../web/frames/{fr['f']}'\nduration {max(end - fr['t'], 0.001):.6f}\n")
    f.write(f"file '../web/frames/{frames[-1]['f']}'\n")


def shown_at(t):
    """The frame on screen just before time t."""
    k = 0
    for i, fr in enumerate(frames):
        if fr["t"] < t:
            k = i
    return frames[k]["f"]


args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", "out/frames.txt"]
# Inputs 1..n: the outgoing picture at each scene change.
cuts = [s["start"] for s in scenes[1:]]
for t in cuts:
    args += ["-loop", "1", "-t", f"{FADE}", "-framerate", f"{FPS}", "-i", f"web/frames/{shown_at(t)}"]
# The narration first, on its own: each line at its scene's start plus lead.
aargs = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
for s in scenes:
    aargs += ["-i", f"audio/{s['id']}.mp3"]
afc = []
for j, s in enumerate(scenes):
    ms = int(round((s["start"] + s["lead"]) * 1000))
    afc.append(f"[{j}:a]aresample=48000,adelay={ms}|{ms}[a{j}]")
afc.append("".join(f"[a{j}]" for j in range(len(scenes)))
           + f"amix=inputs={len(scenes)}:normalize=0:dropout_transition=0,apad,atrim=duration={total:.3f}[aout]")
aargs += ["-filter_complex", ";".join(afc), "-map", "[aout]", "out/narration.wav"]
subprocess.run(aargs, check=True)

fc = [f"[0:v]fps={FPS},scale=1920:1080,format=yuva420p,trim=duration={total:.3f}[v0]"]
for i, t in enumerate(cuts, start=1):
    fc.append(f"[{i}:v]scale=1920:1080,format=yuva420p,fade=t=out:st=0:d={FADE}:alpha=1,setpts=PTS+{t:.4f}/TB[f{i}]")
    fc.append(f"[v{i - 1}][f{i}]overlay=eof_action=pass[v{i}]")
fc.append(f"[v{len(cuts)}]format=yuv420p[vout]")
narration = 1 + len(cuts)
args += ["-i", "out/narration.wav"]

args += ["-filter_complex", ";".join(fc), "-map", "[vout]", "-map", f"{narration}:a",
         "-af", "loudnorm=I=-16:TP=-1.5,aresample=48000",
         "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-pix_fmt", "yuv420p", "-r", f"{FPS}",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-t", f"{total:.3f}",
         "out/garth-tour.mp4"]
subprocess.run(args, check=True)
os.remove("out/frames.txt")
os.remove("out/narration.wav")
print(f"rendered out/garth-tour.mp4: {total:.1f}s, {len(scenes)} scenes, {len(frames)} frames")
