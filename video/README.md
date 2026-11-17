# The tour video

The home page's two-minute tour (`#tour`), built the way Toft's is: narration
from AWS Polly, frames captured from a running Garth over the Chrome DevTools
protocol, then rendered with the narration by ffmpeg from each frame's capture
time (offline, so a busy machine can't stretch the take).

```
narration.tsv   one line per scene: id <TAB> what is said
capture.mjs     the scenes: what each one opens, points at, types and clicks
render.py       web/frames + audio/ into out/garth-tour.mp4: timing, fades, narration
captions.py     the .vtt and the transcript, timed from the take
build.sh        all of it, then scripts/sync-video.sh into public/video/
```

## The demo install it films

Never a real install: the tour shows people, projects and spend. It films a
Garth started on its own fresh data directory, on loopback, with development
sign-in on (so the demo people sign in by name), against a cluster that has
the session image and warm pool. On the k3s box only one control plane can hold
the pod listener, so a take means stopping the live Garth: **trygarth.dev is
down until it is started again**. Agree a time with whoever uses it first, and
capture only — `video/build.sh record` (re-voicing, re-rendering) needs no
Garth at all:

```bash
cd ~/toft/garth
GARTH_DATA=/path/to/fresh GARTH_UI_ADDR=127.0.0.1:8094 GARTH_DEV_SIGN_IN=1 \
  KUBECONFIG=$HOME/.kube/k3s.yaml bin/garth
```

The demo data, made through the API before the take:

- people `maya.chen` (an administrator, $50 a month), `sam.okafor` and
  `lena.ortiz` ($30 each) — made administrator through the local admin;
- projects from the starters: `orders-service` (python, maya's, shared with
  sam and lena; the session is filmed here), `billing-dashboard` (node, sam's),
  `inventory-sync` (go, lena's), `forecast-api` (r, maya's);
- a short real session each for sam and lena first, so Costs has spend and
  Live sessions isn't empty.

Then:

```bash
GARTH_PROJECT=<orders-service id> video/build.sh
video/build.sh scene 06      # one scene, for a look at web/frames
video/build.sh voice 11      # re-voice one line; keep it no longer than before
video/build.sh record        # render again from the frames on disk
```

The filmed session is real: Claude Haiku 4.5 on Bedrock writes the change, so
a take costs a few cents and the agent's words differ each time. Look at frames
from the result before publishing (`ffmpeg -ss <t> -i out/garth-tour.mp4
-frames:v 1 f.jpg`).

Afterwards, end the demo sessions and stop the demo Garth, and start the live
one again.
