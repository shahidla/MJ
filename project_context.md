---
name: MJ Project context and architecture
description: Full understanding of the MJ (Michael Jackson / Billie Jean) CAP project — what it does, how it's built, current state, and what's next
type: project
originSessionId: 19006e94-b907-4548-8353-1288b951cab7
---
# MJ Project — Context, Architecture & Progress

**Repo:** https://github.com/shahidla/MJ  
**Local path:** C:\Dev\MJ  
**Stack:** SAP CAP (Node.js), OpenAI Whisper + Realtime API, Web Audio API, D3.js, SAP HANA

---

## What It Does

A real-time audio transcription and visualization demo themed around Michael Jackson's "Billie Jean." The user plays the song in a browser; the audio is analyzed, transcribed by OpenAI AI, and visualized on a separate consumer screen in sync.

---

## Architecture: Producer → CAP Server → Consumer

### Producer (`app/media/mj_producer.html`)
- Plays `billie-jean.mp3` in the browser
- Uses Web Audio API + AudioWorklet (`app/mj-audio-worklet.js`) to capture raw PCM16 audio at 16kHz mono
- Draws a local equalizer bar chart using Web Audio frequency analysis
- Sends two streams to the CAP backend every animation frame:
  - **Equalizer frames** (bar values + song timestamp) → `POST /mj/eq-debug`
  - **Raw PCM audio chunks** (~1 second each) → `POST /mj/audio-debug`

### CAP Backend Server
- **`server.js`**: Receives equalizer frames, stores the latest, re-streams via SSE on `GET /mj/eq-stream` (polls every 200ms)
- **`srv/mj-events.js`**: 
  - Buffers incoming PCM audio until ~3 seconds accumulate
  - Wraps PCM in a WAV header and calls **OpenAI Whisper** (`gpt-4o-transcribe`) for speech-to-text
  - Broadcasts transcript as `{ type: "MJTranscript", text }` to all SSE clients on `GET /mj/stream`
  - Also exposes `POST /mj/notify` (manual push) and `GET /mj/notify-test` (test endpoint)
- **`srv/mj-realtime.js`**:
  - Opens a persistent WebSocket to **OpenAI Realtime API** (`gpt-4o-realtime-preview`)
  - Streams PCM audio and requests text-only transcription responses
  - Manages a single shared session with listener pattern
  - *Note: This module exists but is not yet wired into any HTTP route — it's ready but unused*
- **`config/openai.js`**: Reads `OPENAI_API_KEY` from env; points to realtime WS URL

### Consumer (`app/media/mj_consumer.html`)
- Connects to `GET /mj/eq-stream` via SSE
- Mirrors the equalizer from the producer (same bar data, same color logic)
- Shows a **D3.js lollipop timeline** — reveals historical years (hardcoded list of 15) as the song plays, one every 3 seconds, positioned on a scale axis

### Database (`db/schema.cds`)
- HANA table `MJ_HISTORY_EVENTS` (and view `MJ_HISTORY_EVENTS_V`)
- Schema: `EVENT_ID`, `SONG_NAME`, `LYRIC_TIME_SEC`, `LYRIC_TEXT`, `DATE_TEXT`, `EVENT_DATE`, `CREATED_AT`
- **Purpose:** Store lyric lines matched to song timestamps + historical dates/events
- **`srv/cat-service.js`**: Exposes `MJHistoryEvents` via OData — handler is a stub, no logic yet
- **Status: DB schema is defined but not yet connected to the live demo**

---

## Current State (as of 2026-05-10)

| Component | Status |
|-----------|--------|
| Producer audio tap + equalizer | Working |
| Equalizer SSE to consumer | Working |
| OpenAI Whisper STT pipeline | Working (3s buffer → WAV → transcribe → SSE) |
| Consumer equalizer + D3 timeline | Working (hardcoded years) |
| OpenAI Realtime API module | Built, not wired up |
| MJHistoryEvents DB table | Schema defined, not populated |
| Lyric→history event matching | Not built |
| Consumer showing transcripts | Not built (SSE stream exists, no UI for it) |

---

## What's Next / Planned

A `New Plan` folder exists in the repo root — not yet read. Likely contains the next phase design.

**Obvious gaps to fill based on current code:**
1. **Wire up Realtime API** — replace the Whisper batch approach with the existing `mj-realtime.js` module for lower-latency transcription
2. **Connect transcript to DB** — match incoming lyric text to `MJHistoryEvents` rows by `LYRIC_TEXT` or fuzzy match, return the historical event
3. **Consumer transcript UI** — display incoming `MJTranscript` SSE events on the consumer screen
4. **D3 timeline from DB** — replace hardcoded years with real `EVENT_DATE` values from `MJHistoryEvents` loaded via the CAP OData service
5. **Populate HANA table** — seed `MJ_HISTORY_EVENTS` with Billie Jean lyric timestamps and corresponding historical dates

---

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `server.js` | EQ frame ingestion + SSE stream |
| `srv/mj-events.js` | Audio ingestion, Whisper STT, SSE broadcast |
| `srv/mj-realtime.js` | OpenAI Realtime WS session manager (unused) |
| `srv/cat-service.js` | OData service stub for MJHistoryEvents |
| `srv/mj-events.cds` | Dummy CDS service (placeholder) |
| `srv/cat-service.cds` | Exposes MJHistoryEvents entity |
| `db/schema.cds` | HANA table definitions |
| `app/media/mj_producer.html` | Browser audio producer |
| `app/media/mj_consumer.html` | Browser consumer (EQ + D3 timeline) |
| `app/mj-audio-worklet.js` | AudioWorklet: float→PCM16 conversion + buffering |
| `config/openai.js` | OpenAI API key + realtime URL config |

**Why:** This is a demo project for the user's AI engineering portfolio, showcasing real-time audio + AI integration on SAP CAP infrastructure.

---

---

# NEW PLAN — MJ Live (Decided: 2026-05-10)

> Everything below supersedes the old approach above.
> Old code is reference only. New plan is what gets built.

---

## The Experience

A 1-minute real-time AI tribute to Michael Jackson.
One screen. One URL. One minute. No interaction after pressing play.

```
0s ──────────────── 30s ──────────────── 60s
      Billie Jean         HIStory
      Act 1               Act 2 + Finale
```

The MP3 is one file. Two halves. The screen transitions automatically at 30s.
The old approach used two separate HTML files as two screens. Decision: merge into one page, two acts, CSS transition between them.

---

## The One Screen — Four States

**State 1 — Waiting**
- Black screen, MJ title, one Play button
- Nothing happens until the user presses play
- Audio file is bundled with the static app (billie-jean-history.mp3)

**State 2 — Act 1 (0s to 30s) — Billie Jean**
- Full screen concert visualizer
- Spotlight beams reacting to bass frequencies
- Frequency bars with floor reflection
- Beat pulse rings on kick detection
- Gold particle system
- Progress bar at bottom
- No text. Immersive. Pure visual.
- Driven by: EQ frames from Solace topic `audio/equalizer`

**State 3 — Act 2 (30s to 60s) — HIStory**
- Cinematic fade from visualizer to chronicle layout
- LEFT: year number reveals large and cinematic as MJ sings it
- LEFT BOTTOM: emotion classification bars (grief, power, hope, rage)
- RIGHT: chronicle builds — every year + enriched event text lands and stays
- RIGHT BOTTOM: AI reasoning stream visible — shows thinking step by step
- Driven by: enriched chronicle events from Solace topic `chronicle/event`

**State 4 — Finale (at 60s)**
- Full screen black
- One sentence generated by AI — unrepeatable, never the same twice
- Fades in, holds, fades out
- Driven by: reflection agent output pushed via Solace

---

## Architecture

```
┌─────────────────────────────────────────┐
│  BROWSER (one screen)                   │
│  AudioWorklet → PCM16 16kHz mono        │
│  Subscribes to Solace via WebSocket     │
│  (Solace JS SDK — no SSE, no polling)   │
└────────┬────────────────────────────────┘
         │ publishes via Node.js bridge
         ▼
┌─────────────────────────────────────────┐
│  NODE.JS BRIDGE (BTP Cloud Foundry)     │
│  - serves HTML + audio file             │
│  - holds Solace credentials             │
│  - relays PCM16 → Solace               │
│  - relays EQ frames → Solace           │
│  - no business logic                   │
│  - no SSE (dropped)                    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  SOLACE ADVANCED EVENT MESH (trial)     │
│  topic: audio/equalizer                 │
│  topic: audio/transcription             │
│  topic: chronicle/event  ◄──────────┐  │
└────────┬───────────────────────────────┘
         │                            │
    ┌────┴────┐                       │
    ▼         ▼                       │
┌────────┐ ┌──────────────────────┐   │
│CPI     │ │CPI iFlow 2           │   │
│iFlow 1 │ │- receives PCM16      │   │
│        │ │- wraps → WAV         │   │
│EQ data │ │- calls AssemblyAI    │   │
│→ Screen│ │  streaming API       │   │
│1 via   │ │- gets year + event   │   │
│Solace  │ │  text in transcript  │   │
└────────┘ │- passes to CAP       │   │
           └──────────┬───────────┘   │
                      │               │
                      ▼               │
           ┌──────────────────────┐   │
           │  SAP CAP (BTP CF)    │   │
           │                      │   │
           │  1. receives         │   │
           │     transcript line  │   │
           │                      │   │
           │  2. queries HANA     │   │
           │     Vector Store     │   │
           │     (RAG)            │   │
           │                      │   │
           │  3. LLM call:        │   │
           │     year + event +   │   │
           │     retrieved chunks │   │
           │     → emotion scores │   │
           │     + insight line   │   │
           │                      │   │
           │  4. persists to      │   │
           │     HANA             │   │
           │                      │   │
           │  5. emits enriched   │   │
           │     event → Solace   │───┘
           │     chronicle/event  │
           │                      │
           │  6. at t=60s:        │
           │     reflection agent │
           │     reviews full     │
           │     chronicle →      │
           │     one sentence     │
           │     → Solace finale  │
           └──────────────────────┘
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
| PCM16 → WAV wrapping logic in `mj-events.js` | Move to CPI iFlow 2 | Same logic, different home |
| Producer audio tap + EQ capture | Adapt | Change destination from POST /mj/audio-debug to Solace publish |
| `New Plan/mj-concert-visualizer.html` | Keep as-is — Act 1 UI | Finished, do not redesign |
| `New Plan/mj-ai-vision-demo.html` | Keep as-is — Act 2 UI | Finished, do not redesign |

## What Is Dropped

| Old component | Why dropped |
|---------------|-------------|
| SSE (`/mj/eq-stream`, `/mj/stream`) | Solace WebSocket replaces entirely |
| OpenAI Whisper (`gpt-4o-transcribe`) | AssemblyAI streaming replaces |
| OpenAI Realtime API (`mj-realtime.js`) | AssemblyAI replaces |
| CAP as default scaffold | CAP now has a specific job, not a container for everything |
| D3 hardcoded years | Real transcript-driven years from AssemblyAI |

---

## 6 AI Patterns In Use

| # | Pattern | Where | What It Does |
|---|---------|--------|-------------|
| 1 | Streaming Inference | AssemblyAI | Transcribes PCM16 chunks in real time, sub-300ms, as MJ sings |
| 2 | Parallel Tool Use | CPI iFlow 2 | Transcription and emotion classification run simultaneously, non-blocking |
| 3 | RAG | CAP + HANA Vector | Retrieves deep historical context before LLM call — grounds emotion in real facts |
| 4 | Emotion Classification | LLM via CAP | Classifies emotional weight of each year using enriched retrieved context |
| 5 | Reflection + Pattern Recognition | LLM via CAP at t=60s | Reviews full chronicle, finds thematic connections across all years |
| 6 | Generative Summarisation | LLM via CAP at t=60s | Generates one unrepeatable closing sentence — never the same twice |

Each is a recognised AI architecture pattern. Not six prompt calls — six architectural decisions.

---

## Build Phases

| Phase | What Gets Built | Blog Post |
|-------|----------------|-----------|
| 0 | Solace + CPI trial setup, test one event end to end | The Plumbing |
| 1 | Browser captures audio, publishes PCM16 + EQ to Solace via Node.js bridge | The Signal |
| 2 | Screen Act 1 subscribes to Solace, concert visualizer reacts | The Stage |
| 3 | CPI iFlow 2 calls AssemblyAI, publishes transcript to Solace | The Brain |
| 4 | CAP receives transcript, queries HANA Vector RAG, calls LLM, persists, emits chronicle event | The Intelligence |
| 5 | Screen Act 2 subscribes, years reveal cinematically, chronicle builds, emotion drives visuals | The Chronicle |
| 6 | Reflection agent at 60s, finale sentence, full end-to-end demo | The Finale |
| 7 | Package, Docker, architecture diagram, demo video | The Tribute |

---

## CPI Free Tier Constraint

Free tier = 2 active iFlows maximum. Both slots are used:
- iFlow 1: EQ frames → Screen 1
- iFlow 2: PCM16 → AssemblyAI → CAP

The reflection agent at t=60s cannot be a third iFlow. It runs inside CAP — CAP triggers the LLM call directly when the chronicle is complete. This is the correct separation anyway — reflection is business logic, not integration.

---

## Hosting

| Component | BTP Service |
|-----------|------------|
| HTML + audio file | HTML5 Application Repository (static, free) |
| Node.js bridge | Cloud Foundry (256MB free tier instance) |
| CAP app | Cloud Foundry (256MB free tier instance) |
| HANA + Vector Store | SAP HANA Cloud free tier |
| Audio file | Bundled with static app (Object Store is production pattern) |

---

## The One Rule

Document as you build. Not after.
For every decision: what you chose, what you rejected, why.
That record is the difference between a developer who built something and an architect who designed it.
