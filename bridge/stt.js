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

let connection       = null;
let onTranscriptCb   = null;
let onChronicleEvCb  = null;

// ── Batch: collect distinct transcript chunks, send every 5 new words ────────
const BATCH_SIZE  = 5;
const transcriptBatch = [];
let lastBatchText = '';

function newWordCount(prev, curr) {
  const pw = prev.trim().split(/\s+/).filter(Boolean);
  const cw = curr.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < pw.length && i < cw.length && pw[i] === cw[i]) i++;
  return cw.length - i;
}

function addToBatch(text) {
  const clean = sanitize(text);
  if (!clean) return;
  if (newWordCount(lastBatchText, clean) < 5) return; // skip if < 5 new words
  lastBatchText = clean;
  transcriptBatch.push(clean);
  console.log(`[batch] ${transcriptBatch.length}/${BATCH_SIZE}: ${clean.substring(0, 60)}`);
  if (transcriptBatch.length >= BATCH_SIZE) {
    const combined = transcriptBatch.splice(0, BATCH_SIZE).join(' ... ');
    lastBatchText = '';
    forwardToCAP(combined);
  }
}

// Call at audio end to flush any remaining partial batch
function flushBatch() {
  if (transcriptBatch.length === 0) return;
  const combined = transcriptBatch.splice(0).join(' ');
  console.log(`[batch] flushing ${transcriptBatch.length} remaining`);
  forwardToCAP(combined);
}

const capCallLog = [];
let capInFlight  = false;
const finalQueue = [];

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
    else {
      console.log('→ CAP [FINAL]:', body);
      try {
        const json = await res.json();
        const data = JSON.parse(json.value || '{}');
        if (data && data.emotion !== undefined && onChronicleEvCb) onChronicleEvCb(data);
      } catch (_) {}
    }
  } catch (e) {
    entry.status = `error: ${e.message}`;
    console.error('CAP error:', e.message);
  } finally {
    capInFlight = false;
    if (finalQueue.length > 0) {
      const next = finalQueue.shift();
      console.log(`Sending queued final (${finalQueue.length} still waiting)`);
      await sendToCAP(next);
    }
  }
}

async function forwardToCAP(text) {
  const body = sanitize(text);
  if (!body) return;
  if (capInFlight) {
    finalQueue.push(body);
    console.log(`CAP in flight — queued (${finalQueue.length} waiting)`);
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
      console.log('[partial]', text);
      logTranscript('partial', text);
      onTranscriptCb && onTranscriptCb(text, false);
      addToBatch(text); // partials batch — only when 5+ new words
    });

    connection.on('committed_transcript', (data) => {
      const text = data.text?.trim();
      if (!text) return;
      console.log('[FINAL]', text);
      logTranscript('FINAL', text);
      onTranscriptCb && onTranscriptCb(text, true);
      // Finals always go to CAP immediately — guaranteed chronicle
      lastBatchText = text; // sync so next partial delta is relative to this
      forwardToCAP(sanitize(text));
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

function isIdle() { return !capInFlight && finalQueue.length === 0 && transcriptBatch.length === 0; }

function inject(text) {
  const clean = sanitize(text);
  if (!clean) return;
  onTranscriptCb && onTranscriptCb(clean, true); // show in PERCEPTION
  forwardToCAP(clean);                            // process through pipeline
}

module.exports = {
  init, sendPcm, flushBatch, isIdle, inject,
  getCapLog:   () => capCallLog,
  clearCapLog: () => { capCallLog.length = 0; },
  onChronicleEvent: (cb) => { onChronicleEvCb = cb; }
};
