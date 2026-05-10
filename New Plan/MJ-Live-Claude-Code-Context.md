# MJ LIVE — Full Project Context
## For Claude Code / VS Code Handoff

---

## WHO I AM

I am an SAP Development Architect transitioning into AI. I have strong enterprise architecture background — integration patterns, event-driven systems, data flows, SAP BTP. My goal is to become an AI Engineer/Architect. I learn by building real things, not tutorials. I document as I build. Each phase of this project is a blog post.

---

## WHAT THIS PROJECT IS

A 1-minute real-time AI experience that pays tribute to Michael Jackson. Not a demo dressed up as AI. Every component earns its place architecturally.

**The experience:**
- 1 minute MP3 file plays (stored locally)
- First 30 seconds: Billie Jean
- Last 30 seconds: History (MJ sings years + what happened that year)
- Two screens run simultaneously

**Screen 1 — The Stage:**
- Billie Jean plays
- Concert-grade WebGL audio visualizer reacts in real time
- Spotlight beams, frequency bars with floor reflection, beat pulse rings, particle system
- Emotion detected in audio drives particle behaviour and colour palette

**Screen 2 — The Chronicle:**
- History song plays
- AssemblyAI transcribes live, sub-300ms latency
- As MJ sings each year, it reveals cinematically on the left of the screen
- On the right, a chronicle builds — every year lands and stays
- AI reasoning stream visible — showing emotion classification, visual decisions
- At 60 seconds: AI reflects on the full chronicle, finds patterns across years, generates one unrepeatable closing sentence

---

## WHAT IS ALREADY BUILT

Two production-quality HTML files exist as the UI foundation:

### mj-concert-visualizer.html
- Drop any MP3 to activate
- Canvas-based particle system (concert grade)
- Spotlight beams react to bass frequencies
- Frequency bars with floor reflection
- Beat pulse rings on kick drum detection
- Gold colour palette
- Progress bar
- Pause/reset controls

### mj-ai-vision-demo.html
- Left panel: year reveals cinematically as spoken
- Right panel: chronicle builds and stays
- AI reasoning stream (shows thinking step by step)
- Emotion classification bars (grief, power, hope, rage)
- Particle behaviour changes per emotion
- Background colour shifts with emotional tone
- Timeline accumulates every year

**These two files are the UI. Everything built next is the enterprise brain behind them.**

---

## ENTERPRISE ARCHITECTURE

### Event Flow
```
[Browser — Audio Capture]
          |
    [Solace PubSub+]
    /              \
[Topic 1]        [Topic 2]
audio/equalizer  audio/transcription
    |                    |
[CPI iFlow 1]      [CPI iFlow 2]
Frequency data     AssemblyAI + LLM
    |                    |
[Screen 1]          [Screen 2]
Visualizer          Chronicle
```

### Why Each Component

**Solace Advanced Event Mesh (trial):**
- Guaranteed message delivery — WebSockets cannot do this
- Topic-based routing — two screens, two topics, fully decoupled
- Replay capability — re-run demo without replaying audio
- Enterprise event broker — production-grade, not a prototype

**SAP BTP CPI (trial):**
- Governed gateway to AssemblyAI — API keys stay server-side
- Retry logic and circuit breaker built in
- Audit trail — every AI call logged and monitorable
- Two independent iFlows — can fail, scale, or be replaced independently
- One job per iFlow — clean, testable, replaceable

**AssemblyAI (free tier — $50 credit, no card required):**
- Sub-300ms streaming latency — Whisper does not stream natively
- LeMUR: transcription AND emotion analysis in a single API call
- Free tier covers thousands of demo runs
- Built for real-time — Whisper is built for batch

---

## AI DESIGN PATTERNS IN USE

These are not prompt calls. Each is a recognised AI architecture pattern.

| Pattern | What It Does |
|---|---|
| Streaming Inference | AssemblyAI transcribes live audio chunk by chunk as MJ sings |
| Parallel Tool Use | Transcription and emotion run simultaneously, non-blocking |
| Emotion Classification | LLM classifies emotional weight of each historical year |
| Reflection | At end of 60s, AI reviews the full chronicle it witnessed |
| Pattern Recognition | AI finds thematic connections across all years surfaced |
| Generative Summarisation | AI generates one unrepeatable closing sentence |

**Key principle:** AI is not a passenger. It makes decisions that couldn't be hardcoded — which emotion, how long to display, what patterns exist, what to say at the end.

---

## AI CONCEPTS TO EXPLORE / EXTEND

Discussed during brainstorm — not yet implemented:

**Improve existing AI architecture:**
- Memory and contextual reasoning — each year builds on previous, AI understands narrative arc not just isolated moments
- RAG — ground every year in a real knowledge base, retrieved and synthesized not generated
- Fine-tuned embeddings — embed every year, find semantic distance, cluster related years visually
- Anomaly detection — AI questions which years MJ chose to sing and why
- Multi-modal fusion — audio emotion plus lyrical meaning combined into one vector

**Extensions:**
- Any artist, any song — pipeline is generic, drop in any audio
- Live concert mode — microphone input, fully unscripted
- Audience participation — viewers vote, sentiment aggregated live, AI responds to crowd
- The other side — what was happening in music that same year, context on context

---

## BUILD PHASES (Each = One Blog Post)

| Phase | What Gets Built | AI Concept | Blog Post |
|---|---|---|---|
| 0 | Solace + CPI trial setup, test event end to end | Event-driven architecture | Post 1: The Plumbing |
| 1 | Browser captures audio, publishes to Solace | Real-time event publishing | Post 2: The Signal |
| 2 | Screen 1 subscribes, visualizer reacts | Event consumer pattern | Post 3: The Stage |
| 3 | CPI iFlow calls AssemblyAI, publishes transcript + emotion | AI as enterprise service | Post 4: The Brain |
| 4 | Screen 2 subscribes, years reveal cinematically | Streaming AI output to UI | Post 5: The Chronicle |
| 5 | Reflection agent — pattern + closing sentence at 60s | Reflection + generative AI | Post 6: The Finale |
| 6 | Package, Docker, architecture diagram, demo video | Production readiness | Post 7: The Tribute |

---

## TOOLS & STACK

| Layer | Tool |
|---|---|
| Transcription | AssemblyAI (free tier) |
| LLM | OpenAI or Claude (for emotion, reflection, pattern, finale) |
| Events | Solace Advanced Event Mesh (trial) |
| Integration | SAP BTP CPI (trial) |
| Frontend | mj-concert-visualizer.html + mj-ai-vision-demo.html |
| Backend | Node.js (audio capture, Solace pub/sub bridge) |
| IDE | VS Code + Claude Code (Pro plan) |
| Version Control | Git — one commit per phase |

---

## THE ONE RULE

**Document as you build. Not after.**

For every decision:
- What you chose
- What you considered and rejected
- Why

That thinking record is the difference between a developer who built something and an architect who designed it.

---

## WHAT SUCCESS LOOKS LIKE

By the end, be able to walk into a room and answer:
- Why did you choose AssemblyAI over Whisper?
- Why Solace and not WebSockets?
- Why two CPI iFlows and not one?
- How does your system fail gracefully?
- What AI patterns did you use and why those six?
- How would this scale to 10,000 concurrent listeners?

Not just built it. Designed it. Can defend every decision.

---

## IMPORTANT CONTEXT FOR CLAUDE CODE

- Do not suggest removing SAP BTP CPI or Solace — they are deliberate enterprise architecture decisions, not decorative
- Do not simplify the architecture to "just use Node.js" — that misses the point
- Every AI call should be a recognised pattern, not just a prompt
- Respect Michael Jackson throughout — this is a tribute, not a tech toy
- When suggesting improvements, lead with the architectural reason, not just the technical capability
- The two HTML files are finished UI — do not redesign them unless explicitly asked
- Build one phase at a time — do not skip ahead
- When in doubt, ask which phase we are on before writing code

---

*In memory of Michael Jackson — 1958 to 2009*
