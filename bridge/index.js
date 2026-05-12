require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const EventEmitter = require('events');
const path = require('path');

// OpenAI STT comparison — all 4 models in parallel
const sttAll = require('./stt-all');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const bus = new EventEmitter();

const TRANSPORT = process.env.TRANSPORT || 'local';
console.log(`Transport mode: ${TRANSPORT}`);

// --- Solace transport ---
let solaceConnected = false;

function connectSolace() {
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
        // Raw PCM16 audio — forward to transport
        if (TRANSPORT === 'solace') {
          if (!solaceConnected) { console.warn('Solace not connected, dropping PCM chunk'); return; }
          const solace = require('solclientjs');
          const msg = solace.SolclientFactory.createMessage();
          msg.setDestination(solace.SolclientFactory.createTopicDestination('audio/pcm'));
          msg.setBinaryAttachment(data);
          msg.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
          solaceSession.send(msg);
        } else {
          sttAll.sendPcm(data);
        }
      } else {
        // JSON EQ frame
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'eq') {
            publish('audio/equalizer', { bars: msg.bars, ts: msg.ts });
          }
        } catch (e) { /* ignore malformed */ }
      }
    });

    ws.on('close', () => console.log('Producer disconnected'));

  } else {
    // Consumer — receives EQ and transcript events
    console.log('Consumer connected, total:', wss.clients.size);

    const onEq = (payload) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ topic: 'audio/equalizer', data: payload }));
      }
    };

    const onTranscript = (payload) => {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ topic: 'chronicle/transcript', data: payload }));
      }
    };

    bus.on('audio/equalizer', onEq);
    bus.on('chronicle/transcript', onTranscript);

    ws.on('close', () => {
      bus.off('audio/equalizer', onEq);
      bus.off('chronicle/transcript', onTranscript);
      console.log('Consumer disconnected, total:', wss.clients.size);
    });
  }
});

// --- Routes ---
app.get('/producer', (req, res) => res.sendFile(path.join(__dirname, 'producer.html')));
app.get('/consumer', (req, res) => res.sendFile(path.join(__dirname, 'consumer.html')));
app.get('/audio-file', (req, res) => res.sendFile(path.join(__dirname, '../app/media/vocals.mp3')));
app.get('/worklet', (req, res) => res.sendFile(path.join(__dirname, '../app/mj-audio-worklet.js')));

// HTTP fallbacks — support cached producer pages that still POST
app.post('/eq', express.json(), (req, res) => {
  const nonZero = req.body.bars ? req.body.bars.filter(b => b > 0).length : 0;
  console.log(`EQ via HTTP: ${nonZero}/${req.body.bars ? req.body.bars.length : 0} non-zero bars`);
  publish('audio/equalizer', req.body);
  res.status(204).end();
});

app.post('/audio', express.raw({ type: 'application/octet-stream', limit: '2mb' }), (req, res) => {
  if (TRANSPORT === 'solace') {
    if (solaceConnected) {
      const solace = require('solclientjs');
      const msg = solace.SolclientFactory.createMessage();
      msg.setDestination(solace.SolclientFactory.createTopicDestination('audio/pcm'));
      msg.setBinaryAttachment(req.body);
      msg.setDeliveryMode(solace.MessageDeliveryModeType.DIRECT);
      solaceSession.send(msg);
    }
  } else {
    sttAll.sendPcm(req.body);
  }
  res.status(204).end();
});

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
  if (TRANSPORT === 'solace') {
    solaceSession = connectSolace();
  } else {
    sttAll.init((text, isFinal) => {
      bus.emit('chronicle/transcript', { text, isFinal });
    });
  }
});
