require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const EventEmitter = require('events');
const path = require('path');

const sttAll = require('./stt');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const bus = new EventEmitter();

const TRANSPORT = process.env.TRANSPORT || 'local';
console.log(`Transport mode: ${TRANSPORT}`);

// --- Solace transport ---
let solaceConnected = false;

function connectSolace() {
  if (!process.env.SOLACE_URL || !process.env.SOLACE_VPN) {
    console.warn('Solace credentials not set — bridge starting without Solace connection');
    return null;
  }
  const solace = require('solclientjs');
  solace.SolclientFactory.init({ profile: solace.SolclientFactoryProfiles.version10 });

  const session = solace.SolclientFactory.createSession({
    url: process.env.SOLACE_URL,
    vpnName: process.env.SOLACE_VPN,
    userName: process.env.SOLACE_USERNAME,
    password: process.env.SOLACE_PASSWORD,
  });

  session.on(solace.SessionEventCode.UP_NOTICE, () => {
    solaceConnected = true;
    console.log('Solace connected');
  });

  session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, (e) => {
    console.error('Solace connect failed:', e.infoStr);
  });

  session.on(solace.SessionEventCode.DISCONNECTED, () => {
    solaceConnected = false;
    console.log('Solace disconnected');
  });

  session.connect();
  return session;
}

let solaceSession = null;

function publish(topic, payload) {
  if (TRANSPORT === 'solace') {
    if (!solaceConnected) { console.warn('Solace not connected, dropping'); return; }
    const solace = require('solclientjs');
    const msg = solace.SolclientFactory.createMessage();
    msg.setDestination(solace.SolclientFactory.createTopicDestination(topic));
    msg.setSdtContainer(solace.SDTField.create(solace.SDTFieldType.STRING, JSON.stringify(payload)));
    msg.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
    solaceSession.send(msg);
  } else {
    bus.emit(topic, payload);
  }
}

// --- WebSocket: producer (sends audio+EQ) vs consumer (receives events) ---
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const role = url.searchParams.get('role');

  if (role === 'producer') {
    console.log('Producer connected via WebSocket');

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // Raw PCM16 audio — send to ElevenLabs STT only
        // audio/pcm Solace topic removed — ElevenLabs runs in bridge, no subscriber needed
        sttAll.sendPcm(data);
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'eq') {
            publish('audio/equalizer', { bars: msg.bars, ts: msg.ts });
          } else if (msg.type === 'audio_ended') {
            console.log('Audio ended — triggering CAP generateFinale');
            triggerFinale();
          }
        } catch (e) { /* ignore malformed */ }
      }
    });

    ws.on('close', () => console.log('Producer disconnected'));

  } else {
    // Consumer — receives all events via WebSocket
    console.log('Consumer connected, total:', wss.clients.size);

    const send = (topic, payload) => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ topic, data: payload }));
    };

    const onEq       = (p) => send('audio/equalizer',   p);
    const onTranscript = (p) => send('chronicle/transcript', p);
    const onChronicle  = (p) => send('chronicle/event',     p);
    const onFinale     = (p) => send('chronicle/finale',    p);
    const onStatus     = (p) => send('pipeline/status',     p);

    bus.on('audio/equalizer',       onEq);
    bus.on('chronicle/transcript',  onTranscript);
    bus.on('chronicle/event',       onChronicle);
    bus.on('chronicle/finale',      onFinale);
    bus.on('pipeline/status',       onStatus);

    ws.on('close', () => {
      bus.off('audio/equalizer',      onEq);
      bus.off('chronicle/transcript', onTranscript);
      bus.off('chronicle/event',      onChronicle);
      bus.off('chronicle/finale',     onFinale);
      bus.off('pipeline/status',      onStatus);
      console.log('Consumer disconnected, total:', wss.clients.size);
    });
  }
});

// --- Routes ---
app.get('/producer', (req, res) => res.sendFile(path.join(__dirname, 'producer.html')));
app.get('/consumer', (req, res) => res.sendFile(path.join(__dirname, 'consumer.html')));
app.get('/log',      (req, res) => res.sendFile(path.join(__dirname, 'log.html')));

const CAP_BASE = () => (process.env.CAP_URL || 'http://localhost:4004/odata/v4/mj/receiveTranscript').replace('/odata/v4/mj/receiveTranscript', '');

async function waitForSttIdle(maxWaitMs = 30000) {
  sttAll.flushBatch && sttAll.flushBatch(); // send any remaining < 5 transcripts
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (sttAll.isIdle()) return;
    await new Promise(r => setTimeout(r, 500));
  }
  console.warn('Finale: STT queue did not drain in time — proceeding anyway');
}

async function triggerFinale() {
  console.log('Finale: waiting for STT queue to drain...');
  await waitForSttIdle();
  console.log('Finale: queue drained — calling CAP generateFinale');
  try {
    const r = await fetch(`${CAP_BASE()}/odata/v4/mj/generateFinale`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    const json = await r.json();
    if (json.error) { console.error('Finale CAP error:', JSON.stringify(json.error)); return; }
    const data = JSON.parse(json.value || '{}');
    console.log('Finale triggered:', JSON.stringify(data).substring(0, 120));
    if (data.error) { console.error('Finale logic error:', data.error); return; }
    if (data.reflection) {
      bus.emit('chronicle/finale', { reflection: data.reflection });
    } else {
      console.error('Finale: no reflection in response:', JSON.stringify(data));
    }
  } catch (e) {
    console.error('Finale trigger error:', e.message);
  }
}

app.get('/current-session', async (req, res) => {
  try {
    const r = await fetch(`${CAP_BASE()}/odata/v4/mj/currentSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const json = await r.json();
    res.json(JSON.parse(json.value));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/session-log', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    const filter = sessionId ? `&$filter=sessionId eq '${sessionId}'` : '';
    const r = await fetch(`${CAP_BASE()}/odata/v4/mj/ChronicleEvents?$orderby=ts asc&$top=200${filter}`);
    const json = await r.json();
    res.json(json.value || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/reset-session', async (req, res) => {
  try {
    const r = await fetch(`${CAP_BASE()}/odata/v4/mj/resetSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/clear-chronicle', async (req, res) => {
  try {
    const r = await fetch(`${CAP_BASE()}/odata/v4/mj/clearChronicle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/audio-file', (req, res) => res.sendFile(path.join(__dirname, 'vocals.mp3')));
app.get('/worklet', (req, res) => res.sendFile(path.join(__dirname, 'mj-audio-worklet.js')));
app.get('/solace-client.js', (req, res) => res.sendFile(path.join(__dirname, 'node_modules/solclientjs/lib-browser/solclient.js')));
app.get('/solace-config', (req, res) => res.json({
  url:      process.env.SOLACE_URL,
  vpn:      process.env.SOLACE_VPN,
  username: process.env.SOLACE_USERNAME,
  password: process.env.SOLACE_PASSWORD,
  transport: TRANSPORT
}));

// HTTP fallbacks — support cached producer pages that still POST
app.post('/eq', express.json(), (req, res) => {
  const nonZero = req.body.bars ? req.body.bars.filter(b => b > 0).length : 0;
  console.log(`EQ via HTTP: ${nonZero}/${req.body.bars ? req.body.bars.length : 0} non-zero bars`);
  publish('audio/equalizer', req.body);
  res.status(204).end();
});

app.post('/audio', express.raw({ type: 'application/octet-stream', limit: '2mb' }), (req, res) => {
  sttAll.sendPcm(req.body);
  res.status(204).end();
});

app.get('/test-publish', (req, res) => {
  const testPayload = { test: true, source: 'bridge', ts: new Date().toISOString(), msg: 'hello from bridge' };
  publish('test/bridge', testPayload);
  res.json({ published: true, topic: 'test/bridge', payload: testPayload });
});

// ── Inject: paste any sentence → shows in PERCEPTION + full pipeline ──────────
app.post('/inject', express.json(), (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'no text' });
  sttAll.inject(text);
  console.log('[inject]', text);
  res.json({ ok: true, text });
});

app.post('/chronicle-event', express.json(), (req, res) => {
  publish('chronicle/event', req.body);
  res.status(204).end();
});

app.get('/test-chronicle', (req, res) => {
  // Test event — fires a sample chronicle entry to verify consumer display
  const year = req.query.year || '1969';
  const testEvents = {
    '1968': { emotion: 'grief', year: '1968', event: 'Martin Luther King assassinated Memphis Tennessee', insight: 'A prophet is silenced — the dream survives the dreamer.', transcript: '1968 martin luther king assassinated memphis tennessee', ragContext: '1968: Martin Luther King assassinated — April 4 1968. Riots break out in 100 American cities.' },
    '1969': { emotion: 'wonder', year: '1969', event: 'Neil Armstrong walks on the moon', insight: 'Humanity looks up — one small step and everything changes.', transcript: '1969 neil armstrong walks on the moon one small step for man', ragContext: '1969: Neil Armstrong walks on the moon — July 20 1969. Apollo 11 lands. 400000 engineers made it happen.' },
    '1989': { emotion: 'hope', year: '1989', event: 'Berlin Wall falls — families reunited after 28 years', insight: 'The wall falls and humanity exhales together.', transcript: '1989 berlin wall falls east germany reunited', ragContext: '1989: Berlin Wall falls — November 9 1989. East Germans flood the checkpoints. Families separated 28 years reunited.' },
  };
  const payload = testEvents[year] || testEvents['1969'];
  publish('chronicle/event', payload);
  res.json({ published: true, year, payload });
});

app.get('/cap-log', (req, res) => res.json(sttAll.getCapLog ? sttAll.getCapLog() : []));
app.post('/clear-cap-log', (req, res) => { sttAll.clearCapLog && sttAll.clearCapLog(); res.json({ ok: true }); });

app.get('/status', (req, res) => {
  res.json({
    transport: TRANSPORT,
    solaceConnected: TRANSPORT === 'solace' ? solaceConnected : 'n/a',
    clients: wss.clients.size
  });
});

// --- Start ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Bridge running on port ${PORT}`);
  console.log(`Status:   http://localhost:${PORT}/status`);
  console.log(`Producer: http://localhost:${PORT}/producer`);
  console.log(`Consumer: http://localhost:${PORT}/consumer`);
  if (TRANSPORT === 'solace') solaceSession = connectSolace();
  sttAll.init((text, isFinal) => {
    bus.emit('chronicle/transcript', { text, isFinal });
  });
  sttAll.onChronicleEvent((data) => {
    bus.emit('chronicle/event', data);
  });
});
