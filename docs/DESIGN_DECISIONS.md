# Studio v0.2 — architecture record

## Problem

Existing MotionForge v0.1 is a working deterministic renderer controlled by JSON and the CLI. Editing prose, scene motifs or timing requires opening source files. Provider selection is possible via commands, but not through an approachable graphical workflow. The requested outcome is a repeatable, high-craft local studio with a GUI, not a one-time video template.

## Candidates evaluated before implementation

| Option | Strength | Main cost/risk | Decision |
|---|---|---|---|
| **Native Node HTTP + designed HTML/CSS/JS + existing Canvas** | Same runtime and exact frame geometry; no npm or deployment prerequisite; minimal coupling; local BYOK | UI features need careful manual implementation | **Selected** for v0.2 |
| React/Vite/complex UI component stack | Large ecosystem and mature editor patterns | Bundler, dependency maintenance and duplicated state for relatively small UI | Re-evaluate if app becomes multi-user or layer-level editor |
| Remotion as the render/runtime/player | Powerful React frame rendering and preview | Migrating proven engine, another renderer, licence considerations for commercial automators | Not needed today |
| Rive state machines | Rich interactive assets | Not a replacement for sound-aligned video export | Optional asset pipeline later |
| Cloud-hosted account-linked editor | Accessible from any machine | OAuth, credentials, storage security, compute and billing, asset permissions | **Explicitly deferred**, not disguised as implemented |

## Interfaces and ownership

```
web/                     presentation-only UI, no provider keys persisted
studio/server.mjs        loopback access, validation, ephemeral credentials, jobs, file serving
studio/project.mjs       validated project and deterministic frame count
studio/craft.mjs         editorial warnings (no synthetic quality score)
studio/creative.mjs      optional AI storyboard proposals
studio/providers.mjs     provider API boundary
studio/scene.html        shared browser preview + headless render composition
studio.mjs               stable production CLI
render.mjs / qa-loop.mjs existing deterministic production and QA
```

Projects remain human-readable `projects/<id>/project.json`. GUI preview calls the **same draw function** as export, not a CSS imitation. Only CLI production stages call the child process; no user-supplied shell strings. The server allows one active local render, returns progress and keeps exported MP4s outside source control.

## Security / access

- Bind only to `127.0.0.1` or `::1`; never expose the production API publicly. The browser sends a random session token on writes; `Origin` is also checked.
- API keys entered in the UI live in the Node process memory and propagate to child processes via environment (not command-line arguments). They are forgotten on server shutdown; the UI never reads them back.
- Browser/project content cannot directly specify file paths. Project IDs are restricted to slug characters and exports use controlled filenames.
- No subscription OAuth is claimed. Claude Code, Codex, ChatGPT and Gemini subscriptions are separate products from paid model API access; users can still edit and render locally at no per-render API cost.
- CSP is strict for the GUI. The isolated renderer document permits inline trusted application code, as required by the existing Canvas engine; the renderer is same-origin only and never receives arbitrary HTML from project JSON.
- Local single-user trust model: do not rely on these safeguards for an internet-exposed multi-tenant service. Persistent secrets, user identities, CSRF controls, rate limits and sandboxing would need a separate security design.

## Workflow decisions

1. Compose: create from original idea, audience and outcome; optionally request AI scenes.
2. Preview: live Canvas stage, exact frame scrubbing and per-scene selection, layout and motif controls.
3. Refine: write and save copy, view evidence-based craft hints, optionally request a new AI *proposal* without changing saved data.
4. Export: preview/master modes; optional self-review; explicit provider selection; MP4 playback/download within studio.

## Review methodology

Baseline project, tests and Git revision were inspected before changes. Two UI architectures (framework-based vs static local server) were compared. The goal is lower implementation and maintenance cost without compromising rendering or platform access. Evolve's actual coordinator guidance was reviewed and applied: preserve behaviour, verify against real workflows, record blockers. Cursor pstack `architect` and `interrogate` descriptions were read to structure boundaries and challenge correctness. No claim is made that parallel pstack subagents ran, or that either plugin was installed automatically.

References: https://github.com/Itskorrah/evolve · https://github.com/cursor/plugins/tree/main/pstack
