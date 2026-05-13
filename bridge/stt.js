// ElevenLabs scribe_v2_realtime — primary STT for MJ Live
// Path 2: Bridge → ElevenLabs → CAP direct (no CPI, finals only)

require('dotenv').config({ path: '../.env' });

const fs   = require('fs');
const path = require('path');

const API_KEY     = process.env.ELEVENLABS_API_KEY;
const CAP_URL     = process.env.CAP_URL || 'http://localhost:4004/odata/v4/mj/receiveTranscript';
const LOG_FILE    = path.join(__dirname, 'transcripts-elevenlabs.log');
const SAMPLE_RATE = 16000;

function logTranscript(label, text) {
  const line = `[${new Date().toISOString()}] [${label}] ${text}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

let connection     = null;
let onTranscriptCb = null;

// ── Forward committed transcript directly to CAP ─────────────────────────────
const capCallLog = [];
let capInFlight  = false;
let queuedFinal  = null;

function sanitize(text) {
  return text
    .replace(/"/g, "'")
    .replace(/\\/g, '')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500);
}

async function sendToCAP(body) {
  const entry = { ts: new Date().toISOString(), transcript: body, status: null };
  capCallLog.push(entry);
  if (capCallLog.length > 50) capCallLog.shift();
  capInFlight = true;
  try {
    const res = await fetch(CAP_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ transcript: body })
    });
    entry.status = res.ok ? 'ok' : `error ${res.status}`;
    if (!res.ok) console.error('CAP error:', res.status);
    else console.log('→ CAP:', body.substring(0, 80));
  } catch (e) {
    entry.status = `error: ${e.message}`;
    console.error('CAP error:', e.message);
  } finally {
    capInFlight = false;
    if (queuedFinal) {
      const q = queuedFinal; queuedFinal = null;
      console.log('Sending queued final');
      await sendToCAP(q);
    }
  }
}

async function forwardToCAP(text) {
  const body = sanitize(text);
  if (!body) return;
  if (capInFlight) {
    queuedFinal = body; // queue — send after current completes
    console.log('CAP in flight — queuing final');
    return;
  }
  await sendToCAP(body);
}

// ── ElevenLabs connection ────────────────────────────────────────────────────
async function initElevenLabs() {
  if (!API_KEY) { console.error('ElevenLabs: ELEVENLABS_API_KEY not set'); return; }

  const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
  const client = new ElevenLabsClient({ apiKey: API_KEY });

  try {
    connection = await client.speechToText.realtime.connect({
      modelId:     'scribe_v2_realtime',
      audioFormat: 'pcm_16000',
      sampleRate:   SAMPLE_RATE,
    });

    connection.on('session_started', () => {
      console.log('ElevenLabs: session started');
    });

    connection.on('partial_transcript', (data) => {
      const text = data.text?.trim();
      if (!text) return;
      console.log('[partial]', text.substring(0, 80) + (text.length > 80 ? '...' : ''));
      logTranscript('partial', text);
      onTranscriptCb && onTranscriptCb(text, false);
      // Partials go to consumer UI only (mode 01) — not to CAP
    });

    connection.on('committed_transcript', (data) => {
      const text = data.text?.trim();
      if (!text) return;
      console.log('[FINAL]', text.substring(0, 100));
      logTranscript('FINAL', text);
      onTranscriptCb && onTranscriptCb(text, true);
      forwardToCAP(text); // finals only → CAP
    });

    connection.on('error', (err) => {
      console.error('ElevenLabs error:', err?.error ?? err?.message ?? err);
      setTimeout(initElevenLabs, 3000);
    });

    connection.on('close', () => {
      console.log('ElevenLabs: session closed, reconnecting...');
      connection = null;
      setTimeout(initElevenLabs, 3000);
    });

  } catch (e) {
    console.error('ElevenLabs connect error:', e.message);
    setTimeout(initElevenLabs, 5000);
  }
}

function sendToElevenLabs(buffer) {
  if (!connection) return;
  try {
    connection.send({ audioBase64: buffer.toString('base64') });
  } catch (e) {
    console.error('ElevenLabs send error:', e.message);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────
const STT_ENABLED = process.env.STT_ENABLED === 'true';

function init(onTranscript) {
  onTranscriptCb = onTranscript;
  if (!STT_ENABLED) {
    console.log('STT_ENABLED=false — ElevenLabs not connected');
    return;
  }
  fs.writeFileSync(LOG_FILE, '');
  console.log('ElevenLabs: connecting to', CAP_URL);
  initElevenLabs();
}

function sendPcm(buffer) {
  if (!STT_ENABLED) return;
  sendToElevenLabs(buffer);
}

module.exports = { init, sendPcm, getCapLog: () => capCallLog };
