# Architecture and invariants

## Runtime modules

- `studio.mjs`: supported CLI; init/plan/render/produce, preview scaling and option forwarding
- `studio/project.mjs`: format presets, schema validation, deterministic brief → draft, sample-exact timeline guard
- `studio/creative.mjs`: optional API-powered storyboarding, JSON response treated as untrusted and revalidated
- `studio/scene.html`: responsive portrait/landscape Canvas composition using shared closed-form physics (no CSS animation)
- `physics.cjs`: deterministic analytical oscillator in three damping regimes
- `timeline.mjs`: exact integer video-frame and PCM-sample beat grid, deterministic edit points
- `sound.mjs`: sample generation (kick, snare, hats, bass, melodic plucks) → 48 kHz stereo PCM WAV
- `render.mjs`: isolated Chrome DevTools capture with explicit frame index; FFmpeg H.264/AAC MP4 mux
- `quality.mjs`: all-frame RGB defect detection; contact sheets preserve output aspect ratio
- `critic.mjs`: optional API vision scoring, strict issue vocabulary, bounded non-executable tuning
- `qa-loop.mjs`: multiple actual renders, artefact/report persistence, best tested version selection and failure status

## Rules

1. Every final video cut belongs to an integer beat and frame (no silent rounding).
2. Every frame can be regenerated out of order from a pure virtual timestamp.
3. Visible element motion derives from physical oscillator solutions. Any newly added motions must not use CSS animation, tween-only easing or timing hacks.
4. No creative project string is executed as JavaScript: scene receives structured, validated content via JSON.
5. AI never writes executable patches in the QA loop. It selects bounded parameter adjustments; all revisions are re-rendered and re-tested.
6. Never equate local defect score with aesthetic excellence. Without a vision provider mark artistic quality unverified.
7. Render process isolates temporary browser profile, cleans temporary data and does not expose a network service to the Internet.
8. Preserve user-edited project files and avoid overwrites.

## How to add a motif

Extend `studio/scene.html` by adding a new pure Canvas drawing function, a motif branch and a validated motif ID in `studio/project.mjs`. Compose movement from `SpringPhysics.springState`. Use seed and frame index rather than `Date.now()`, `Math.random()`, timeouts or runtime audio clocks. Supply opening/held/end frame tests. Validate no off-screen typography for three supported aspect ratios.

## Studio UI boundary

The initial tool is intentionally CLI-first because predictable rendering and tests matter before a more elaborate editor. A later timeline/editor UI should write `project.json` and invoke the existing production pipeline, rather than adding a second renderer.
