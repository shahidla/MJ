---
name: MJ Project context and architecture
description: Full understanding of the MJ Live project — real-time audio cognitive pipeline demo, SAP BTP enterprise stack, 8 AI cognitive modes
type: project
originSessionId: 19006e94-b907-4548-8353-1288b951cab7
---
# MJ Live — Project Context & Architecture

**Repo:** https://github.com/shahidla/MJ  
**Local path:** C:\Dev\MJ  
**Stack:** SAP CAP, SAP BTP CPI, Solace Advanced Event Mesh, AssemblyAI, LangChain, HANA Vector, Node.js bridge

> Old code (v1) is reference only. The NEW PLAN section below is what gets built. Do not revert to old patterns.

---

## Old Code — Reference Only

The original v1 code (SSE, OpenAI Whisper, D3 hardcoded years, Billie Jean only) is in the repo for reference. Do not build from it. Key files for reference:

| File | What it had |
|------|------------|
| `app/mj-audio-worklet.js` | **Keep** — PCM16 capture, carries forward as-is |
| `srv/mj-events.js` | pcm16ToWav() logic moves to CPI iFlow 1 |
| `srv/mj-realtime.js` | Dropped — AssemblyAI replaces OpenAI Realtime |
| `server.js` | Dropped — SSE replaced by Solace |
| `app/media/mj_producer.html` | Replace — new producer is minimal, no EQ visualizer |
| `app/media/mj_consumer.html` | Replace — new consumer is the three-section layout |

---

# NEW PLAN — MJ Live (v4, Finalised: 2026-05-11)

> Everything below supersedes the old approach above.
> Old code is reference only. New plan is what gets built.
> Source of truth: `New Plan/MJ-Live-Claude-Code-Context-v4.md`

---

## The Core Philosophy

Michael Jackson never made it about himself. Even when he sang from personal pain, he turned it outward — toward the world, toward the invisible, toward the suffering.

The AI is not witnessing MJ's journey. It is witnessing **humanity's journey** — through the eyes of a man who never stopped caring about it.

The closing question the AI asks is the question he spent his whole life asking.

The AI generates its full reflection in its own words — a synthesis of all four acts. The final line is always: **"Did we change?"** — it is the thematic anchor, not a generated guess. Everything before it is unrepeatable. That line is fixed.

---

## The Experience

A 4-5 minute real-time AI cognitive pipeline demo. One audio file. Four songs. Four emotional acts. Two URLs — producer and consumer. AI witnessing humanity's journey in real time.

```
Act 1 — HIStory          — Wonder       — humanity dreams
Act 2 — They Don't Care  — Anger        — humanity divides  
Act 3 — Earth Song       — Grief        — humanity damages the world
Act 4 — Man in the Mirror— Hope         — humanity looks inward
```

One audio file, edited: one section from each song, continuous playback. No gaps. No interaction after pressing play.

### 1-Minute Demo Version (conference)
- Act 1 — 15s: HIStory outro date sequence
- Act 2 — 15s: They Don't Care climax refrain
- Act 3 — 15s: Earth Song "what about us" cascade
- Act 4 — 15s: Man in the Mirror "make that change" close

### Full Version (blog / YouTube)
- Each act 60-90 seconds. Crossfades: Act1→2: 2s abrupt. Act2→3: 1s sharp. Act3→4: 3s slow.

---

## Between-Act AI Sentences

After each act, as the music crossfades, the Reflection Agent generates one sentence from what it just witnessed. Not scripted. Generated live from LangChain memory of that act.

| Transition | AI tone | What it just witnessed |
|------------|---------|----------------------|
| After Act 1 | Awe, a question forming | Human potential — Edison, MLK, moon landing, Berlin Wall |
| After Act 2 | Confusion, not accusation | The same humanity producing racism, brutality, invisibility |
| After Act 3 | Grief, quiet | The planet wounded — species lost, wars, children |
| After Act 4 | Still. Final. | One person choosing to change |

Then silence. Then the closing reflection — the AI's full synthesis of all four acts in its own words.

---

## Two Screens — Architectural Decision

Two screens is not a UX preference. It is the architecture made visible.

Producer and consumer are independent Solace subscribers. Neither knows the other exists. Two URLs prove that. One URL hides it.

**Producer screen** — functional only
- Audio file player + Play button
- Solace connection status indicator (Publishing PCM16 ✓ / EQ ✓)
- No visualizer. No output. Control room, not the stage.
- The person running the demo sits here.

**Consumer screen** — the full experience
- Top (full width): WebGL concert visualizer — reacts to EQ frames from Solace
- Bottom left: cognitive pipeline — active mode, what the AI is currently doing
- Bottom right: chronicle building — years, events, emotion bars, AI closing reflection
- The audience watches this. The projector shows this.

**Screen transitions are AI-driven, not time-driven.**
The `chronicle/event` Solace payload carries an act directive. When the first Act 2 event arrives, the visualizer compresses and the bottom panels slide up. The screen does not know what time it is — it only knows what the AI just understood.

```json
{
  "act": 2,
  "trigger": "year_detected",
  "year": "1968",
  "emotion": "grief",
  "cognitiveMode": "relational_reasoning",
  "insight": "MLK appeared in Act 1 as hope. He reappears here as a broken promise.",
  "transitionDirective": "compress_visualizer"
}
```

**Audio never travels to the consumer.** The consumer has no audio element, no speakers, no playback. It only receives derived events — EQ frames and chronicle events. By the time an event reaches the consumer the raw audio has done its job upstream and is gone.

**The two existing HTML files get merged into one consumer HTML file with three sections.**
- `New Plan/mj-concert-visualizer.html` → top section (WebGL visualizer)
- `New Plan/mj-ai-vision-demo.html` → bottom sections (cognitive pipeline + chronicle)
- One URL. One page. Both wired to Solace. Visual design stays — do not redesign.

---

## Full Audio Flow — Step by Step

**User presses Play on the producer screen**

1. Browser loads audio file locally and starts playing
2. AudioWorklet captures raw audio signal, converts to PCM16 — 16kHz, mono, 16-bit
3. Every ~100ms browser sends two streams to the Node.js bridge via HTTP POST:
   - PCM16 chunks → bridge publishes to Solace topic `audio/pcm`
   - EQ frames (frequency bar values) → bridge publishes to Solace topic `audio/equalizer`
4. Node.js bridge holds Solace credentials. Browser never touches them.

**EQ path — fast, no AI**

5. Consumer screen subscribed to `audio/equalizer` via Solace JS SDK WebSocket
6. EQ frame arrives → WebGL visualizer reacts instantly
7. Spotlight beams, frequency bars, beat pulse rings update in real time
8. Pure data → render. No AI. No latency introduced.

**PCM16 path — the cognitive pipeline**

9. CPI iFlow 1 subscribed to `audio/pcm` via Solace
10. CPI wraps PCM16 chunks into WAV format
11. Sends WAV to AssemblyAI streaming API
12. AssemblyAI returns transcript in under 300ms — e.g. "1968, Martin Luther King assassinated"
13. CPI passes transcript to SAP CAP via HTTP

**CAP — intelligence layer**

14. CAP receives transcript line
15. Queries HANA Vector Store — retrieves deep historical context for what was heard
16. LangChain runs the cognitive pipeline with: transcript + retrieved context + memory of all previous acts
17. Cognitive modes fire: classify emotion → reason relationally → evaluate reflectively
18. CAP persists enriched event to HANA
19. CAP publishes enriched event to Solace topic `chronicle/event` including act directive

**Consumer screen receives chronicle event**

20. Consumer subscribed to `chronicle/event` via Solace JS SDK WebSocket
21. Reads act directive — if Act 2 starting: visualizer compresses, bottom panels slide up
22. Year reveals cinematically on bottom left
23. Chronicle entry lands and stays on bottom right
24. Cognitive mode indicator updates
25. Emotion bars shift

**End of Act 4**

26. CAP Reflection Agent reviews full chronicle — all four acts in LangChain memory
27. Finds thematic connections across acts
28. Generates closing reflection in its own words — never scripted, never the same twice
29. Publishes finale event to Solace
30. Consumer receives it — closing reflection fades in, holds, fades out
31. Silence. Black.

---

## Architecture Diagram

```
[Producer Screen]
  Audio file plays locally
  AudioWorklet → PCM16 + EQ frames
  HTTP POST every ~100ms
        ↓
[Node.js Bridge — BTP Cloud Foundry]
  Holds Solace credentials
  Relays PCM16 → Solace topic: audio/pcm
  Relays EQ frames → Solace topic: audio/equalizer
  No business logic
        ↓
[Solace Advanced Event Mesh]
  topic: audio/equalizer  ──────────────────────────→ [Consumer Screen]
  topic: audio/pcm  ──→ [CPI iFlow 1]                  WebGL visualizer
  topic: chronicle/event ←──────────────────────────── reacts to EQ directly
                                ↓                       no CPI involved
                    AssemblyAI streaming API
                    sub-300ms transcript
                                ↓
                         [SAP CAP]
                    LangChain cognitive pipeline
                    HANA Vector RAG retrieval
                    LLM emotion classification
                    HANA persistence
                    Reflection Agent at finale
                                ↓
                    Solace topic: chronicle/event
                                ↓
                         [Consumer Screen]
                    Chronicle builds
                    Cognitive modes visible
                    Closing reflection generated
```

---

## Tool Decisions — One Reason Each

| Tool | Job | The Reason You Defend In A Room |
|------|-----|--------------------------------|
| **Solace** | Event mesh | Any producer can publish, any consumer can subscribe, neither knows the other exists. Add a screen, a recorder, a monitor — zero code changes elsewhere. |
| **CPI** | Governed AI gateway | API keys never leave the integration layer. Every AssemblyAI call is logged, retried on failure, and replaceable without touching consumers. |
| **AssemblyAI** | Streaming transcription | Sub-300ms streaming latency. Whisper is batch — the year must appear as MJ sings it, not 10 seconds later. Only fit for this requirement. |
| **CAP** | Business logic + persistence + OData | CPI is not a database. CAP owns the RAG retrieval, LLM reasoning, HANA persistence, and OData API. Each component does one job. |
| **HANA Vector** | RAG knowledge base | MJ sings the year and headline. RAG adds the human story behind it — survivor accounts, what happened next — so the LLM classifies emotion with depth, not just a keyword label. Native BTP, no external vector DB. |
| **Node.js bridge** | Browser-to-Solace relay | Browsers cannot hold enterprise middleware credentials safely. Node.js is the thin trusted boundary. No business logic lives here. |

---

## Why SSE Was Dropped

SSE was in the old code because the old code was built on CAP scaffold in BAS. It was never a deliberate choice. In the new architecture Solace is the event bus — the browser subscribes directly via Solace WebSocket SDK. SSE is redundant and removed entirely.

---

## Why RAG Is In

MJ sings: `"1968 Martin Luther King assassinated"` — one sentence.

That is thin context for meaningful emotion classification. HANA Vector stores deep historical context per event — what happened at the Lorraine Motel, the riots in 100 cities, James Brown going on TV to calm the crowds. The LLM reasons over that enriched context and returns nuanced emotion scores and an insight sentence.

RAG is NOT used on the lyrics. That would be lip-syncing — a fake demo. RAG enriches the AI's understanding of what MJ chose to sing about. The year and headline come from live audio. Everything else is retrieved.

---

## What Carries Forward From Old Code

| Old file | Decision | Reason |
|----------|----------|--------|
| `app/mj-audio-worklet.js` | Keep as-is | Produces PCM16 at 16kHz mono — exactly what AssemblyAI requires |
| PCM16 → WAV wrapping logic in `mj-events.js` | Move to CPI iFlow 1 | Same logic, different home |
| `New Plan/mj-concert-visualizer.html` | Merge into consumer HTML — top section | Visual design stays, wire to Solace |
| `New Plan/mj-ai-vision-demo.html` | Merge into consumer HTML — bottom sections | Visual design stays, wire to Solace |

---

## What Is Dropped

| Old component | Why dropped |
|---|---|
| SSE (`/mj/eq-stream`, `/mj/stream`) | Solace WebSocket replaces entirely |
| OpenAI Whisper (`gpt-4o-transcribe`) | AssemblyAI streaming replaces |
| OpenAI Realtime API (`mj-realtime.js`) | AssemblyAI replaces |
| CAP as default scaffold | CAP now has a specific job, not a container for everything |
| D3 hardcoded years | Real transcript-driven years from AssemblyAI |
| `app/media/mj_producer.html` | Replace entirely — new producer is Play button + Solace status only, no EQ visualizer |
| `app/media/mj_consumer.html` | Replace entirely — new consumer is the merged three-section layout |

---

## The 8 AI Cognitive Modes

These are not 8 prompt calls. Each is a distinct cognitive mode. Together they form a pipeline that mirrors human processing of a profound experience.

| # | Mode | What It Does | LangChain Component |
|---|------|-------------|---------------------|
| 1 | Perception | Hears live audio, receives transcript | AssemblyAI → LangChain input |
| 2 | Classification | Identifies emotion per moment | LLMChain — classification prompt |
| 3 | Contextual Retrieval | Pulls deep historical context from HANA Vector | RetrievalQA chain |
| 4 | Temporal Memory | Accumulates understanding across all four acts | ConversationBufferMemory |
| 5 | Relational Reasoning | Connects contradictions across acts (MLK in Act 1 = hope; Act 2 = broken promise) | LLMChain — reasoning prompt |
| 6 | Reflective Evaluation | Processes what it witnessed, speaks between acts | Reflection Agent |
| 7 | Pattern Synthesis | Finds themes across full four-act narrative | Finale Agent — pattern tool |
| 8 | Generative Expression | Produces unrepeatable closing reflection in its own words | Finale Agent — generation tool |

**LangChain is the cognitive orchestration layer. CPI is the enterprise gateway. These roles never merge.**

---

## Build Phases

One demo. One blog post with sections. Not eight separate posts.

| Phase | What Gets Built | Blog Section |
|-------|----------------|--------------|
| 0 | Solace + CPI + CAP + HANA trial setup, test one event end to end | The Foundation |
| 1 | Audio capture → Node.js bridge → Solace → consumer EQ visualizer reacts | The Signal & Stage |
| 2 | CPI iFlow 1 → AssemblyAI → LangChain Perception + Classification | The Brain |
| 3 | HANA Vector embeddings + LangChain RAG retrieval | The Memory |
| 4 | LangChain Temporal Memory + Relational Reasoning across acts | The Reasoning |
| 5 | Consumer screen subscribes, four acts reveal cinematically, chronicle builds | The Chronicle |
| 6 | Reflection Agent + Finale Agent + closing reflection generated | The Conscience |
| 7 | Package, architecture diagram, demo video, blog publish | The Tribute |

---

## CPI Free Tier Constraint

Free tier = 2 active iFlows maximum.

Only one iFlow is needed:
- iFlow 1: PCM16 → AssemblyAI → CAP (the only external AI call)

EQ frames do not go through CPI — they flow directly from Solace to the consumer. No AI, no external API, no governance needed.

The second iFlow slot is free. The Reflection Agent at the finale runs inside CAP directly — reflection is business logic, not integration, so it never needed a CPI slot.

---

## Hosting

| Component | Where | Why |
|-----------|-------|-----|
| Node.js bridge | BTP Cloud Foundry — `mj-live-bridge` app | Serves producer.html, consumer.html, audio file. Holds Solace credentials. Single trusted boundary. |
| CAP app | BTP Cloud Foundry — `mj-live-cap` app | AI pipeline, RAG, HANA persistence, OData |
| HANA + Vector Store | SAP HANA Cloud free tier | Native BTP, no external vector DB |
| CPI iFlow 1 | SAP BTP Integration Suite | PCM16 → AssemblyAI → CAP |
| Solace broker | Solace Cloud free tier | Advanced Event Mesh — `mj-live` VPN |

**Decision locked: bridge deploys to BTP CF alongside CAP.**
- Everything is one BTP account — one URL to share, one login, one platform story
- Free tier: two CF app instances (256MB each) — bridge + CAP fits exactly
- `cf push` from `bridge/` with `manifest.yml` — same deploy workflow as CAP
- Browser never holds Solace credentials — bridge injects them at serve time

---

## The One Rule

Document as you build. Not after.
For every decision: what you chose, what you considered and rejected, why.
That record is the difference between a developer who built something and an architect who designed it.

---

## Current Build State (last updated: 2026-05-12)

### Phase 1 — COMPLETE
### Phase 2a — COMPLETE
### Phase 2b — IN PROGRESS

| What | File/Location | Status |
|------|--------------|--------|
| Node.js bridge — dual transport | `bridge/index.js` | Done |
| Producer HTML — native audio + separate 16kHz PCM capture | `bridge/producer.html` | Done |
| AudioWorklet PCM16 capture (200ms chunks, setInterval EQ) | `bridge/producer.html` | Done |
| ElevenLabs scribe_v2_realtime — primary STT | `bridge/stt-all.js` | Done |
| STT_ENABLED flag — off by default | `.env` | Done |
| Consumer HTML — WebGL visualizer + transcript panel | `bridge/consumer.html` | Done |
| TRANSPORT=solace — verified working | `.env` | Done ✅ |
| EQ flowing via Solace audio/equalizer | bridge → Solace → consumer | Done ✅ |
| PCM flowing via Solace audio/pcm | bridge → Solace | Done ✅ |
| Consumer subscribes to Solace audio/equalizer directly | `bridge/consumer.html` (Solace JS SDK) | Done ✅ |
| Bridge serves Solace JS SDK + /solace-config endpoint | `bridge/index.js` | Done ✅ |
| CPI package created | SAP BTP Integration Suite | Done ✅ |
| CPI iFlow 1 — HTTPS sender /mj-transcript | SAP CPI | Done ✅ |
| CPI iFlow 1 — Claude Haiku classification | SAP CPI | Done ✅ |
| CPI iFlow 1 — Groovy Script JSON extraction | SAP CPI | Done ✅ |
| CPI iFlow 1 — Solace REST publishing | SAP CPI → Solace REST | Known gap — see notes |
| Consumer displays chronicle/event (emotion/year/event/insight) | `bridge/consumer.html` | Done ✅ |
| Bridge /test-chronicle endpoint (test without ElevenLabs credits) | `bridge/index.js` | Done ✅ |
| Bridge /chronicle-event POST endpoint (CPI relay when needed) | `bridge/index.js` | Done ✅ |
| BTP CF deployment config | `bridge/manifest.yml` | Created |
| vocals.mp3 — isolated vocal test track | `app/media/vocals.mp3` | Added |

**Three live URLs (bridge running locally):**
- `http://localhost:3001/producer` — audio player, pushes EQ + PCM16 to bridge
- `http://localhost:3001/consumer` — concert visualizer + live lyrics transcript panel
- `http://localhost:3001/status` — health check

**CPI iFlow 1 endpoint:**
- `https://7f7132aetrial.it-cpitrial06-rt.cfapps.us10-001.hana.ondemand.com/http/mj-transcript`
- Auth: Basic (BTP trial credentials)
- Input: plain text transcript
- Output: publishes chronicle/event to Solace REST

**CPI iFlow 1 structure:**
```
HTTPS Sender (/mj-transcript)
  → Content Modifier (sets x-api-key, anthropic-version headers + Claude request body)
  → Request Reply → Claude API (claude-haiku-4-5-20251001)
  → Groovy Script (extracts clean JSON from Claude response)
  → Request Reply → Solace REST API (chronicle/event topic)
```

**Claude output schema (locked):**
```json
{"emotion": "", "year": "", "event": "", "insight": "one sentence"}
```
**"act" field removed** — AI must NOT detect which song is playing. Act detection from hardcoded song names breaks the universal pipeline principle ("The AI does not know it is listening to Michael Jackson"). The act is not needed — emotion + insight are sufficient for the consumer to react.

**Solace REST publishing URL:**
`https://mr-connection-rcgt0ju559a.messaging.solace.cloud:9443/mj-live/TOPIC/chronicle/event`

**STT decisions (locked):**
- ElevenLabs `scribe_v2_realtime` — best transcription of singing by significant margin
- `STT_ENABLED=false` during development to preserve API credits
- All other STT tested: Groq whisper-large-v3 (best batch), Deepgram nova-2/3, AssemblyAI whisper-rt, OpenAI whisper-1/gpt-4o/realtime, NVIDIA Parakeet (Gradio Space broken)

**LLM decision (locked):**
- Claude Haiku (`claude-haiku-4-5-20251001`) in CPI — cheapest, sufficient for classification
- Claude Opus/Sonnet reserved for Reflection Agent (Phase 6) and final insights
- SAP AI Core not available on trial account

### Phase 3 — IN PROGRESS

| What | File | Status |
|------|------|--------|
| CAP scaffold fresh (CAP 9.9.1) | `package.json`, `db/schema.cds`, `srv/mj-service.cds` | Done ✅ |
| CAP receiveTranscript action | `srv/mj-service.js` | Done ✅ |
| Claude Haiku — emotion/year/event/insight | `srv/mj-service.js` | Done ✅ |
| LangChain BufferMemory — temporal memory | `srv/mj-service.js` | Done ✅ |
| ChronicleEvents persisted to SQLite (local) | `db/schema.cds` | Done ✅ |
| CAP publishes chronicle/event to Solace | `srv/mj-service.js` | Done ✅ |
| Consumer displays chronicle/event | `bridge/consumer.html` | Done ✅ |
| HANA Cloud provisioned (with NLP) | SAP BTP | In progress |
| cds deploy --to hana | | Pending HANA |
| HistoryEvents knowledge base seeded | | Pending HANA |
| HANA Vector RAG (similarity search) | | Pending HANA |
| LangChain relational reasoning (Mode 5) | | Pending |
| Bridge → CAP auto-POST on transcript | | Pending |

**CAP endpoints (local):**
- `http://localhost:4004/odata/v4/mj/receiveTranscript` — cognitive pipeline entry point
- `http://localhost:4004/odata/v4/mj/ChronicleEvents` — live chronicle log
- `http://localhost:4004/odata/v4/mj/HistoryEvents` — RAG knowledge base

**Start CAP locally:**
```bash
cd C:\Users\shahi\Downloads\MJ
cds watch
```

**Test cognitive pipeline:**
```bash
curl -X POST http://localhost:4004/odata/v4/mj/receiveTranscript \
  -H "Content-Type: application/json" \
  -d '{"transcript":"rosa parks refuses to give up her seat 1955"}'
```

**CF CLI installed:** `C:\cf-cli\cf.exe`
**CF credentials:** API `https://api.cf.us10-001.hana.ondemand.com`, Org `7f7132aetrial`, Space `dev`
**Space GUID:** `f5ef9aa7-8cd8-49a6-84ea-cf4f0df4cd52`
**Org GUID:** `da7de550-a623-442e-9b17-620070dfb605`

### Phase 2b — What Is Working

```
Producer plays audio
  → EQ → Solace audio/equalizer → Consumer visualiser reacts ✅
  → PCM → Solace audio/pcm (ready for CPI iFlow 1) ✅

curl → CPI /mj-transcript → Claude Haiku → classifies emotion/year/event/insight ✅
Bridge /test-chronicle → Solace chronicle/event → Consumer displays it ✅
```

### Known Gap — CPI REST → Solace direct

CPI publishes to Solace via REST API but consumer does not receive it. Root cause: CPI REST publishes binary attachment format; consumer Solace JS SDK receives SDT container format from bridge. These differ in how the Solace broker delivers them.

**Resolution:** When bridge deploys to BTP CF (Phase 7), CPI will POST to bridge `/chronicle-event` endpoint, bridge republishes to Solace using SDK (SDT format). Consumer receives correctly. This is the end state anyway.

For now: use bridge `/test-chronicle` to test consumer display without ElevenLabs credits.

### Exact Stopping Point — Where Phase 3 Begins

1. **Wire bridge → CPI** — when STT_ENABLED=true, bridge POSTs ElevenLabs transcript to CPI endpoint automatically (currently manual curl)
2. **Build CAP service** — Node.js CAP app, receives transcript from CPI, runs LangChain + Claude cognitive pipeline, queries HANA Vector RAG, persists to HANA, publishes chronicle/event to Solace
3. **Provision HANA Vector** — load MJ history, HIStory song events, historical context
4. **Wire consumer bottom panels** — chronicle accumulates, cognitive mode visible, reflection at end
5. **Deploy everything to BTP CF** — bridge + CAP, single final push

### Locked Decisions
- STT: ElevenLabs scribe_v2_realtime
- LLM: Claude Haiku (CPI classification), Claude Opus/Sonnet (Reflection Agent)
- CPI publishes to Solace via REST API (not AMQP — AMQP adapter not available for publishing in trial)
- Act detection: REMOVED — Claude classifies emotion from content only, no hardcoded song names
- Consumer subscribes to Solace directly (Solace JS SDK) — bridge not in the path
- STT_ENABLED=false during development

### Open Questions
- BTP CF org/space name for `cf push`
- HANA Vector knowledge base content — MJ history, song meanings, HIStory dates
- LangChain vs direct Claude calls for Phase 3 cognitive pipeline (still to decide)

---

## The Universal Pipeline

MJ is the demo data. The tribute is the soul. The architecture is universal.

The AI has no knowledge of Michael Jackson baked in. It only knows what it heard — the transcript, the years, the words. It queries HANA Vector for historical context on whatever it detected. LangChain accumulates understanding across all acts. The Reflection Agent synthesises what it witnessed and generates its conclusion in its own words.

Play a different audio file — the AI generates a completely different output. Play the same file twice — the closing reflection will be similar in theme but never identical in words.

| Swap this | Everything still works |
|-----------|----------------------|
| Audio file | Any meeting, earnings call, interview, speech |
| HANA Vector data | Any knowledge domain |
| Act structure | Any number of segments |
| Songs | Any audio content |

Same architecture. Different knowledge base. Different audio. Different story.

**The pitch:** "The AI does not know it is listening to Michael Jackson. It just knows what it heard — and it tells you what it understood."
