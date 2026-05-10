# MJ LIVE — Full Project Context v4
## Definitive Document — For Claude Code / VS Code
## Consolidates v1, v2, v3 — this is the only file you need

---

## WHO I AM

I am an SAP Development Architect transitioning into AI. Strong enterprise background — integration patterns, event-driven systems, data flows, SAP BTP. Goal: become an AI Engineer/Architect. I learn by building real things. I document as I build.

**This is one project. One demo. One blog post.**

---

## THE CORE PHILOSOPHY

Michael Jackson never made it about himself. Even when he sang from personal pain, he turned it outward — toward the world, toward the invisible, toward the suffering.

This demo does the same.

The AI is not witnessing MJ's journey. The AI is witnessing **humanity's journey** — through the eyes of a man who never stopped caring about it.

The closing question the AI asks at the end is the question he spent his whole life asking:

**"Did we change?"**

---

## THE EXPERIENCE — ONE DEMO, FOUR ACTS

One continuous audio experience. Four songs. Four emotional movements. Two screens. One AI cognitive pipeline witnessing it all in real time.

### STRUCTURE
- Total runtime: approximately 4-5 minutes
- Two screens running simultaneously throughout
- AI cognitive pipeline active from first note to last silence
- Closing question appears after music ends. Then fade to black.

---

## THE FOUR ACT NARRATIVE

### ACT 1 — HIStory: HUMANITY DREAMS
**Emotion: Wonder**

Humanity at its greatest. The historical dates spoken in the song are the spine — Edison, Lincoln, Rosa Parks, MLK, moon landing, Berlin Wall. Each one is evidence of what this species can be.

- AI state: awe, curiosity, optimism
- Visuals: gold, expanding light, rising particles, orchestral energy
- RAG fires per date — retrieves real historical context from HANA Vector
- LangChain: Perception → Classification → Contextual Retrieval

Key moments to use from this song:
- The opening spoken date sequence
- The chorus declaration of human agency
- The MLK "I have a dream" reference
- The Apollo 8 closing — humanity looking at itself from space
- The full outro date sequence — the spine of the entire narrative

---

### ACT 2 — THEY DON'T CARE ABOUT US: HUMANITY DIVIDES
**Emotion: Anger and Confusion**

The same humanity that achieved everything in Act 1 still produces racism, brutality, invisibility, institutional failure. The AI hits a contradiction it cannot resolve.

MLK appeared in Act 1 as hope. He reappears here as a reminder of broken promise. The AI recognises this. That is a Relational Reasoning moment.

- AI state: confusion shifting to anger
- Visuals: red pulses, distortion, fragmented particles, broken typography, crowd pressure
- RAG retrieves injustice events — contrasted against Act 1 achievements
- LangChain: Relational Reasoning fires — contradiction detected across acts

Key moments to use from this song:
- The opening chaos — disorientation
- The first refrain — the rupture point
- The personal testimony section — humanity made invisible
- The MLK and Roosevelt references — dream invoked in pain
- The final building refrain — collective weight, no resolution

---

### ACT 3 — EARTH SONG: HUMANITY DAMAGES THE WORLD
**Emotion: Grief**

The conflict spreads beyond people. The planet itself is wounded. Human division became planetary destruction. The "what about us" is no longer just people asking — it is the Earth asking.

This is the emotional climax of the entire demo.

- AI state: grief, overwhelm
- Visuals: burning, ash, storms, ocean pulses, slow devastation
- RAG retrieves environmental data, species loss, war casualties, child mortality
- LangChain: heaviest RAG load of the demo — each named item triggers retrieval

Key moments to use from this song:
- The opening questions — soft, searching
- The turn — realisation hitting
- "I used to dream, I used to glance beyond the stars" — lost innocence
- The cascade — rapid specific losses named one after another
- "Do we give a damn" — final unanswered question

---

### ACT 4 — MAN IN THE MIRROR: HUMANITY LOOKS INWARD
**Emotion: Hope**

After witnessing history, division, and destruction — the AI arrives where MJ always arrived. Change cannot begin globally. It begins with one person looking at themselves.

The scale shifts deliberately from civilisation to one human face in a mirror.

- AI state: quiet hope, resolution
- Visuals: warm light, slow particles, mirror reflections, healing colours
- RAG retrieves stories of individuals who changed the world — hope grounded in reality
- LangChain: Reflection Agent + Generative Expression — the closing question

Key moments to use from this song:
- The opening declaration
- The street observation — seeing suffering, choosing not to look away
- The mirror moment — the chorus
- The building urgency — "stand up"
- Let the song fade naturally — do not cut it

---

## ACT TRANSITIONS — AI SPEAKS

Between each act, after the music crossfades, the AI generates one sentence from what it just witnessed. Not scripted. Generated live by the Reflection Agent.

- After Act 1 → AI reflects on human potential. Tone: awe with a question forming.
- After Act 2 → AI reflects on contradiction. Tone: confusion, not accusation.
- After Act 3 → AI reflects on consequence. Tone: grief, quiet.
- After Act 4 → AI generates the closing question. Tone: still. Final.

Then silence. Then: **"Did we change?"**

---

## AUDIO EDIT GUIDE

### 1-Minute Demo Version (conference / live demo)
- Act 1 — 15 sec: The outro date sequence from HIStory
- Act 2 — 15 sec: The climax refrain from They Don't Care About Us
- Act 3 — 15 sec: The "what about us" cascade from Earth Song
- Act 4 — 15 sec: The "make that change" close from Man in the Mirror

### Full Version (blog / YouTube)
- Each act 60-90 seconds
- Use key emotional moments described above
- Crossfade lengths: Act1→2: 2s abrupt. Act2→3: 1s sharp. Act3→4: 3s slow.

### Tools
Audacity (free), GarageBand (Mac), or Adobe Audition. Edit audio first, lock timeline, then map AI trigger timestamps.

---

## TWO SCREENS

### Screen 1 — The Stage (mj-concert-visualizer.html) ✅ BUILT
- Concert-grade WebGL audio visualizer
- Spotlight beams react to bass
- Frequency bars with floor reflection
- Beat pulse rings on kick detection
- Emotion-driven particle system and colour palette
- Gold aesthetic throughout

### Screen 2 — The Chronicle (mj-ai-vision-demo.html) ✅ BUILT
- Left: year/event reveals cinematically as AI detects it
- Right: chronicle builds and stays — every moment accumulated
- AI reasoning stream visible — shows cognitive pipeline thinking
- Emotion classification bars
- Background and particles shift per emotional state
- At the end: AI closing question appears. Fade to black.

**These files are finished. Do not redesign them.**

---

## FULL TECHNICAL STACK

| Layer | Tool | Why |
|---|---|---|
| Transcription | AssemblyAI (free — $50 credit) | Sub-300ms streaming, LeMUR emotion in one call |
| Cognitive Orchestration | LangChain | Chains 8 cognitive modes, manages memory, runs agents |
| Agents | LangChain Agents | Reflection Agent + Finale Agent |
| LLM | Claude / OpenAI | Powers all LangChain chains and agents |
| Vector Store | SAP HANA Vector Engine | Enterprise RAG — historical event embeddings |
| Application Layer | SAP CAP | Enterprise backend, OData, business logic |
| Integration | SAP BTP CPI | Governed AI gateway, retry, audit, monitoring |
| Events | Solace Advanced Event Mesh | Real-time pub/sub, topic routing, guaranteed delivery |
| Frontend | Two HTML files above | Already built |
| Dev | VS Code + Claude Code Pro | Primary build tool |

---

## ARCHITECTURE DIAGRAM

```
[Audio File — 4 Songs / 4 Acts]
              ↓
[Browser Audio Capture]
              ↓
[Solace PubSub+ — Event Broker]
         /              \
[Topic: audio/eq]    [Topic: audio/transcription]
         |                      |
[CPI iFlow 1]            [CPI iFlow 2]
Frequency data           AssemblyAI → LangChain
         |                      |
[Screen 1 Visualizer]   [LangChain Cognitive Pipeline]
                                |
                    ┌───────────────────────┐
                    │  1. Perception        │
                    │  2. Classification    │
                    │  3. Contextual RAG ←──┼── HANA Vector
                    │  4. Temporal Memory   │
                    │  5. Relational Reason │
                    │  6. Reflective Eval   │
                    │  7. Pattern Synthesis │
                    │  8. Generative Expr   │
                    └───────────┬───────────┘
                                ↓
                    [Solace: chronicle/events]
                                ↓
                    [Screen 2 — The Chronicle]
```

---

## THE 8 AI COGNITIVE MODES

| # | Mode | What It Does | LangChain Component |
|---|---|---|---|
| 1 | Perception | Hears live audio, receives transcript | AssemblyAI → LangChain input |
| 2 | Classification | Identifies emotion per moment | LLMChain — classification prompt |
| 3 | Contextual Retrieval | Pulls historical context from HANA Vector | RetrievalQA chain |
| 4 | Temporal Memory | Accumulates understanding across all four acts | ConversationBufferMemory |
| 5 | Relational Reasoning | Connects contradictions across acts | LLMChain — reasoning prompt |
| 6 | Reflective Evaluation | Processes what it witnessed, speaks between acts | Reflection Agent |
| 7 | Pattern Synthesis | Finds themes across full narrative | Finale Agent — pattern tool |
| 8 | Generative Expression | Produces unrepeatable closing question | Finale Agent — generation tool |

These are not eight prompt calls. Each is a distinct cognitive mode. Together they form a pipeline that mirrors human processing of a profound experience.

---

## BUILD PHASES

| Phase | What Gets Built | Blog Section |
|---|---|---|
| 0 | Solace + CPI + CAP + HANA trial setup, test event end to end | The Foundation |
| 1 | Audio capture → Solace → Screen 1 visualizer reacts | The Signal & Stage |
| 2 | CPI → AssemblyAI → LangChain Perception + Classification | The Brain |
| 3 | HANA Vector embeddings + LangChain RAG retrieval | The Memory |
| 4 | LangChain Temporal Memory + Relational Reasoning across acts | The Reasoning |
| 5 | Screen 2 subscribes, four acts reveal cinematically | The Chronicle |
| 6 | Reflection Agent + Finale Agent + closing question | The Conscience |
| 7 | Package, architecture diagram, demo video, blog publish | The Tribute |

**One demo. One blog post with sections. Not eight separate posts.**

---

## THE ONE RULE

**Document as you build. Not after.**

For every decision write one paragraph:
- What you chose
- What you considered and rejected
- Why

That thinking record is what separates an architect from a developer.

---

## WHAT SUCCESS LOOKS LIKE

Walk into any room and answer:
- Why AssemblyAI over Whisper?
- Why LangChain for cognitive orchestration?
- Why HANA Vector over Pinecone or Chroma?
- Why Solace and not WebSockets?
- Why CPI as the gateway and not direct API calls?
- What are the 8 cognitive modes and why those eight?
- How does memory change the AI's interpretation across acts?
- How does this system fail gracefully?

---

## INSTRUCTIONS FOR CLAUDE CODE

- Read this entire file before touching any code
- Do not remove or simplify SAP BTP CPI, Solace, CAP, HANA Vector, or LangChain
- Do not suggest plain Node.js as a replacement for the enterprise stack
- The two HTML files are finished UI — do not redesign unless explicitly asked
- Every AI component must map to a named cognitive mode from the table above
- LangChain is the cognitive layer. CPI is the enterprise gateway. These roles never merge.
- Build one phase at a time. Ask which phase before writing any code.
- Respect Michael Jackson throughout — this is a tribute, not a tech toy
- The narrative is about humanity, not about MJ personally
- The closing question is always: **"Did we change?"** — never alter this
- This is one demo and one blog post — do not scope creep into multiple projects

---

*In memory of Michael Jackson — 1958 to 2009*
*He sang for the world. This demo does the same.*
