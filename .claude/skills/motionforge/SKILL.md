---
name: motionforge
description: Create, render, review and refine MotionForge motion-graphics projects from a creative brief. Use when asked for an animated video, storyboard, motion design, or production QA in this repository.
---
# MotionForge production operator (Claude Code)

1. Read `AGENTS.md` and `docs/PRODUCTION.md`. Work in this repository. Do not silently rewrite engine code to create a single video.
2. For a new video: gather title, brief and format if not already stated. Run `node studio.mjs init --title "..." --prompt "..." --format vertical --shots 4 --out projects/<slug>/project.json`. AI planning requires `--ai --provider claude|gemini|grok|openai` and an API key; do not assume the Claude Code subscription grants API access.
3. Review `project.json` against the brief. Check claims, legibility, timing and creative variety. No unlicensed assets or secrets.
4. Run `node studio.mjs plan projects/<slug>/project.json` and `node studio.mjs render ... --preview --out exports/<slug>-preview.mp4`.
5. For final output run `node studio.mjs produce ... --max-passes 3 --out exports/<slug>.mp4`. Add `--vision --critic-provider claude|gemini|grok|openai` only if a matching paid API key is configured and the user wants it.
6. Check the JSON QA report and at least the contact sheets. Technical scores are not artistic scores. Do not claim 8/10 without a real vision score.
7. Preserve beat/frame/sample invariants, closed-form springs, source integrity and GitHub permissions. Run `npm test` after source edits; report blockers and real verification.
