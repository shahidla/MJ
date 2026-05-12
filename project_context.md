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

| Phase | What Gets Built | Status | Blog Section |
|-------|----------------|--------|--------------|
| 0 | Solace + CPI + CAP + HANA trial setup | COMPLETE ✅ | The Foundation |
| 1 | Audio → bridge → Solace → consumer EQ visualiser | COMPLETE ✅ | The Signal & Stage |
| 2a | ElevenLabs STT (direct in bridge, temporary) | COMPLETE ✅ | The Signal & Stage |
| 2b | Solace transport live, CPI iFlow 1, Consumer chronicle/event | COMPLETE ✅ | The Brain |
| 3 | CAP cognitive pipeline, HANA RAG knowledge base (30 events), bridge→CAP auto-POST | COMPLETE ✅ | The Memory |
| 4 | Temporal Memory + Relational Reasoning across acts (Modes 4+5) | COMPLETE ✅ | The Reasoning |
| 5 | Consumer chronicle builds cinematically, cognitive mode indicator, 4-act reveal | COMPLETE ✅ | The Chronicle |
| 6 | Reflection Agent (Mode 6) + Finale Agent (Modes 7+8) + closing reflection | COMPLETE ✅ | The Conscience |
| 7 | Deploy bridge + CAP to BTP CF, architecture diagram, demo video | IN PROGRESS | The Tribute |

---

## CPI Free Tier Constraint

Free tier = 2 active iFlows maximum.

Only one iFlow is needed:
- iFlow 1: receives transcript via HTTPS → currently calls Claude Haiku → publishes to Solace
- Final state: iFlow 1 receives transcript → POSTs raw text to CAP (CAP owns all intelligence)

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
| HANA Cloud provisioned (with NLP enabled) | SAP BTP | Done ✅ |
| HDI container mj-live-hdi created | SAP BTP | Done ✅ |
| cds deploy --to hana:mj-live-hdi | HANA Cloud | Done ✅ |
| CAP connected to HANA, ChronicleEvents persisting | HANA Cloud | Done ✅ |
| HistoryEvents knowledge base seeded (30 events) | `db/data/mj-HistoryEvents.csv` | Done ✅ |
| HANA keyword RAG (headline + context search) | `srv/mj-service.js` | Done ✅ |
| Bridge → CAP auto-POST on committed_transcript | `bridge/stt-all.js` | Done ✅ |
| Temporal Memory (Mode 4) — structured session memory across all acts | `srv/mj-service.js` | Done ✅ |
| Relational Reasoning (Mode 5) — AI connects figures/events across acts | `srv/mj-service.js` | Done ✅ |
| Temporal Memory (Mode 4) + Relational Reasoning (Mode 5) | `srv/mj-service.js` | Done ✅ |
| Three-panel consumer: cognitive modes / year reveal / chronicle | `bridge/consumer.html` | Done ✅ |
| Cognitive mode indicator animates 01→05 on each event | `bridge/consumer.html` | Done ✅ |
| Year reveals cinematically (slide-up + gold glow) | `bridge/consumer.html` | Done ✅ |
| Chronicle accumulates last 4 entries, emotion bars shift | `bridge/consumer.html` | Done ✅ |
| Mode 6 — Reflective Evaluation (between-act sentence) | `srv/mj-service.js` | Done ✅ |
| Mode 7+8 — Finale Agent + closing reflection (Claude Opus) | `srv/mj-service.js` | Done ✅ |
| chronicle/reflection + chronicle/finale Solace topics | bridge + CAP | Done ✅ |
| Consumer displays reflection (centre fade) + finale (full screen) | `bridge/consumer.html` | Done ✅ |
| Trigger finale: `curl -X POST http://localhost:4004/odata/v4/mj/generateFinale` | | Ready |
| CPI iFlow updated — POST raw transcript to CAP (remove Claude from CPI) | | Pending |

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

**Deploy schema to HANA:**
```bash
export PATH=$PATH:/c/cf-cli
cf target -o 7f7132aetrial -s dev
cds deploy --to hana:mj-live-hdi
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

### Today's Session Summary (2026-05-12)

**What was built and proven working:**
1. Solace transport confirmed — EQ + PCM flowing through Solace broker ✅
2. Consumer subscribes directly to Solace `audio/equalizer` via Solace JS SDK ✅
3. CPI iFlow 1 built — HTTPS → Claude Haiku → Groovy JSON extract → Solace REST ✅
4. Consumer subscribes to Solace `chronicle/event` and displays emotion/year/event/insight ✅
5. CAP 9 scaffolded fresh — LangChain + Claude + HANA + Solace ✅
6. CAP cognitive pipeline working — receiveTranscript → Claude → persist → Solace ✅
7. HANA Cloud provisioned with NLP enabled ✅
8. HDI container mj-live-hdi deployed — all tables in HANA ✅
9. ChronicleEvents persisting to HANA Cloud — verified in Database Explorer ✅

**Full pipeline proven end to end (local):**
```
curl transcript
  → CAP receiveTranscript
  → Claude Haiku (emotion/year/event/insight)
  → HANA ChronicleEvents (persisted) ✅
  → Solace chronicle/event ✅
  → Consumer displays on screen ✅
```

**Key decisions made today:**
- CPI's Claude call is TEMPORARY — in final state CPI just relays transcript to CAP
- "act" field removed from Claude output — AI classifies from content, no hardcoded song names
- HANA Cloud: plan `hana-free`, NLP enabled, CF mapping to 7f7132aetrial/dev space
- HDI container: `mj-live-hdi`, plan `hdi-shared`
- Deploy command: `cds deploy --to hana:mj-live-hdi` (requires CF login via `cf target -o 7f7132aetrial -s dev`)

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

### Phase 7 — IN PROGRESS (2026-05-12)

**Goal:** Deploy bridge + CAP to BTP Cloud Foundry.

**CAP start command — resolved:**

Root cause of repeated CF staging failures: the `@sap/cds/bin/` directory contains `serve.js`, `deploy.js`, `args.js`, `colors.js` — no bare `cds` binary.

The correct production start command is `cds-serve`, which is a standalone binary entry point in `@sap/cds/package.json`:
```json
"bin": {
  "cds-deploy": "bin/deploy.js",
  "cds-serve":  "bin/serve.js"
}
```

When CF's nodejs buildpack runs `npm install`, it creates `node_modules/.bin/cds-serve` pointing to `bin/serve.js`. `@sap/cds-dk` (which provides the full `cds` CLI) is **not** needed in production.

**Fix applied:**
- `package.json` (root + gen/srv): `"start": "cds-serve"`
- `manifest.yml` (CAP): `command: npm start`
- `cds build --production` re-run — clean build confirmed

**CF env vars already set on mj-live-cap:**
- `ANTHROPIC_API_KEY`
- `SOLACE_URL`, `SOLACE_VPN`, `SOLACE_USERNAME`, `SOLACE_PASSWORD`

**CF crash #2 — @sap/xssec missing:**
CAP 9.x on CF auto-detects XSUAA service and tries to load `@sap/xssec` (JWT auth middleware). Without an XSUAA binding this causes `MODULE_NOT_FOUND` crash.
Fix: `cds.requires.auth.kind = "dummy"` in `package.json` — prevents CAP from loading xssec entirely. Correct for a demo app with no end-user auth.

**Next steps for Phase 7:**
1. `cf push` from MJ root (uses manifest.yml, path: gen/srv) — verify CAP starts
2. `cf push` from bridge/ directory — deploy bridge
3. Set bridge CF env vars via `cf set-env`
4. Update bridge CAP_URL to BTP CF URL
5. Update CPI iFlow — remove Claude call, POST raw transcript to CAP
6. Architecture diagram + demo video

---

---

## Pending Tasks — Ordered (last updated: 2026-05-12)

This is the single source of truth for what remains. Ordered by dependency — you cannot do step N before step N-1.

---

---

## Full Code Review Findings (2026-05-12)

Complete pass through all project files. Grouped by file and severity.

---

### consumer.html

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| C1 | Title hardcoded `BILLIE JEAN` (line 451), subtitle `Michael Jackson — Thriller` | Bug | Change to `MJ LIVE` / `humanity's journey` or make dynamic |
| C2 | `Share Tech Mono` used in `.ce-heard` and `.ce-rag` but NOT imported in Google Fonts (line 8) | Bug | Add to `@import` — currently falls back to browser default monospace |
| C3 | `BRIDGE_WS = 'ws://localhost:3001'` hardcoded (line 520) | Bug | Must be dynamic — use `window.location.host` with ws/wss based on protocol |
| C4 | `connectBridge()` called in Solace mode (line 804) with stale comment "until CAP is built" — CAP IS built | Bug | Remove bridge WS call when transport=solace; it throws errors on CF |
| C5 | `#eq-debug` div always visible showing raw EQ frame count | Polish | Hide in production or move to status overlay |
| C6 | Progress bar CSS defined (lines 420–430) but JS never updates `#progress-bar` width | Dead code | Either wire it to audio playback time or remove it |
| C7 | No emotion shown per chronicle entry — emotion tracked in bars on left but not per-event | UX gap | Add small coloured emotion chip/word to each chronicle entry |
| C8 | `heard` text truncated at 120 chars — may cut off mid-sentence mid-year | UX | Increase to 200 or truncate at word boundary |
| C9 | Chronicle panel will overflow with heard + kb added — 4 entries at 38vh is now cramped | Layout | Reduce to 3 entries max, or increase panel height |
| C10 | `#spotlight` only moves on `mousemove` — does not react to audio energy | Polish | Could make it pulse with beat |
| C11 | Solace subscription errors logged to console only — no UI feedback if a topic fails | Debug | Acceptable for now |

---

### bridge/index.js

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| B1 | `stt` module required unconditionally (line 8) even in Solace mode where it is never called | Waste | Conditionally require only when `TRANSPORT !== 'solace'` |
| B2 | STT `init()` only called when `TRANSPORT !== 'solace'` (line 204) — but STT should be independent of transport. In final arch: Solace transport + STT enabled = both running simultaneously | Bug | Decouple STT init from transport check |
| B3 | `/test-chronicle` hardcoded payload (line 182) missing `transcript` and `ragContext` fields — consumer will show empty `heard ·` and `kb ·` rows | Bug | Add dummy transcript and ragContext to test payload |
| B4 | `/solace-config` endpoint exposes Solace credentials to any browser without auth (line 138–144) | Security | Acceptable for demo; for production use env-injected config at build time |
| B5 | No CORS headers on any endpoint | Architecture | Bridge serves producer.html/consumer.html on same origin so not an issue; only matters if CAP is called cross-origin |
| B6 | `BRIDGE_HTTP = 'http://localhost:3001'` defined in producer.html but unused | Dead code | Remove |

---

### bridge/stt.js

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| S1 | Comment on line 1 still says `stt-all.js` (old filename before rename) | Minor | Update comment |
| S2 | References `ATEST/ELEVENLABS_STT_FEASIBILITY.md` in comment (line 3) — file was deleted | Minor | Update comment |
| S3 | `LOG_FILE` writes `transcripts-elevenlabs.log` to bridge directory — on CF this creates a file in the app container | Minor | Acceptable; file is transient and not committed |
| S4 | No retry cap on reconnect — if ElevenLabs is down it retries every 3–5s forever | Minor | Add max retry count or backoff |
| S5 | `forwardToCAP` silently drops if CAP returns non-200 — no retry | Minor | Add one retry for transient CAP errors |

---

### srv/mj-service.js

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| M1 | `keyFigures` tracking list hardcoded to 8 names (line 53–54): MLK, Rosa Parks, Edison, Neil Armstrong, Kennedy, Mandela, Jackie Robinson, Gandhi — misses all new KB figures: Mother Teresa, Chico Mendes, Ryan White, Desmond Tutu, Gandhi, Tank Man, Bob Geldof, etc. | Gap | Expand list to match KB coverage |
| M2 | SQL injection in `ragRetrieve` (lines 147–148): transcript words injected directly into SQL string with `LIKE '%${w}%'` — a crafted transcript could execute arbitrary SQL | Security | Use parameterised queries or sanitise words to `[a-z0-9]` only before interpolation |
| M3 | `actNumber` always stored as `0` (line 302) — never populated | Gap | Derive from dominant emotion: wonder=1, anger=2, grief=3, hope=4 |
| M4 | `sessionMemory` is module-level in-process state — resets on CF app restart | Architecture | Acceptable for demo; add a `/resetSession` endpoint to reset intentionally before each demo run |
| M5 | No Solace reconnect logic — if Solace disconnects, CAP never reconnects | Bug | Add reconnect on `DISCONNECTED` event with backoff |
| M6 | `generateFinale` builds `allInsights` with no length limit — with 65 events in a long session this could exceed Claude context or produce very slow responses | Risk | Cap at last 20 events or summarise earlier acts |
| M7 | `buildMemoryContext()` included twice in `generateFinale` prompt (lines 258 and 260) — `memoryContext` is built then `${buildMemoryContext()}` called again | Bug | Remove the second call, use the `memoryContext` variable |
| M8 | Reflection uses Haiku (via `getModel()`) — fine for between-act sentences, intentional | OK | No change |
| M9 | Model name `claude-haiku-4-5-20251001` — confirm this is still a valid model ID | Check | Verify against Anthropic API docs |
| M10 | Prompt says `"You are an AI witnessing humanity's journey through Michael Jackson's music"` — MJ-specific. Universal pipeline claim says AI doesn't know it's MJ | Design tension | Discussed — keep for now, review later |

---

### bridge/producer.html

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| P1 | `BRIDGE_WS = 'ws://localhost:3001?role=producer'` hardcoded (line 47) | Bug | Make dynamic using `window.location` — `ws://${window.location.host}?role=producer` |
| P2 | `captureStream()` is Chrome-only — Safari and Firefox will throw | Browser compat | Acceptable for demo (Chrome only); add browser check with message |
| P3 | Audio src `/audio-file` serves `vocals.mp3` — correct for now but needs to serve the 4-song demo file | Pending | Update when 4-song audio is ready |

---

### Architecture-level findings

| # | Issue | Severity |
|---|-------|----------|
| A1 | No session reset mechanism — in-memory `sessionMemory` accumulates across multiple demo runs on the same CF instance. Second demo run will have wrong emotional arc and key figure history from first run | Critical for demo |
| A2 | `actNumber` is always 0 — act detection logic exists (`detectActTransition`) but the detected act number is never written back to the persisted event | Gap |
| A3 | Vector embeddings: `embedding` column is `LargeString` not a proper HANA vector type — will need schema migration when we switch to VECTOR_SEARCH | Technical debt |
| A4 | CPI iFlow still calls Claude directly and posts to Solace (bypassing CAP) — unresolved | Pending task 4 |
| A5 | The `keyFigures` in sessionMemory is a fixed list — any figure not in the list is invisible to relational reasoning even if the AI detected them | Gap |

---

### Priority fix order (for next session)

**Must fix before deploy:**
1. C3 — `ws://localhost` in consumer → dynamic
2. P1 — `ws://localhost` in producer → dynamic  
3. C4 — remove dead `connectBridge()` in Solace mode
4. C2 — import Share Tech Mono font
5. C1 — fix hardcoded "BILLIE JEAN" title
6. B3 — fix `/test-chronicle` missing transcript/ragContext fields
7. M5 — add Solace reconnect in CAP
8. M7 — remove duplicate `buildMemoryContext()` call in finale prompt
9. A1 — add `/resetSession` endpoint to CAP
10. M3 — derive actNumber from emotion (wonder=1, anger=2, grief=3, hope=4)

**Fix soon but not blocking deploy:**
11. M1 — expand keyFigures list
12. M2 — sanitise SQL words in ragRetrieve
13. C7 — emotion chip on chronicle entry
14. C9 — cap at 3 entries in chronicle panel

---

### Session summary (2026-05-12) — what was completed today

- Phase 7 complete: CAP + bridge both deployed to BTP CF and running
- CAP start command fix: `cds-serve` (bin/serve.js in @sap/cds)
- CAP auth fix: `cds.requires.auth.kind = "dummy"` (no XSUAA on trial)
- Bridge Solace guard: graceful startup without credentials, then connects after `cf set-env`
- Repo cleanup: 30 → 65 KB events; removed STT research files; renamed stt-all.js → stt.js
- KB expanded: all 4 songs covered with real stats and attributed quotes
- RAG context now visible in consumer: `heard` (raw STT) + `kb` (RAG result) per chronicle entry
- `transcript` + `ragContext` added to Solace `chronicle/event` payload (was missing)
- **Deployed to CF:** Phase 7 complete — bridge + CAP running
**Pending deploy (batch with embeddings):** All changes below

**Changes since last deploy:**
- KB: 30 → 64 events (65 minus 1 duplicate removed), act+emotion columns removed (AI classifies these)
- KB: full factual validation applied — 12 corrections: Treaty of Versailles date/deaths, Edison wording, 13th Amendment date, Hector Pieterson age, Desmond Tutu Nobel year (1984 not 1986), RFK quote corrected to 1966 Cape Town speech, duplicate JFK entry removed, Amazon oxygen claim corrected, Three Mile Island dramatization removed, species extinction figures qualified as estimates, homelessness unverified stat removed
- schema.cds: country/lat/lng added to ChronicleEvents
- mj-service.js: Claude now returns country/lat/lng per event; stored + published to Solace
- mj-service.js: all 10 code review fixes applied (reconnect, resetSession, actNumber, keyFigures, SQL sanitise, etc.)
- consumer.html: 8 cognitive modes (06/07/08 now visible and triggered)
- consumer.html: emotion bars fully dynamic — shows whatever Claude returns, not hardcoded 4
- consumer.html: Share Tech Mono font, dynamic BRIDGE_WS, MJ LIVE title, removed dead connectBridge
- producer.html: dynamic BRIDGE_WS
- bridge/index.js: test-chronicle payload includes transcript+ragContext

---

### Priority 1 — Foundation (blocks everything below)

**1. Knowledge base expansion — COMPLETE ✅**
- 65 events across all 4 songs. HIStory 26 / They Don't Care 13 / Earth Song 14 / Man in the Mirror 12.
- Real statistics throughout. Quotes attributed (Armstrong / RFK / JFK).
- **Committed but not yet deployed to CF** — deploy with task 2+3 as one batch.
- What to add: 10–15 events per song, covering the years/moments MJ sings about, plus key people who appear in the music videos (for RAG to surface them when the AI hears their names)
- Songs to cover fully:
  - HIStory — already partially done, fill gaps
  - They Don't Care About Us — racial injustice, police brutality, invisible communities
  - Earth Song — environmental destruction, species loss, war, children
  - Man in the Mirror — the moment of personal accountability, global compassion
- User will review the people-in-video content separately (keep last)
- **File:** `db/data/mj-HistoryEvents.csv`

**2. Generate and store vector embeddings**
- Current state: `embedding` column exists in schema as `LargeString` but is empty — never populated
- What to do: for each row in HistoryEvents, generate an embedding vector using the Anthropic embedding API (or text-embedding-3-small via OpenAI), store as JSON-serialised array in the `embedding` column
- HANA NLP/Vector engine was provisioned — this is the missing step
- **Depends on:** task 1 (no point embedding an incomplete KB)

**3. Switch ragRetrieve to HANA VECTOR_SEARCH**
- Current state: `ragRetrieve()` in `srv/mj-service.js:138` uses SQL `LIKE '%keyword%'` — keyword match only
- What to do: replace with HANA `VECTOR_SEARCH` using cosine similarity on the `embedding` column against a freshly generated query embedding
- This is what the plan promised — "HANA Vector RAG" not "HANA keyword search"
- **Depends on:** task 2

---

### Priority 2 — Architecture correctness

**4. CPI iFlow update — remove Claude, POST raw transcript to CAP**
- Current state: CPI iFlow calls Claude Haiku + Groovy JSON extraction + Solace REST publish (bypasses CAP entirely)
- What to do: strip the iFlow to just: HTTPS Sender → Content Modifier (wrap body as JSON) → Request Reply → CAP `/odata/v4/mj/receiveTranscript`
- CAP owns all intelligence. CPI is the enterprise relay, not the brain.
- The `"act"` field was already removed from CPI's Claude output schema — but the entire Claude call in CPI needs to go. This is the full resolution of the "we don't need act in CPI Claude" decision: the answer is we don't need Claude in CPI at all.
- **No code dependency** — pure CPI UI change

**5. Run log — full pipeline thinking per session**
- Current state: ChronicleEvents in HANA has per-event data, but no easy way to see a full session at a glance with all pipeline fields
- What to build: a new CAP endpoint `/odata/v4/mj/sessionLog` (or a formatted GET on ChronicleEvents) that returns a table per session: timestamp | transcript | emotion | year | event | insight | ragContext | actNumber
- User wants to see "the full thinking" — what the AI heard, what it retrieved, what it concluded, all in one view
- Could also be a simple HTML page served from the bridge at `/log`

---

### Priority 3 — Demo polish

**6. Consumer: remove hardcoded "Billie Jean" label**
- Currently visible in the consumer UI — the audio file label or some text references Billie Jean
- Update to reflect the actual demo (4-act journey, not a single song)
- **Keep for later**

**7. Audio file — 4-song demo audio**
- Current state: `app/media/billie-jean.mp3` (full track, for local testing) and `app/media/vocals.mp3` (isolated vocal test)
- What's needed: the edited 4-song demo file (HIStory → They Don't Care → Earth Song → Man in the Mirror), continuous, with crossfades as specified in the plan
- This is the actual demo asset — nothing works end-to-end without it
- **Keep for later** — create or source the audio file

**8. Prompt review — MJ-specific vs universal language**
- Current state: `srv/mj-service.js:179` — "You are an AI witnessing humanity's journey through Michael Jackson's music in real time." — MJ is named directly
- The universal pipeline claim says "the AI does not know it is listening to Michael Jackson" — but the system prompt tells it exactly that
- Decision to make: keep MJ-specific (fine for the demo, honest) or generalise (truer to the universal pipeline claim)
- Also: the reflection/finale prompts also reference "Michael Jackson's music" explicitly
- **Keep for later** — low impact, review after everything else works

---

### Priority 4 — Completion

**9. Architecture diagram**
- The full data flow from producer browser → bridge → Solace → CPI → CAP → HANA → Solace → consumer, with each component's one-line role
- For Phase 7 blog section and conference slide

**10. Demo video**
- Full end-to-end recording of the 4-act demo: EQ reacting, cognitive modes animating, chronicle building, reflection appearing, finale landing
- Requires task 7 (4-song audio) to be complete first

**11. Blog post**
- Sections: The Philosophy → Architecture → Code Flow → 8 Cognitive Modes → Phase-by-Phase Build → Demo Video
- Architecture diagram embedded
- Decision log: what was tried, what was rejected, why

---

### Deferred (user-flagged as last)

- Knowledge base: specific people in music videos (user reviewing separately)
- Final lyrics handling — how MJ's actual lyrics appear/bind in the UI
- Consumer UI label fixes beyond "Billie Jean"
- Prompt language review ("AI witnessing humanity" framing)
- **Enable ElevenLabs STT** — set `STT_ENABLED=true` on the CF bridge app via `cf set-env mj-live-bridge STT_ENABLED true` then `cf restage mj-live-bridge`. Do this last — every run consumes ElevenLabs credits. Keep false until the demo is fully validated end-to-end.

---

### Architecture validation — built vs planned

| Component | Planned | Built | Gap |
|-----------|---------|-------|-----|
| Solace AEM — event mesh | ✅ | ✅ | None |
| CPI — enterprise gateway | ✅ | ⚠️ | Still calls Claude directly, should relay to CAP |
| ElevenLabs STT | ✅ | ✅ | STT_ENABLED=false (credits) |
| CAP cognitive pipeline | ✅ | ✅ | None |
| LangChain temporal memory | ✅ | ✅ | None |
| HANA persistence (ChronicleEvents) | ✅ | ✅ | None |
| HANA Vector RAG | ✅ | ❌ | Keyword search only, no embeddings |
| Vector embeddings stored | ✅ | ❌ | embedding column empty |
| Reflection Agent (between-act) | ✅ | ✅ | None |
| Finale Agent (closing reflection) | ✅ | ✅ | None |
| Consumer 3-panel layout | ✅ | ✅ | None |
| Solace publish from CAP | ✅ | ✅ | None |
| BTP CF deployment — bridge + CAP | ✅ | ✅ | None |
| Architecture diagram | ✅ | ❌ | Not created |
| Demo video | ✅ | ❌ | Needs 4-song audio first |

**Two hard gaps:** vector embeddings and the 4-song audio file. Everything else is built or a cleanup task.

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
