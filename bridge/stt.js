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
let sessionReady     = false;
let onTranscriptCb   = null;
let onChronicleEvCb  = null;

// ── Partials → sentence batching → CAP + PERCEPTION display ─────────────────
// Accumulate 3 sentences before sending so Claude gets context across adjacent sentences.
// Finals → full text → CAP (guaranteed catch-all for end of audio).
const sentExact = new Set();
const sentenceBatch = [];
const BATCH_SIZE = 3;

function extractSentences(text) {
  return text.split(/(?<=[.?!]['"]?)\s+/).map(s => s.trim()).filter(s => /[.?!]['"]?$/.test(s) && s.length > 4);
}

function addToBatch(text) {
  const clean = sanitize(text);
  if (!clean) return;
  for (const sentence of extractSentences(clean)) {
    if (sentExact.has(sentence)) continue;
    if (sentence.length < 15) { sentExact.add(sentence); continue; } // skip trivial
    sentExact.add(sentence);
    // Replace earlier draft of same sentence still in batch (STT self-corrects)
    const prefix = sentence.substring(0, Math.min(15, sentence.length));
    const existingIdx = sentenceBatch.findIndex(s =>
      s.startsWith(prefix) || sentence.startsWith(s.substring(0, Math.min(15, s.length)))
    );
    if (existingIdx >= 0) {
      sentenceBatch[existingIdx] = sentence; // upgrade to latest version
    } else {
      sentenceBatch.push(sentence);
    }
  }
  if (sentenceBatch.length >= BATCH_SIZE) {
    forwardToCAP(sentenceBatch.splice(0, BATCH_SIZE).join(' '));
  }
}

function flushBatch() {
  if (sentenceBatch.length > 0) {
    forwardToCAP(sentenceBatch.splice(0).join(' '));
  }
  sentExact.clear();
  if (connection && sessionReady) {
    try { connection.commit(); console.log('STT: forced commit on audio end'); } catch (_) {}
  }
}

const capCallLog = [];
const MAX_CONCURRENT = parseInt(process.env.CAP_MAX_CONCURRENT || '3');
let capInFlightCount = 0;
const finalQueue = [];

function sanitize(text) {
  return text
    .replace(/"/g, "'")
    .replace(/\\/g, '')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 3000);
}

async function sendToCAP(body) {
  const entry = { ts: new Date().toISOString(), transcript: body, status: null };
  capCallLog.push(entry);
  if (capCallLog.length > 50) capCallLog.shift();
  capInFlightCount++;
  try {
    const res = await fetch(CAP_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ transcript: body })
    });
    entry.status = res.ok ? 'ok' : `error ${res.status}`;
    if (!res.ok) console.error('CAP error:', res.status);
    else {
      console.log(`→ CAP [${capInFlightCount} in flight]:`, body.substring(0, 80));
      try {
        const json = await res.json();
        const raw = JSON.parse(json.value || '[]');
        const events = Array.isArray(raw) ? raw : (raw.emotion !== undefined ? [raw] : []);
        events.forEach(data => {
          if (data && data.emotion !== undefined && onChronicleEvCb) onChronicleEvCb(data);
        });
      } catch (_) {}
    }
  } catch (e) {
    entry.status = `error: ${e.message}`;
    console.error('CAP error:', e.message);
  } finally {
    capInFlightCount--;
    // Drain queue — fire next if slot available
    if (finalQueue.length > 0 && capInFlightCount < MAX_CONCURRENT) {
      const next = finalQueue.shift();
      sendToCAP(next); // intentionally not awaited — parallel
    }
  }
}

async function forwardToCAP(text) {
  const body = sanitize(text);
  if (!body) return;
  if (body.length < 15) return; // skip trivial transcripts — single words, vocal fillers, stage directions
  if (capInFlightCount >= MAX_CONCURRENT) {
    finalQueue.push(body);
    console.log(`CAP at max (${MAX_CONCURRENT}) — queued (${finalQueue.length} waiting)`);
    return;
  }
  sendToCAP(body); // intentionally not awaited — fire and continue
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
      sessionReady = true;
      console.log('ElevenLabs: session started — ready for audio');
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
      // Final committed — send full confirmed text to CAP
      forwardToCAP(sanitize(text));
    });

    connection.on('error', (err) => {
      console.error('ElevenLabs error:', err?.error ?? err?.message ?? err);
      setTimeout(initElevenLabs, 3000);
    });

    connection.on('close', () => {
      console.log('ElevenLabs: session closed, reconnecting...');
      connection = null;
      sessionReady = false;
      setTimeout(initElevenLabs, 3000);
    });

  } catch (e) {
    console.error('ElevenLabs connect error:', e.message);
    setTimeout(initElevenLabs, 5000);
  }
}

function sendToElevenLabs(buffer) {
  if (!connection || !sessionReady) return;
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

function isIdle() { return capInFlightCount === 0 && finalQueue.length === 0; }

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
