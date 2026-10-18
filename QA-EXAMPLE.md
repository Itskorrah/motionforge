# Real QA run: 4 scenes, 192 frames, 2 passes

**Result:** Technical gate passed on every scene in pass 2. This is not a vision-model artistic 8/10 certification; no API key was supplied and no external vision API was invoked.

| Scene | Pass 1 technical | Initial issue | Correction | Pass 2 technical |
|---|---:|---|---|---:|
| 1 — Physics in Motion | 7/10 | Important art started offscreen | Pre-roll closed-form springs 0.22 s | 10/10 |
| 2 — True Springs | 7/10 | Headline largely outside opening frame | Pre-roll 0.22 s | 10/10 |
| 3 — Sound from Code | 7/10 | Title and audio panel started offscreen | Pre-roll 0.22 s | 10/10 |
| 4 — Every Cut on the Beat | 7/10 | Main headline and circle started offscreen | Pre-roll 0.22 s; move tiny footer to avoid bar overlap | 10/10 |

Both passes were rendered with Chrome and analysed from their actual captured PNG frames. A separate full-resolution final render was then generated at 1280 × 720, 30 FPS, 120 BPM, 8 seconds (240 PNG frames) with H.264 video and AAC stereo. This final render was also decoded and checked; each of the four scenes passed the objective gate at 10/10 with no detected blank frames, long freezes, insufficient detail or weak scene openings. The output includes no subjective visual model grade.

`polished-tuning.json` reproduces the accepted scene timing with `node render.mjs --tuning polished-tuning.json`. Run `node qa-loop.mjs --vision` with a separately configured API key for multimodal 8/10 scene approvals and bounded automatic revisions.
