# AI providers and coding-agent hosts

MotionForge has a **local, deterministic** Chrome/FFmpeg video engine. Optional online models can *plan scene copy* (`init --ai`) or *critique frame contact sheets* (`produce --vision`). No provider is required for rendering or technical QA. AI output is treated as untrusted project/score data and validated before use. There is no automated inter-provider fallback.

| Provider | CLI flag | Environment key | Default model (override with `--model`) |
|---|---|---|---|
| OpenAI | `openai` | `OPENAI_API_KEY` | `gpt-4.1-mini` |
| Anthropic Claude | `claude` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` |
| Google Gemini | `gemini` | `GEMINI_API_KEY` | `gemini-2.5-flash` |
| xAI Grok | `grok` | `XAI_API_KEY` | `grok-4` |

Defaults favour model IDs known to support text and image input, not necessarily the newest or cheapest. Provider availability, APIs and model retirement schedules change; override the model with `--model` (planner) or `--critic-model` (visual reviewer), checking the vendor's model catalogue. `node studio.mjs providers` lists the configured environment variables **without showing their values**.

## Examples

```bash
# Load keys from an ignored local .env file with Node 22+:
cp .env.example .env
# Edit .env and set only the credentials you wish to use.

node --env-file=.env studio.mjs init --title 'Launch' --prompt 'Show why the product matters.' \
  --format vertical --shots 4 --ai --provider claude --out projects/launch/project.json

# Use Gemini as the visual critic, even if Claude planned the video:
node --env-file=.env studio.mjs produce projects/launch/project.json \
  --vision --critic-provider gemini --min-score 8 --max-passes 3 --preview --out exports/launch.mp4

# Grok end-to-end optional AI, with model override:
node --env-file=.env studio.mjs init --title 'Grok concept' --prompt 'Illustrate a bold idea.' \
  --shots 4 --ai --provider grok --model grok-4 --out projects/grok/project.json

# No paid AI keys needed for these:
node studio.mjs init --title 'Local plan' --prompt 'First. Next. Finally.' --out projects/local/project.json
node studio.mjs render projects/local/project.json --preview --out exports/local.mp4
```

`--provider` on `init` selects the planner; `--critic-provider` on `produce` selects the reviewer. The older `qa-loop.mjs --vision --provider ...` command also works. Neither changes the rendering physics. The visual reviewer receives a PNG storyboard and technical metrics; **this transfers the images to the selected provider**. Run without `--vision` for private offline technical review. An 8/10 is a subjective model judgement, not proof of professional quality. The 8/10 loop is bounded to avoid runaway charges.

**API keys are separate from subscriptions.** ChatGPT Plus/Pro, Claude Pro/Max/Claude Code, Google AI Pro/Gemini in consumer apps and Grok subscriptions do not automatically supply credits or authentication for their developer APIs. Purchase/enable API access with the respective provider; set local environment keys or GitHub Actions secrets. Secrets are never required for ordinary video rendering. Do not put keys in `project.json`, prompts or tracked files. Running a prompt through a coding agent's subscription is a different workflow from MotionForge's direct provider API integrations.

### Troubleshooting

- Missing key error: set the specific environment variable or omit `--ai`/`--vision`. `.env` is **not automatically loaded**; use Node's `--env-file=.env` or your shell's environment.
- HTTP 401: wrong or inactive key; HTTP 429: exhausted quota or rate-limited. No automatic retry across providers occurs.
- Model unsupported or retired: select a currently supported model for your provider. Vision requires a model with image understanding.
- Invalid JSON/validation error: provider output was rejected rather than silently rendered or counted as successful visual QA.
- Provider calls cannot be tested live in CI without explicit API credentials and billing. The repository's unit suite instead tests each provider protocol with mocked network responses.

## Claude Code and Codex

The repo includes `CLAUDE.md` and `.claude/skills/motionforge/SKILL.md` for **Claude Code**, and `AGENTS.md` and `.agents/skills/motionforge/SKILL.md` for **Codex**. Open this project folder in either app; Claude Code can invoke `/motionforge`, Codex can invoke `$motionforge` when project skills are enabled. Both drive the same real CLI and tests. The agent itself is not a paid provider API key and no CLI subscription credential is harvested or forwarded.

For sustained development, install [Itskorrah/evolve](https://github.com/Itskorrah/evolve) as a separate project skill pack; it is optional. After cloning MotionForge, run `bash scripts/install-evolve.sh` if you want Evolve loaded in Codex. Evolve installation and MotionForge production are separate.

## API references

- [Anthropic Messages API and image input](https://platform.claude.com/docs/en/build-with-claude/working-with-messages)
- [Google Gemini GenerateContent REST](https://ai.google.dev/api/generate-content) and [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [xAI Grok image understanding](https://docs.x.ai/developers/model-capabilities/images/understanding) and [structured JSON](https://docs.x.ai/developers/model-capabilities/text/structured-outputs)
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
