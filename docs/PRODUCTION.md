# Practical production workflow

1. Start with a brief: goal, audience, emotional tone, hook, 3–5 key statements and preferred aspect ratio.
2. Use `studio.mjs init` (optional `--ai`) to create a `project.json` first draft; **edit the result for factual accuracy, spelling, visual hierarchy and story flow**. Prompts do not guarantee good scripts.
3. Run `studio.mjs plan` to review all beat/frame cut boundaries.
4. Run `studio.mjs render ... --preview` for an inexpensive draft. Inspect the MP4 with sound.
5. Run `studio.mjs produce ... --preview --max-passes 3`. Technical inspector sees every frame and creates shot storyboards; optional paid vision reviewer provides subjective feedback.
6. If the QA report shows `threshold_not_met`, manually fix difficult design/content problems. The engine will not fabricate quality or retry indefinitely.
7. Render full resolution by removing `--preview`, check audio loudness on actual devices, and approve before publishing. Preserve QA evidence with the delivery.

**Content-safe guidance:** do not invent statistics or quotes from a brief. Use original/appropriately licensed images and audio when future asset import is added; do not imply that all sound can be generated without rights concerns for external music. Do not automatically publish to social media without explicit authorisation.

## Examples

```
node studio.mjs init --title "Three ideas" --prompt "One strong hook. Point one. Point two. Final takeaway." --format vertical --shots 4 --out projects/three-ideas/project.json
node studio.mjs render projects/three-ideas/project.json --preview --out exports/draft.mp4
node studio.mjs produce projects/three-ideas/project.json --max-passes 2 --out exports/final.mp4
```

`--vision` requires OpenAI API key and uses separate billing. `--max-passes` sets a strict upper bound (1–8); use `--min-score 8` for per-shot acceptance. The score comes from a multimodal model when enabled, otherwise only technical checks are available.

## Cost and capacity

Local rendering uses your CPU/RAM/disk and Chromium process; API-free default costs no per-frame inference. Optional AI script and visual reviews incur API charges. GitHub Actions runners may consume paid or free minutes depending on billing/usage. High-res and long sequences scale roughly with PNG count × frame size; use preview and 2–4 shots first.
