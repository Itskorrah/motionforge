# MotionForge craft standard — research and acceptance criteria

Last reviewed: 18 October 2026. This is an **editorial operating standard**, not a claim that an automated numerical score predicts audience preference. A polished motion video may intentionally break any stylistic rule; exceptions require a reason.

## Research baseline (primary sources)

| Source | Practical observation | Encoded studio behaviour |
|---|---|---|
| [Adobe — animated video production](https://www.adobe.com/creativecloud/video/discover/how-to-make-animated-videos-for-youtube.html) | Write and storyboard before animation | Dedicated creative brief, editable shots and inspectable storyboard before rendering |
| [Google Design — motion as communication](https://design.google/library/making-motion-meaningful) | Movement should direct attention and convey spatial meaning | Closed-form springs, one visual subject per shot, purposeful composition motifs |
| [Google Design — review questions](https://design.google/library/reviewing-the-design-review) | Legible hierarchy and appropriate interaction patterns matter | Editorial checks for density and repetition; manual/vision review for actual composition |
| [DIA / Mitch Paone interview](https://design.google/library/design-notes-riffing-on-design) | Typography, identity and time are first-class design materials | Typographic emphasis and multiple layout grammars rather than effects alone |
| [Apple — motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Avoid needless movement and excessive oscillation | Real damped motion, bounded secondary pulses, fewer decorative UI transitions |
| [TikTok — creative guidance](https://ads.tiktok.com/business/creativecenter/quicktok/online/Creating_Made_Easier/pc/en) | Get into the action, 9:16, sound, and platform-safe content | Vertical preset, audio export, opening critique, safe-zone overlay |
| [Meta — Reels guidance](https://www.facebook.com/business/ads/facebook-instagram-reels-ads) | Vertical with audio and important content within safe areas | Frame guides and proof of combined video/audio output |
| [W3C — interaction animation](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions) | Motion sensitivity calls for alternatives and respect for preferences | Reduced-motion editing UI, manual scrub and pause; delivered films need deliberate editorial accessibility review |
| [Remotion](https://www.remotion.dev/) and [licence](https://www.remotion.pro/license) | Code-based composition/player is useful, but a second rendering stack and licence matter | Retain existing deterministic Chrome renderer rather than adopting unneeded runtime complexity |
| [Rive state machines](https://rive.app/docs/editor/state-machine) | Excellent for reusable interactive animations | Future optional interactive assets; not required for video editing |

The sources are primarily vendor design guidance and production documentation, not independent proof of a universal best style. The studio's defaults are design hypotheses that must be tested on real output.

## The production bar

### 1. Story before spectacle

- Identify an actual audience, goal, emotional tone and intended final thought.
- Opening shot earns attention by creating contrast, tension, a question or an immediate revelation. Avoid generic motivational phrases.
- Every subsequent shot reveals new information, proof, comparison, consequence or resolution. If removing a shot changes nothing, remove it.
- Finish on a distinct, memorable visual or meaningful action. A CTA is optional; an ending intent is not.
- Do not generate unverified statistics, real testimonials, fictitious quotes or misleading product claims.

### 2. Editorial typography

- Use a clear primary headline and subordinate supporting copy. Default guidance: **3–7 headline words**, **≤18 caption words**; this is a readability prompt, not a universal limit.
- Text must pass at actual output dimensions, on a phone, *and* during the frame it enters or exits.
- Prefer deliberate type systems (weight, tracking, scale, rhythm) over decorative effect stacks. Select a meaningful brand palette.
- Avoid hidden lines, collision at shot boundaries, incomprehensible motion blur or crowded backgrounds. A still image is not enough: scrub frame by frame.

### 3. Cinematic framing and visual grammar

- Begin with hierarchy: one focal subject, one support layer, intentional negative space and a consistent spatial reference.
- Three layout grammars: `split` for comparison/information, `type-led` for statement/claim, `art-led` for a visual reveal. Six procedural motifs can be recombined; variety is subordinate to coherence.
- Avoid template fatigue (the same layout and entrance repeated every cut) without sufficient narrative reason.
- Vertical social layouts are **platform-dependent**. The guide is deliberately conservative (top ~12%, sides ~10%, bottom ~18%) and *not* a guarantee of safety in every app, placement or overlay. Check the current platform preview before publishing.
- Test 9:16, 16:9 and 1:1 separately. A crop is not a redesign.

### 4. Animation as meaning

- The current engine uses the analytic solution to damped spring equations; no CSS keyframes are used to animate exported graphics.
- Distinguish an intentional hold from a dead/frozen sequence. Short rests let viewers read. Long static holds with no musical or storytelling purpose should be challenged.
- Sequence action in layers: focal reveal, supportive movement, recovery. Avoid simultaneous entrances that bury the message.
- Review continuity at actual cuts: position, colour and direction can bridge shots when that improves clarity; abrupt beat cuts are appropriate when they deliver emphasis.
- Validate motion at exact first and final frames, not only aesthetically pleasing mid-scene stills.

### 5. Sound and rhythm

- Cut and audio scheduling share an integer frame/sample clock. Incompatible BPM/FPS combinations are rejected rather than silently nudged.
- Sound has narrative responsibilities: emphasis, contrast, breathing room, payoff. More hits do not necessarily mean better audio.
- Audition on headphones and phone speakers; check for clipped transients, inaudible low end and uncomfortable loudness jumps. Do not treat synthetic sound as automatically mixed/mastered.
- External music, voices and samples require rights checks; they are **not** part of the current built-in generative soundtrack implementation.

### 6. Evidence-based quality gates

| Gate | Automatic? | Evidence | What passing does *not* mean |
|---|---|---|---|
| Schema and render plan | Yes | Validated JSON, integer beat/frame/sample timing | Interesting storytelling |
| Editorial preflight | Heuristic | Specific warnings with recommended action | Human-approved craft |
| Technical all-frame QA | Yes, in `produce` | Missing/blank/frozen-frame inspection, per-shot reports | Aesthetic excellence |
| AI visual critique | Optional paid API | Per-shot storyboard judgments + conservative issues | Independent market-standard certification |
| Audio/video export | Yes | FFmpeg MP4 with H.264 and AAC | Balanced sound on every device |
| Human final watch | **Required before publication** | Editor watches full video with audio, checks platform preview and factual claims | Future audience success |

**Passing rule:** A motion video is a *candidate for publication* only after technical QA has passed, editorial issues were considered, no factual/rights blockers remain, and a human approves. The AI critic's 8/10 is a subjective reviewer threshold, not a market percentile or objective quality guarantee.

## Suggested human scoring (optional, not an engine output)

Evaluate each on a 1–5 scale: narrative clarity, typographic craft, composition, originality, kinetics, sound design, pacing, consistency, platform suitability, emotional impact. Do not average blindly: a failure in factual integrity, brand accuracy or flashing/motion safety is a stop-ship issue regardless of the total.

## Current limitations and highest-impact next advances

The v0.2 editor is a practical **code-first motion design studio** rather than an After Effects replacement. Advanced vector illustrations, footage integration, imported audio/voiceover, keyframed layer editing, subtitles, typeface management and per-frame waveform editing are not yet supported. Their omission matters more than simply adding new procedural motifs. Recommended sequence:

1. Asset import and rights metadata, with reusable compositions and graceful missing-file errors.
2. Visual text-flow/safe-area geometry checks using measured bounds, rather than length proxies only.
3. True audiovisual preview and mixed audio controls (voice/music/SFX levels and target loudness review).
4. Structured creative references and reusable brand systems, with carefully licensed typefaces.
5. Layer-level timeline and composition editor, then independent testing with real creators.

---

A competitive studio makes intentional choices visible and reversible. It must **never** turn heuristic scores into unsupported marketing claims.
