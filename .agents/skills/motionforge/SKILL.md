---
name: motionforge
description: Produce, inspect and improve video content with the MotionForge studio CLI, spring physics, beat-locking and visual QA.
---
# MotionForge operator (Codex)

Follow `AGENTS.md` and `docs/PRODUCTION.md`. For each new video, create a separate `projects/<slug>/project.json` via `node studio.mjs init`, inspect the text and storyboard, run `node studio.mjs plan`, then a preview render, and finally `node studio.mjs produce`. Run `npm test` after any code changes. Keep all beat/frame/sample alignment exact and springs closed form. Never accept proxy QA as artistic 8/10. Optional `--ai --provider openai|claude|gemini|grok` and `--vision --critic-provider ...` require separate API keys: never assume Codex/Claude Code subscription credentials work as API keys. Deliver validated MP4 and review evidence, not just a textual claim. Use `$evolve` when installed for sustained engineering, not as a dependency of production.
