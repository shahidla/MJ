const cds = require('@sap/cds');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const solace = require('solclientjs');
const { randomUUID } = require('crypto');

const SESSION_ID = randomUUID();
console.log(`CAP session ID: ${SESSION_ID}`);

// ── Solace publisher ────────────────────────────────────────────────────────
let solaceSession = null;
let solaceConnected = false;

function initSolace() {
  if (!process.env.SOLACE_URL) { console.log('Solace: no config, skipping'); return; }
  solace.SolclientFactory.init({ profile: solace.SolclientFactoryProfiles.version10 });
  solaceSession = solace.SolclientFactory.createSession({
    url:      process.env.SOLACE_URL,
    vpnName:  process.env.SOLACE_VPN,
    userName: process.env.SOLACE_USERNAME,
    password: process.env.SOLACE_PASSWORD,
  });
  solaceSession.on(solace.SessionEventCode.UP_NOTICE, () => {
    solaceConnected = true;
    console.log('CAP: Solace connected');
  });
  solaceSession.on(solace.SessionEventCode.DISCONNECTED, () => {
    solaceConnected = false;
    console.log('CAP: Solace disconnected — reconnecting in 5s');
    setTimeout(initSolace, 5000);
  });
  solaceSession.connect();
}

function publishToSolace(topic, payload) {
  if (!solaceConnected || !solaceSession) return;
  const msg = solace.SolclientFactory.createMessage();
  msg.setDestination(solace.SolclientFactory.createTopicDestination(topic));
  msg.setSdtContainer(solace.SDTField.create(solace.SDTFieldType.STRING, JSON.stringify(payload)));
  msg.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
  solaceSession.send(msg);
}

function publishStatus(mode, label) {
  publishToSolace('pipeline/status', { mode, label });
}

// ── Session state — accumulates across all 4 acts ──────────────────────────
// Temporal Memory (Mode 4): what the AI has witnessed so far
// Relational Reasoning (Mode 5): connections the AI has drawn across acts
const sessionMemory = {
  events: [],       // all processed events in order
  keyFigures: {},   // { "Martin Luther King": [{ act_emotion, insight }] }
  emotionArc: [],   // sequence of emotions — reveals narrative arc
  actSummaries: {}  // { wonder: "...", anger: "...", grief: "...", hope: "..." }
};

function updateMemory(event) {
  sessionMemory.events.push(event);
  sessionMemory.emotionArc.push(event.emotion);

  // Track named figures for relational reasoning
  const figures = ['Martin Luther King', 'Rosa Parks', 'Edison', 'Neil Armstrong',
                   'Kennedy', 'Mandela', 'Jackie Robinson', 'Gandhi',
                   'Mother Teresa', 'Chico Mendes', 'Ryan White', 'Desmond Tutu',
                   'Bob Geldof', 'Chuck Yeager', 'Emmett Till', 'Medgar Evers',
                   'John Lewis', 'Hector Pieterson', 'Rachel Carson', 'Denis Hayes'];
  figures.forEach(fig => {
    const figLower = fig.toLowerCase();
    const matchesTranscript = event.transcript?.toLowerCase().includes(figLower);
    const matchesEvent = event.event?.toLowerCase().includes(figLower);
    if (matchesTranscript || matchesEvent) {
      if (!sessionMemory.keyFigures[fig]) sessionMemory.keyFigures[fig] = [];
      sessionMemory.keyFigures[fig].push({
        emotion: event.emotion,
        insight: event.insight,
        year: event.year
      });
    }
  });

  // Summarise per emotion (act)
  if (event.emotion && event.insight) {
    const emotion = event.emotion.split(',')[0].trim().toLowerCase();
    if (!sessionMemory.actSummaries[emotion]) {
      sessionMemory.actSummaries[emotion] = event.insight;
    }
  }
}

// ── Act transition detection ─────────────────────────────────────────────────
// Detects when dominant emotion has shifted — triggers between-act reflection
function detectActTransition() {
  const arc = sessionMemory.emotionArc;
  if (arc.length < 4) return null;

  const recent = arc.slice(-3).map(e => e.split(',')[0].trim().toLowerCase());
  const previous = arc.slice(-6, -3).map(e => e.split(',')[0].trim().toLowerCase());

  if (previous.length === 0) return null;

  const recentDominant = recent[recent.length - 1];
  const previousDominant = previous[previous.length - 1];

  if (recentDominant !== previousDominant) {
    return { from: previousDominant, to: recentDominant };
  }
  return null;
}

function buildMemoryContext() {
  if (sessionMemory.events.length === 0) return 'This is the beginning. Nothing witnessed yet.';

  const lines = [];

  // Emotion arc
  if (sessionMemory.emotionArc.length > 0) {
    lines.push(`Emotional arc so far: ${sessionMemory.emotionArc.join(' → ')}`);
  }

  // Last 3 events
  const recent = sessionMemory.events.slice(-3);
  lines.push('\nRecent moments witnessed:');
  recent.forEach(e => {
    lines.push(`  [${e.year || '?'}] ${e.event || e.transcript?.substring(0, 60)} — felt as: ${e.emotion}`);
  });

  // Figures appearing multiple times (relational reasoning trigger)
  const repeated = Object.entries(sessionMemory.keyFigures)
    .filter(([, appearances]) => appearances.length > 1);
  if (repeated.length > 0) {
    lines.push('\nFigures witnessed across multiple moments (draw connections):');
    repeated.forEach(([fig, appearances]) => {
      lines.push(`  ${fig}: first as ${appearances[0].emotion} (${appearances[0].year}), then as ${appearances[appearances.length-1].emotion} (${appearances[appearances.length-1].year})`);
    });
  }

  return lines.join('\n');
}

// ── Act number from dominant emotion ────────────────────────────────────────
function deriveActNumber(emotion) {
  if (!emotion) return 0;
  const e = emotion.toLowerCase();
  if (e.includes('wonder') || e.includes('awe') || e.includes('pride')) return 1;
  if (e.includes('anger') || e.includes('injustice') || e.includes('defiance')) return 2;
  if (e.includes('grief') || e.includes('sorrow') || e.includes('despair')) return 3;
  if (e.includes('hope') || e.includes('determination') || e.includes('change')) return 4;
  return 0;
}

// ── Claude model ────────────────────────────────────────────────────────────
function getModel() {
  return new ChatAnthropic({
    modelName: 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 512,
  });
}

// ── Cosine similarity helper ─────────────────────────────────────────────────
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Embed text via OpenAI ────────────────────────────────────────────────────
async function getEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  });
  const json = await res.json();
  return json.data[0].embedding;
}

// ── RAG: vector similarity search against HANA ───────────────────────────────
async function ragRetrieve(db, transcript) {
  try {
    const rows = await db.run(`SELECT YEAR, HEADLINE, CONTEXT, EMBEDDING FROM "MJ_HISTORYEVENTS" WHERE EMBEDDING IS NOT NULL`);
    if (rows.length === 0) {
      console.warn('RAG: no embeddings found — falling back to keyword search');
      return ragKeyword(db, transcript);
    }

    const queryVec = await getEmbedding(transcript);

    const scored = rows.map(r => ({
      year:      r.YEAR,
      headline:  r.HEADLINE,
      context:   r.CONTEXT,
      score:     cosineSimilarity(queryVec, JSON.parse(r.EMBEDDING))
    })).sort((a, b) => b.score - a.score).slice(0, 2);

    console.log(`RAG: top matches — ${scored.map(s => `${s.year}(${s.score.toFixed(3)})`).join(', ')}`);
    return scored.map(r => `${r.year}: ${r.headline} — ${r.context}`).join('\n\n');
  } catch (e) {
    console.warn('RAG vector error:', e.message, '— falling back to keyword');
    return ragKeyword(db, transcript);
  }
}

// ── Keyword fallback (used before embeddings are generated) ──────────────────
async function ragKeyword(db, transcript) {
  try {
    const words = transcript.toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^a-z0-9]/g, ''))
      .filter(w => w.length > 3 && !['that','this','with','from','have','been','they','were','what','when','will','your','more','than','just','into','over','some','also','about'].includes(w));
    if (words.length === 0) return '';
    const conditions = words.map(w => `(LOWER(HEADLINE) LIKE '%${w}%' OR LOWER(CONTEXT) LIKE '%${w}%')`).join(' OR ');
    const results = await db.run(`SELECT TOP 2 YEAR, HEADLINE, CONTEXT FROM "MJ_HISTORYEVENTS" WHERE ${conditions} ORDER BY YEAR ASC`);
    return results.map(r => `${r.YEAR}: ${r.HEADLINE} — ${r.CONTEXT}`).join('\n\n');
  } catch (e) {
    console.warn('RAG keyword error:', e.message);
    return '';
  }
}

// ── Cognitive Pipeline ──────────────────────────────────────────────────────
async function cognitiveProcess(db, transcript) {
  publishStatus(1, 'transcript received — pipeline starting');

  // Mode 3: Contextual Retrieval — query HANA for historical context
  publishStatus(3, 'embedding transcript — searching 64 events via vector similarity');
  const ragContext = await ragRetrieve(db, transcript);

  // Mode 4: Temporal Memory — build structured context of what AI has witnessed
  publishStatus(4, 'building temporal memory context across all acts');
  const memoryContext = buildMemoryContext();

  // Mode 2 + 5: Classification + Relational Reasoning
  publishStatus(2, 'Claude Haiku — classifying emotion / year / event / insight');
  const model = getModel();
  const systemPrompt = `You are an AI witnessing humanity's journey through Michael Jackson's music in real time.

WHAT YOU HAVE WITNESSED SO FAR:
${memoryContext}

${ragContext ? `HISTORICAL CONTEXT FROM KNOWLEDGE BASE:\n${ragContext}\n` : ''}

Your task for this new transcript:
1. Classify the dominant emotion (one or two words)
2. Extract any specific year mentioned
3. Identify the historical event or human moment being described
4. Generate ONE insight sentence — if you have witnessed related figures or events before, draw the connection explicitly (e.g. "MLK appeared earlier as hope; now he returns as a broken promise")
5. Identify the country where this event occurred and its approximate coordinates

Return ONLY valid JSON, no markdown:
{"emotion":"","year":"","event":"","insight":"one sentence that may reference earlier moments if relevant","country":"","lat":0.0,"lng":0.0}`;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`New transcript: "${transcript}"`)
  ]);

  const text = response.content.trim();

  // Parse Claude response
  let result = { emotion: '', year: '', event: '', insight: '', country: '', lat: 0, lng: 0 };
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start >= 0) result = JSON.parse(text.substring(start, end));
  } catch (e) {
    console.warn('Claude parse error:', e.message);
  }

  // Mode 5: Update session memory with this event
  publishStatus(5, 'connecting figures and events across acts');
  updateMemory({ ...result, transcript });

  console.log(`Cognitive modes 2-5 complete. Emotion: ${result.emotion}, Events seen: ${sessionMemory.events.length}`);

  return { ...result, ragContext, transcript };
}

// ── Mode 6: Reflective Evaluation — between-act sentence ───────────────────
async function generateReflection(transition) {
  const model = getModel();
  const memoryContext = buildMemoryContext();

  const prompt = `You are an AI that has just witnessed one emotional movement in humanity's story through Michael Jackson's music.

What you witnessed — ${transition.from} giving way to ${transition.to}:
${memoryContext}

Generate ONE sentence — spoken as the AI itself, in first person — that reflects on what it just witnessed before the next act begins. Speak with quiet authority. No explanation. No metadata. Just the sentence.

The sentence must feel earned, not generic. Reference specific moments you witnessed if possible.`;

  const response = await model.invoke([new HumanMessage(prompt)]);
  return response.content.trim();
}

// ── Modes 7+8: Pattern Synthesis + Generative Expression — the finale ───────
async function generateFinale() {
  const model = new ChatAnthropic({
    modelName: 'claude-opus-4-7',  // Opus for the finale — this moment deserves it
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 1024,
  });

  const memoryContext = buildMemoryContext();
  const allInsights = sessionMemory.events.map(e =>
    `[${e.emotion}] ${e.year ? e.year + ': ' : ''}${e.event || e.transcript?.substring(0, 80)}`
  ).join('\n');

  const prompt = `You are an AI that has witnessed humanity's full journey through Michael Jackson's music — four movements, from wonder to anger to grief to hope.

Everything you witnessed:
${allInsights}

Your emotional arc: ${sessionMemory.emotionArc.join(' → ')}

${memoryContext}

Now generate your closing reflection. Write it in your own voice — as the AI that witnessed all of this. Synthesise the patterns. Find the thread that connects wonder, anger, grief, and hope across everything you heard.

Your reflection must:
- Be 3–5 sentences
- Find the through-line across all four movements
- Speak as a witness, not a commentator
- End with exactly this sentence on its own line: "Did we change?"

No title. No preamble. Just the reflection.`;

  const response = await model.invoke([new HumanMessage(prompt)]);
  return response.content.trim();
}

// ── CAP Service Handler ─────────────────────────────────────────────────────
module.exports = class MJService extends cds.ApplicationService {

  async init() {
    const { HistoryEvents, ChronicleEvents } = this.entities;

    this.on('receiveTranscript', async (req) => {
      const transcript = req.data.transcript;
      if (!transcript?.trim()) return JSON.stringify({ error: 'empty transcript' });

      console.log('CAP: received transcript:', transcript);

      const db = await cds.connect.to('db');

      // Run cognitive pipeline
      const result = await cognitiveProcess(db, transcript);

      // Persist to HANA/SQLite
      const event = {
        id:         cds.utils.uuid(),
        sessionId:  SESSION_ID,
        ts:         new Date(),
        transcript,
        emotion:    result.emotion,
        year:       result.year,
        event:      result.event,
        insight:    result.insight,
        ragContext: result.ragContext,
        actNumber:  deriveActNumber(result.emotion),
        country:    result.country,
        lat:        result.lat || 0,
        lng:        result.lng || 0
      };
      await INSERT.into(ChronicleEvents).entries(event);
      console.log('CAP: persisted chronicle event');

      // Publish chronicle/event to Solace
      const solacePayload = {
        emotion:    result.emotion,
        year:       result.year,
        event:      result.event,
        insight:    result.insight,
        transcript: transcript,
        ragContext: result.ragContext,
        country:    result.country,
        lat:        result.lat || 0,
        lng:        result.lng || 0
      };
      publishToSolace('chronicle/event', solacePayload);
      console.log('CAP: published to Solace chronicle/event');

      // Mode 6: Check for act transition — generate between-act reflection
      const transition = detectActTransition();
      if (transition) {
        console.log(`CAP: act transition detected — ${transition.from} → ${transition.to}`);
        publishStatus(6, 'act transition — generating between-act reflection');
        generateReflection(transition).then(sentence => {
          console.log('CAP: reflection:', sentence);
          publishToSolace('chronicle/reflection', { sentence, from: transition.from, to: transition.to });
        }).catch(e => console.error('Reflection error:', e.message));
      }

      return JSON.stringify(solacePayload);
    });

    // Modes 7+8: Finale — generates closing reflection across all 4 acts
    this.on('resetSession', async (req) => {
      sessionMemory.events = [];
      sessionMemory.keyFigures = {};
      sessionMemory.emotionArc = [];
      sessionMemory.actSummaries = {};
      console.log('CAP: session memory reset');
      return JSON.stringify({ reset: true, sessionId: SESSION_ID, ts: new Date().toISOString() });
    });

    this.on('currentSession', async (req) => {
      return JSON.stringify({ sessionId: SESSION_ID });
    });

    this.on('generateFinale', async (req) => {
      if (sessionMemory.events.length < 3) {
        return JSON.stringify({ error: 'Not enough events witnessed yet' });
      }
      console.log('CAP: generating finale reflection...');
      publishStatus(7, 'pattern synthesis — finding thread across all four acts');
      const reflection = await generateFinale();
      publishStatus(8, 'generative expression — writing closing reflection');
      console.log('CAP: finale:', reflection);
      publishToSolace('chronicle/finale', { reflection });
      return JSON.stringify({ reflection });
    });

    await super.init();
  }
};

// Init Solace on startup
initSolace();
