# Evolve integration review

Source reviewed: https://github.com/Itskorrah/evolve (`main` README, six skills, package architecture).

Evolve is a **portable agent skill pack** with a coordinator and five specialists: audit, build, design, verify and ship. It tracks baselines, bounded tasks, evidence, rechecks and delivery permissions. This maps naturally to MotionForge software-engineering goals (new motifs, tests, renderer performance, QA, CLI UX). It is not a video synthesiser, a model endpoint, nor a scheduled autonomous worker, and installing it does not grant credentials.

**Decision:** keep Evolve independently maintained, install into this project's Codex agent skill directory when wanted. Do not fork/copy the skill pack or make video output depend on it. The studio runtime must remain usable without Evolve.

Local install (Python 3.10+, Git): `bash scripts/install-evolve.sh`. The script clones Evolve into a temporary directory then invokes its official project-scoped Codex installer. The installed skill folders and `.evolve` working state are gitignored. Evolve can also be installed to other supported hosts using its README.

Suggested Codex task:

> Use $evolve to audit MotionForge. Check spring dynamics, exact frame/sample boundaries, portrait text layout, audio/video output, failed-render cleanup, all-frame QA false positives and CI. Rank verified findings by impact. Implement only evidenced improvements, run real end-to-end rendering tests and prepare a PR. Do not edit Evolve's own repo, and do not claim subjective visual 8/10 without a model review. Preserve existing projects and user changes.

For an unattended overnight development cycle, a separate agent host/scheduler and explicit authorisation are required. Evolve's continuation state is not a background daemon. Set merge/delivery permission intentionally.
