// Temporary: bridge calls AssemblyAI streaming directly.
// When CPI iFlow 1 is ready, delete this file and update index.js
// to publish PCM16 to Solace only — CPI takes over from there.

const WebSocket = require('ws');

const API_KEY = process.env.ASSEMBLYAI_API_KEY;
const SAMPLE_RATE = 16000;

let ws = null;
let onTranscript = null; // callback(text, isFinal)
let reconnecting = false;

function connect(onTranscriptCb) {
  if (!API_KEY) {
    console.error('AssemblyAI: ASSEMBLYAI_API_KEY not set');
    return;
  }

  onTranscript = onTranscriptCb;

  ws = new WebSocket(
    `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${SAMPLE_RATE}`,
    { headers: { authorization: API_KEY } }
  );

  ws.on('open', () => {
    console.log('AssemblyAI streaming: connected');
    reconnecting = false;
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.message_type === 'PartialTranscript' && msg.text) {
        onTranscript(msg.text, false);
      } else if (msg.message_type === 'FinalTranscript' && msg.text) {
        onTranscript(msg.text, true);
      }
    } catch (e) {
      console.error('AssemblyAI parse error:', e);
    }
  });

  ws.on('error', (err) => {
    // Swallow — close event will fire and trigger reconnect
    console.warn('AssemblyAI streaming error:', err.message);
  });

  ws.on('close', (code) => {
    console.log('AssemblyAI streaming: closed, code:', code);
    ws = null;
    if (!reconnecting) {
      reconnecting = true;
      setTimeout(() => connect(onTranscript), 2000);
    }
  });
}

function sendPcm(buffer) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  // AssemblyAI expects base64-encoded PCM16
  ws.send(JSON.stringify({ audio_data: buffer.toString('base64') }));
}

function disconnect() {
  reconnecting = true; // prevent auto-reconnect
  if (ws) { ws.close(); ws = null; }
}

module.exports = { connect, sendPcm, disconnect };
