# MotionForge

**A local-first, code-first motion graphics studio** — plan a video once, compose dynamic Canvas scenes with physically modelled springs, synthesise a sample-aligned soundtrack, capture each exact frame in headless Chrome, export H.264/AAC with FFmpeg, and inspect the result for visual defects. Optional OpenAI, Claude, Gemini or Grok multimodal critics can score each shot and trigger bounded re-renders.

**Status: functional v0.1 foundation, not a turnkey After Effects replacement.** The working UI is a CLI and editable JSON briefs. An interactive timeline editor, licensed asset ingestion, voiceover, captions, remote rendering, and unlimited autonomous production remain future work. Quality scores are subjective when an AI vision critic is used; local technical scores do not certify aesthetic excellence.

## Five-minute start

Requirements: **Node.js 22+**, **Chrome or Chromium**, **FFmpeg** (and optionally Python 3.10+ to install [Evolve](https://github.com/Itskorrah/evolve)). There are **no npm runtime dependencies** or paid services required to render.

```bash
npm test
npm run presets
npm run plan
npm run demo
```

Output: `exports/demo.mp4`. The included example lives at `projects/demo/project.json`. The preview command uses 640×360 to reduce render cost; remove `--preview` when you want full project resolution.

### Make your own project

```bash
node studio.mjs init --title "Why design matters" \
  --prompt "Start with a provocative hook. Reveal the core idea. Show the unexpected benefit. Finish with a memorable call to action." \
  --format vertical --palette violet --shots 4 --out projects/design/project.json

node studio.mjs plan projects/design/project.json
# Edit project.json: review story, claims, captions and brand information.
node studio.mjs render projects/design/project.json --preview --out exports/design-preview.mp4
node studio.mjs produce projects/design/project.json --max-passes 3 --out exports/design-polished.mp4
```

`init` without `--ai` creates a **deterministic first draft** by breaking up your prompt; it is not an intelligent creative director. Edit the brief to make the creative compelling. The production command re-renders only while the technical quality gate needs work and bounded changes are available. A failed technical gate exits non-zero even if the best MP4 has been saved.

For optional AI storyboarding and **true multimodal visual review** across OpenAI, Claude, Gemini and Grok:

```bash
# Set ANTHROPIC_API_KEY in your environment (or use another provider key).
node studio.mjs providers
node studio.mjs init --title "New concept" --prompt "..." --shots 4 \
  --ai --provider claude --out projects/concept/project.json
# Critique with Gemini instead; requires GEMINI_API_KEY.
node studio.mjs produce projects/concept/project.json --vision --critic-provider gemini \
  --min-score 8 --max-passes 3 --out exports/concept.mp4
```

AI calls use the selected provider’s developer API, not consumer ChatGPT/Claude/Gemini/Grok or coding-agent subscription usage; they are optional and billed separately. See [docs/PROVIDERS.md](docs/PROVIDERS.md). No API key means **artistic quality is unverified**, not 8/10. Changes from the vision critic are limited to a safe tuning schema. The program never executes model-generated patches.

## Studio commands

| Command | What it does |
|---|---|
| `node studio.mjs presets` | Show supported formats, palettes, motifs |
| `node studio.mjs providers` | Show available providers, default models and whether the environment has a key |
| `node studio.mjs init ...` | Create a validated new project from a brief; optional `--ai` |
| `node studio.mjs plan PATH` | Display shot count, frame indices, edit times, beat/sample alignment |
| `node studio.mjs render PATH [--preview]` | Render all frames, synthesise audio and export MP4 |
| `node studio.mjs produce PATH [--vision]` | Run render → all-frame technical QA → storyboards → optional vision scoring → bounded revisions |
| `npm test` | Run 16+ tests without Chrome or API costs |

Use `--chrome`, `--ffmpeg` and `--no-sandbox` where necessary. The older raw engine is still available directly (`render.mjs`, `qa-loop.mjs`, `scene.html`) for custom art direction and non-project scenes.

## Creative specification

`project.json` is versioned and validated (see `studio/project.mjs`). Set `format: vertical | landscape | square`, even `width/height`, `fps`, `bpm`, `beatsPerCut`, a brand palette, and 1–12 ordered shots. Each shot has `eyebrow`, `headline`, `caption` and a motif (`orbit`, `cards`, `wave`, `type`). Four beats at 120 BPM and 30 FPS = 60 frames per shot. Shots are exactly beat-aligned — incompatible BPM/FPS/sample combinations fail validation.

The included scene renderer adapts to portrait and landscape framing without CSS animation. The canvas paint is deterministic for any requested frame. Physical movement is described by the closed-form damped oscillator `mass * acceleration + damping * velocity + stiffness * displacement = 0`; no hand-tuned tween curves or browser animation timing.

To build new motifs or scenes, extend `studio/scene.html`; keep `window.renderFrame(...)` deterministic, and use `SpringPhysics.springState` rather than CSS transitions. `render.mjs --scene custom.html` supports a wholly custom Canvas entrypoint, with the physics injection marker `<!-- ENGINE_SPRING_SOURCE -->`.

## The production pipeline

```text
Creative brief or project.json
          │
          ▼
Creative planning (local split or optional paid AI)
          │
          ▼
Validated timeline (frames, beats, PCM sample boundaries)
          │
          ▼
Canvas + exact spring solver → Chrome screenshots → PNG frames
          │                                      │
          │      JS oscillator sound synthesis ──┴→ FFmpeg H.264/AAC MP4
          │                                      │
          ▼                                      ▼
All-frame dead-frame/freeze check       4-frame/shot storyboards
          │                                      │
          └───────────────┬──────────────────────┘
                          ▼
               Optional API vision critique
                          │
                Safe bounded scene tuning
                          │
            Retry (up to --max-passes)
                          ▼
                  MP4 + JSON QA evidence
```

Technical gates include blank frames, long freeze runs, visual detail and scene-opening salience. Sampled storyboards make subjective review possible, but cannot prove every moment is perfect. The quality loop preserves its best attempt and reports failures honestly (`technical_pass_vision_unverified`, `vision_approved`, or `threshold_not_met`).

## GitHub workflows

- `.github/workflows/ci.yml`: test and validate on push/PR; no full video render to conserve Actions minutes.
- `.github/workflows/render.yml`: **manual** Render demo video → QA → upload video and evidence as workflow artifact. Paid vision check requires the selected provider API key as a repository secret. Renderer assumes a hosted runner with Chrome and FFmpeg; the workflow fails visibly if these are missing.

If your GitHub Actions minutes are exhausted, CI and hosted renders cannot start until availability is restored; run `npm test` and the studio locally. Files can still be pushed and inspected on GitHub without Actions.

## Claude Code and Codex

The repository includes project-level skills for both coding agents: Claude Code `/motionforge` via `.claude/skills/motionforge/SKILL.md` and Codex `$motionforge` via `.agents/skills/motionforge/SKILL.md`, plus `CLAUDE.md` and `AGENTS.md`. They operate the same CLI locally; no developer API key is needed unless you explicitly ask the studio to call an AI provider. See [providers guide](docs/PROVIDERS.md).

## Evolve integration

The independent [Itskorrah/evolve](https://github.com/Itskorrah/evolve) agent skill pack helps coding agents audit, enhance and verify MotionForge. It is **a development-time agent workflow, not part of rendering**. Keep it in its own repository; do not vend it into the runtime.

```bash
bash scripts/install-evolve.sh
# Or install from a separate Evolve checkout:
# python3 scripts/install.py install --host codex --project /absolute/path/to/motionforge
```

Then in Codex: `Use $evolve to inspect MotionForge, prioritise measured improvements, implement and test them, and create a reviewed pull request. Preserve the existing project and avoid speculative rewrites.` The agent's tool/model capacity depends on its host; Evolve itself is not an always-running background service. See [docs/EVOLVE.md](docs/EVOLVE.md).

## Architecture and caveats

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stable components and extension boundaries
- [docs/PRODUCTION.md](docs/PRODUCTION.md) — shot planning, QA, delivery and practical workflow
- [docs/PROVIDERS.md](docs/PROVIDERS.md) — Claude, Gemini, Grok and OpenAI integrations, Claude Code and Codex setup
- [docs/EVOLVE.md](docs/EVOLVE.md) — integration rationale and safe agent guidance
- [docs/ROADMAP.md](docs/ROADMAP.md) — remaining work, scope and evidence rules

Audio is an original code-generated rhythm bed, **not** licensed commercial music or natural voiceover. Chrome's available system fonts affect typography. MP4/AAC playback can introduce codec priming, while our source PCM and frame-grid onsets remain mathematically aligned. Video renders are not real-time; long videos/high resolution require disk, memory and capture time. Keep private keys out of repositories, logs and project JSON.

## Licence

MIT. See [LICENSE](LICENSE).
