# MotionForge — Codex setup and run

## Copy into Codex

```text
Work in my currently open Codex project, using https://github.com/Itskorrah/motionforge as the upstream reference/tool. Read the current README, AGENTS.md (if present), actual CLI/skill files and relevant project instructions. Inspect existing checkout and preserve user data before doing anything.

Use a reviewed MotionForge checkout, read `AGENTS.md`, `docs/PROVIDERS.md` and the `$motionforge` skill entry point if this host supports it. Verify the required Node.js, Chrome/Chromium and FFmpeg tools, then run `npm test`, plan the bundled `projects/demo/project.json` with `node studio.mjs plan`, and render a short offline preview using the documented CLI. Inspect actual generated frames, audio sync, playback and QA outputs. If the user provided a creative brief, initialise and produce a bounded original project with an improved critique/iteration cycle; otherwise execute and verify the offline demo and ask for the creative brief to proceed.

Preserve physically modelled springs, exact frame/sample alignment, untrusted input controls and raw renderer compatibility. No paid model-provider calls without explicit user permission and configured credentials; Codex/Claude subscriptions are not API keys. Subjective scores do not certify aesthetic quality.

Follow the delivery and safety policy below. State all actual local verification and Git outcomes.
```

## Verification and Git authorisation

1. Begin with `git status --short --branch`, remote checks and the target project's agent instructions. Do not reset, clean, force-push, overwrite local work or modify secrets. Review external code before running install commands. Prefer scoped files and least-privileged setup.
2. Carry out the actual user-authorised workflow, not just a plan. Run relevant local tests after each implementation step, inspect real outputs where practical, and distinguish unavailable tests from passes. GitHub Actions minutes may be exhausted; do not dispatch or rerun hosted workflows merely to satisfy this prompt.
3. For verified, scoped source changes, the copied prompt authorises a feature-branch commit, push, PR and **merge where permitted**, without another routine approval. Preserve branch protections, required reviews and security safeguards; no force push, known-critical-defect merge, remote deployment, external publishing, billing or unapproved third-party access.
4. Report what was installed/reused, what actually ran, outputs/evidence, changes, checks, blocker limitations and exact PR/merge result. A README claim is not proof that an executable path works.
