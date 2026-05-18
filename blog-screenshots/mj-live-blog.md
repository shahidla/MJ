# Michael Jackson: AI Cognitive Pipeline on SAP BTP, SAP CAP, ElevenLabs, Claude, HANA DB, Solace

*Shahid · May 2026*

*Tags: SAP BTP · SAP CAP · ElevenLabs · Claude · OpenAI · HANA Cloud · Solace · RAG · Generative AI*

---

## Idea

Most real-time AI demos process text. This one processes music. Michael Jackson's HIStory album opens with a five-minute spoken montage of real historical moments before asking *"What about elephants? What about crying whales? What about killing fields?"* The goal was to build a pipeline that listens in real time, identifies the historical events being referenced, retrieves real knowledge about each one from a knowledge base, builds an emotional arc across the full song, and generates a closing reflection at the end. This project is MJ Live.

---

## Overview

MJ Live is a real-time AI cognitive pipeline deployed on SAP BTP. As the music plays, the system:

- Transcribes audio in real time using ElevenLabs STT
- Batches sentences and forwards them to SAP CAP
- Runs a cognitive pipeline per transcript batch
- Identifies historical events, emotions, figures and geographic coordinates using Claude Haiku
- Retrieves relevant knowledge from a pre-embedded knowledge base using OpenAI embeddings and SAP HANA Cloud
- Publishes each identified event to the consumer UI via Solace
- Generates a closing reflection at the end of the song using Claude Opus

The result is a live display that fills up with real historical events as the music plays. Each event is mapped to the world, classified by emotion, and linked to documented history through RAG (Retrieval-Augmented Generation — the pattern where an AI query is matched against a pre-built knowledge base to retrieve relevant context before generating a response).

---

## Demo

▶ YouTube: [MJ Live Demo](https://www.youtube.com/watch?v=zzM3rBsOQEs)

The video shows the full pipeline running on SAP BTP, from the first historical event in the HIStory speech through Earth Song and Man in the Mirror, ending with the AI's closing reflection.

GitHub: [github.com/shahidla/MJ](https://github.com/shahidla/MJ)

---

## Design Flow

![Architecture Diagram](07-architecture.png)

| Component | Technology | Role |
|---|---|---|
| Producer | Browser | Plays MJ.mp3, streams PCM audio |
| STT | ElevenLabs scribe_v2_realtime | Real-time speech-to-text, partials and finals |
| Bridge | Node.js on BTP CF | Sentence batching, WebSocket server, Solace publisher |
| Cognitive Pipeline | SAP CAP on BTP CF | Cognitive modes, session memory, event dedup |
| Event Classification | Claude Haiku (claude-haiku-4-5) | Historical event identification, emotion, figure, coordinates |
| Finale Reflection | Claude Opus (claude-opus-4-7) | Closing 3-sentence reflection at end of song |
| Embeddings | OpenAI text-embedding-3-small | Per-event query embedding for RAG |
| Knowledge Base | SAP HANA Cloud | 86 historical events (1776 to 1997), pre-computed embeddings, cosine similarity search |
| Messaging | Solace (SAP Event Broker) | Pub/sub from CAP to consumer UI |
| Consumer UI | Vanilla JS, CSS Grid, Canvas | World map, pipeline, chronicle, finale display |

### Main Flow

1. Producer plays MJ.mp3 and streams PCM audio to the Bridge
2. Bridge forwards audio to ElevenLabs via WebSocket
3. ElevenLabs returns partial and final transcripts in real time
4. Bridge extracts completed sentences, groups them in batches of 3 for context, and calls CAP receiveTranscript
5. CAP runs the cognitive pipeline and returns identified events
6. Bridge publishes each event to the consumer UI via Solace topics (chronicle/event, chronicle/finale, pipeline/status)
7. Consumer UI renders the world map, chronicle, pipeline and emotion arc in real time
8. When audio ends, the Bridge triggers generateFinale. CAP calls Claude Opus and publishes the closing reflection

### Cognitive Modes

Modes 1 to 5 run per transcript batch. Modes 7 and 8 run once at the end of the song.

```
Mode 1  -> Transcript received, pipeline starts
Mode 2  -> Claude Haiku identifies events, emotions, figures, coordinates
Mode 3  -> Per-event RAG, each event gets its own targeted KB query
Mode 4  -> Temporal memory, builds context from what was witnessed
Mode 5  -> Relational reasoning, connects figures across events
Mode 6  -> Reflective evaluation (designed for between-act transitions, not implemented)
Mode 7  -> Pattern synthesis, finale preparation
Mode 8  -> Generative expression, Claude Opus writes the closing reflection
```

---

## Technical Implementation

### Sentence Batching

ElevenLabs delivers growing partials as it refines its transcription. Sending each sentence individually to Claude loses context. A short phrase like *"Whatever I sing, that's what I really mean"* produces no historical event without surrounding context.

The Bridge accumulates 3 sentences before calling CAP. It also replaces earlier drafts of the same sentence with the corrected version using prefix matching, preventing the HIStory speech's rapid date montage from filling the batch with intermediate STT corrections.

```javascript
function addToBatch(text) {
  for (const sentence of extractSentences(clean)) {
    if (sentExact.has(sentence)) continue;
    sentExact.add(sentence);
    // Replace earlier draft of same sentence still in batch
    const prefix = sentence.substring(0, Math.min(15, sentence.length));
    const existingIdx = sentenceBatch.findIndex(s =>
      s.startsWith(prefix) || sentence.startsWith(s.substring(0, 15))
    );
    if (existingIdx >= 0) sentenceBatch[existingIdx] = sentence;
    else sentenceBatch.push(sentence);
  }
  if (sentenceBatch.length >= 3) {
    forwardToCAP(sentenceBatch.splice(0, 3).join(' '));
  }
}
```

### Per-Event RAG

Each event identified by Claude gets its own embedding query. This prevents "What about elephants?" and "What about crying whales?" from competing in vector space when they appear in the same sentence.

```javascript
const resultsWithRag = await Promise.all(results.map(async r => {
  const query = r.year
    ? [r.figure, r.year, r.event].filter(Boolean).join(' ')
    : transcript;
  const ragContext = await ragRetrieve(db, query);
  return { ...r, ragContext };
}));
```

A year boost (+0.15) is applied when the KB entry year matches a year explicitly spoken in the transcript:

```javascript
const boost = transcriptYears.includes(kbYear) ? 0.15 : 0;
score = cosineSimilarity(queryVec, JSON.parse(embedding)) + boost;
```

### Event Dedup

The Bridge fires multiple CAP calls in parallel. A race condition occurs when two calls snapshot the dedup state before either registers. Both then persist the same event.

Solved with an inFlightKeys Set. After an event passes the dedup filter, its year and event-text prefix are registered immediately, before the async HANA persist, so concurrent calls see the key:

```javascript
filtered.forEach(r => {
  if (r.year) {
    inFlightKeys.add(`${r.year}|${r.figure||''}`);
    inFlightKeys.add(r.year.toString());
    const ep = (r.event||'').toLowerCase().trim().substring(0, 20);
    if (ep) inFlightKeys.add(`evt:${r.year}:${ep}`);
  }
});
```

### Finale — Claude Opus

The top_p parameter is deprecated on claude-opus-4-7. LangChain sends -1 as a default, causing the call to fail. The finale uses the Anthropic SDK directly:

```javascript
const response = await client.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }]
});
```

The prompt does not prescribe a narrative arc. It gives Claude the raw list of witnessed events and emotional journey, and asks it to find its own thread in exactly 3 standalone sentences.

The system is not specific to Michael Jackson. Any audio that produces historical events through the STT pipeline will generate a corresponding finale. Play the same song twice and the reflection will differ. Play a different song and the AI witnesses different moments, builds a different emotional arc, and asks a different closing question.

---

## Consumer UI

![Consumer Overview](01-consumer-overview.png)

The display has three sections:

**Left column — AI Cognitive Pipeline**
Each mode lights up in gold as the pipeline processes a transcript. In the screenshot below, RAG RETRIEVAL is active and the system has just identified Rosa Parks, 1955. The last result stays visible between calls so the screen is never blank.

![Pipeline Active](02-pipeline-active.png)

**Right column — The Chronicle**
Each identified event appears as a card with the year in large type, the event description, the figure involved, and below it in blue the KB entry retrieved via vector search. In the screenshot below you can see Yuri Gagarin (1961), RFK (1968) and Thomas Edison (1877), each matched to the correct knowledge base entry.

![Chronicle Entries](03-chronicle-entry.png)

**Bottom — Audio Signal + Emotional Arc**
The EQ visualiser shows the live audio signal from the music. The emotion arc builds as a bar chart across the session, showing how the emotional distribution shifts from wonder to anger to grief as the songs progress.

**World map**: every event with geographic coordinates gets a glowing red dot plotted at its location. As the song plays, the map fills up across continents.

**Log Page**

![Log Events](05-log-events.png)

Every event is persisted to SAP HANA. The log page shows the full pipeline output for each event: the transcript heard, Claude's classification, and all 4 KB entries retrieved ranked by cosine similarity.

The CAP Calls tab shows every transcript batch that reached the pipeline, with timestamp and status.

![CAP Calls](06-log-cap-calls.png)

---

## Result

From the BTP demo run: 30 events, no errors, finale generated.

| Year | Event | RAG Match |
|---|---|---|
| 1827 | Beethoven dies | Beethoven KB entry ✓ |
| 1929 | Wall Street Crash | Wall Street KB entry ✓ |
| 1927 | Lindbergh transatlantic flight | Lindbergh KB entry ✓ |
| 1942 | Muhammad Ali born | Ali KB entry ✓ |
| 1947 | Chuck Yeager breaks sound barrier | Yeager KB entry ✓ |
| 1955 | Rosa Parks refuses her bus seat | Rosa Parks KB entry ✓ |
| 1961 | Yuri Gagarin first human in space | Gagarin KB entry ✓ |
| 1969 | Apollo 11 moon landing | Armstrong KB entry ✓ |
| 1968 | MLK assassination + RFK speech | Both KB entries ✓ |
| 1975 | Cambodian genocide | Cambodia KB entry ✓ |
| 1986 | African elephant poaching crisis | Elephant KB entry ✓ |
| 1992 | Somalia famine | Somalia KB entry ✓ |

**Finale — Claude Opus:**

After the last note, the system calls Claude Opus with every event witnessed across the full song and asks it to write a closing reflection in 3 sentences with no prescribed structure. The reflection below is from the BTP demo run.

![Finale Screen](04-finale-screen.png)

> *I used to think witnessing was a passive thing, a kind of standing still while history moved through me. But the desert taught me what the mirror confirmed: that seeing without returning is just another form of looking away. So tell me — after everything I have watched rise and fall and rise again, what good is a witness who never goes back to change the man in the glass?*

---

## What This Shows

This exercise demonstrates a few things about what current AI models can do when composed correctly. Claude Haiku, given only a sentence batch, correctly placed historical events in time and geography without being pre-programmed with answers. The temporal memory across the session means each event is heard in the context of everything before it, not in isolation. The finale prompt gives Claude no template and no narrative. Yet it found a through-line connecting figures and crises from different decades. That result is not reproducible by rule-based systems. It requires a model that can reason across context. The pipeline is straightforward. What the model does inside it is not.

---

## References

- [SAP CAP Documentation](https://cap.cloud.sap)
- [ElevenLabs Scribe v2 Realtime](https://elevenlabs.io)
- [Anthropic Claude API](https://docs.anthropic.com)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Solace PubSub+](https://solace.com)
- [SAP HANA Cloud](https://www.sap.com/products/technology-platform/hana.html)
- GitHub: [github.com/shahidla/MJ](https://github.com/shahidla/MJ)

*This blog post was drafted with the assistance of Claude (Anthropic).*

---

## Conclusion

MJ Live shows how multiple AI and SAP services can be wired together into a real-time cognitive pipeline on SAP BTP. Each design decision came from a specific failure encountered during development: sentence batching fixed the context problem, per-event RAG fixed the vector competition, and inFlightKeys fixed the parallel call race.

The pipeline produced 30 historical events from a 6-minute song play, with correct RAG matches throughout and a closing reflection the AI wrote without a template. What was unexpected was not that the AI identified Rosa Parks or Neil Armstrong. It was that when given only the raw events and no instructions, it asked a question none of us scripted.

The pipeline is not built around Michael Jackson specifically. The knowledge base, the cognitive modes, and the finale prompt are all content-agnostic. MJ Live is the demo. The pipeline is the point.

The source code is on GitHub.

---

## Disclaimer

This is a prototype created for learning and demonstration purposes. Functional gaps and bugs may exist. SAP guidelines, best practices, coding standards, authorisation requirements and performance considerations were not in scope. A real solution would require proper error handling, security checks, resilience measures and alignment with enterprise development standards.
