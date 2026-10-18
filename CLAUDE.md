# Claude Code — MotionForge

See [AGENTS.md](AGENTS.md) for non-negotiables and verification instructions. This project is a local-first CLI studio: never treat a screenshot or technical score as a substitute for checking the output video. For end-to-end production, invoke the project skill `/motionforge` or follow `docs/PRODUCTION.md`.

- Test: `npm test`
- Plan: `node studio.mjs plan projects/demo/project.json`
- Render: `node studio.mjs render projects/demo/project.json --preview --out exports/demo.mp4`
- Critique: `node studio.mjs produce projects/demo/project.json --preview --out exports/polished.mp4`
- Providers: `node studio.mjs providers`

Provider API keys are independent of Claude Code subscriptions. Set `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY` or `OPENAI_API_KEY` only in local environment/CI secrets. Never echo credentials, copy private assets to model services without authorisation or commit secrets. Use Evolve only as a development-time helper.
