const cds = require('@sap/cds');
const { ChatAnthropic } = require('@langchain/anthropic');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { BufferMemory } = require('langchain/memory');
const solace = require('solclientjs');

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

// ── LangChain memory (accumulates across all 4 acts) ───────────────────────
const memory = new BufferMemory({ returnMessages: true, memoryKey: 'history' });

// ── Claude model ────────────────────────────────────────────────────────────
function getModel() {
  return new ChatAnthropic({
    modelName: 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 512,
  });
}

// ── RAG: find closest historical event in HANA ──────────────────────────────
async function ragRetrieve(db, transcript) {
  try {
    // Simple keyword search for now — replace with vector similarity when HANA Vector available
    const words = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const results = await db.run(
      SELECT.from('mj.HistoryEvents')
        .where(words.map(w => `lower(headline) like '%${w}%'`).join(' or '))
        .limit(2)
    );
    if (results.length > 0) {
      return results.map(r => `${r.year}: ${r.headline} — ${r.context}`).join('\n');
    }
    return '';
  } catch (e) {
    console.warn('RAG retrieve error:', e.message);
    return '';
  }
}

// ── Cognitive Pipeline ──────────────────────────────────────────────────────
async function cognitiveProcess(db, transcript) {
  // Mode 3: Contextual Retrieval — query HANA for historical context
  const ragContext = await ragRetrieve(db, transcript);

  // Mode 4: Temporal Memory — load what we've understood so far
  const memoryVars = await memory.loadMemoryVariables({});
  const historyText = memoryVars.history
    ? memoryVars.history.map(m => m.content).join('\n')
    : '';

  // Mode 2 + 5: Classification + Relational Reasoning — Claude with full context
  const model = getModel();
  const systemPrompt = `You are an AI witnessing humanity's journey through Michael Jackson's music.
You have seen these moments before: ${historyText || 'this is the beginning'}.
${ragContext ? `Historical context retrieved: ${ragContext}` : ''}
Classify the emotion from the transcript, extract any year or event, and generate one insight.
Return ONLY valid JSON: {"emotion":"","year":"","event":"","insight":"one sentence"}`;

  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(transcript)
  ]);

  const text = response.content.trim();

  // Parse Claude response
  let result = { emotion: '', year: '', event: '', insight: '' };
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start >= 0) result = JSON.parse(text.substring(start, end));
  } catch (e) {
    console.warn('Claude parse error:', e.message);
  }

  // Mode 4: Update temporal memory
  await memory.saveContext(
    { input: transcript },
    { output: `emotion:${result.emotion} event:${result.event} insight:${result.insight}` }
  );

  return { ...result, ragContext, transcript };
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
        sessionId:  'demo',
        ts:         new Date(),
        transcript,
        emotion:    result.emotion,
        year:       result.year,
        event:      result.event,
        insight:    result.insight,
        ragContext: result.ragContext,
        actNumber:  0
      };
      await INSERT.into(ChronicleEvents).entries(event);
      console.log('CAP: persisted chronicle event');

      // Publish chronicle/event to Solace
      const solacePayload = {
        emotion: result.emotion,
        year:    result.year,
        event:   result.event,
        insight: result.insight
      };
      publishToSolace('chronicle/event', solacePayload);
      console.log('CAP: published to Solace chronicle/event');

      return JSON.stringify(solacePayload);
    });

    await super.init();
  }
};

// Init Solace on startup
initSolace();
