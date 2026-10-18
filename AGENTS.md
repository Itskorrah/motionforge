# Coding agent instructions for MotionForge

This is a reproducible video studio, not a website demo. Preserve the existing raw engine as a compatibility path.

## Non-negotiables

- Exact frame/sample beat alignment (`timeline.mjs`), never silent rounding.
- Physical spring equations for element motion. Never add CSS animation/tweens for effects.
- Render every frame in Chrome and test both MP4 streams; do not claim visual quality from static code inspection alone.
- For QA, distinguish objective checks from optional model-judged artistic scores; keep bounded retries and deterministic tuning.
- Treat project fields and AI output as untrusted structured data. Never execute model-generated scripts or insert user text via `innerHTML`.
- Keep API keys out of commits; no network required for core production.
- Respect user's project edits and existing branches; use PRs for substantial improvements.

## Before shipping

Run `npm test`, `node studio.mjs plan projects/demo/project.json`, and at least one local `--preview` render for changes touching scene/audio/render code. Inspect 9:16 and 16:9 frames, run QA loop and confirm no hidden dead periods. Record tests actually performed. Never claim remote CI pass unless GitHub shows it.

## Optional Evolve

The project is compatible with `Itskorrah/evolve`, a separate agent skill pack. See `docs/EVOLVE.md`. Do not copy the Evolve repository into the studio. Installed `.agents/skills` and `.evolve` are ignored.
