require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const EventEmitter = require('events');

const path = require('path');

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

// --- Local mock: consumer browser connects via WebSocket ---
wss.on('connection', (ws) => {
  console.log('Consumer connected, total:', wss.clients.size);

  const onEq = (payload) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ topic: 'audio/equalizer', data: payload }));
    }
  };

  bus.on('audio/equalizer', onEq);

  ws.on('close', () => {
    bus.off('audio/equalizer', onEq);
    console.log('Consumer disconnected, total:', wss.clients.size);
  });
});

// --- Routes ---

app.get('/producer', (req, res) => res.sendFile(path.join(__dirname, 'producer.html')));
app.get('/consumer', (req, res) => res.sendFile(path.join(__dirname, 'consumer.html')));
app.get('/audio-file', (req, res) => res.sendFile(path.join(__dirname, '../app/media/billie-jean.mp3')));

app.post('/eq', express.json(), (req, res) => {
  publish('audio/equalizer', req.body);
  res.status(204).end();
});

app.post('/audio', express.raw({ type: 'application/octet-stream', limit: '2mb' }), (req, res) => {
  // Phase 2 — PCM pipeline
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
  console.log(`Status: http://localhost:${PORT}/status`);
  if (TRANSPORT === 'solace') {
    solaceSession = connectSolace();
  }
});
