// stt-all.js — ElevenLabs scribe_v2_realtime (primary STT for MJ Live)
// All other STT services commented out — see git history to restore.
// Feasibility confirmed in ATEST/ELEVENLABS_STT_FEASIBILITY.md

require('dotenv').config({ path: '../.env' });

const fs   = require('fs');
const path = require('path');

const API_KEY    = process.env.ELEVENLABS_API_KEY;
const LOG_FILE   = path.join(__dirname, 'transcripts-elevenlabs.log');
const SAMPLE_RATE = 16000;

function logTranscript(label, text) {
  const line = `[${new Date().toISOString()}] [${label}] ${text}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

let connection    = null;
let onTranscriptCb = null;

async function initElevenLabs() {
  if (!API_KEY) { console.error('ElevenLabs: ELEVENLABS_API_KEY not set'); return; }

  // Dynamic import — SDK ships as ESM
  const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
  const client = new ElevenLabsClient({ apiKey: API_KEY });

  try {
    connection = await client.speechToText.realtime.connect({
      modelId:     'scribe_v2_realtime',
      audioFormat: 'pcm_16000',
      sampleRate:   SAMPLE_RATE,
    });

    connection.on('session_started', () => {
      console.log('ElevenLabs scribe_v2_realtime: session started');
    });

    let partialBuffer = '';
    const CHUNK_SIZE = 150;
    const OVERLAP    = 50;

    connection.on('partial_transcript', (data) => {
      const text = data.text?.trim();
      if (!text) return;
      console.log('[partial]', text);
      logTranscript('partial', text);
      onTranscriptCb && onTranscriptCb(text, false);

      partialBuffer = text;
      if (partialBuffer.length >= CHUNK_SIZE) {
        const chunk = partialBuffer.substring(0, CHUNK_SIZE).replace(/"/g, "'");
        forwardToCAP(chunk);
        // Keep last OVERLAP chars as start of next chunk
        partialBuffer = partialBuffer.substring(CHUNK_SIZE - OVERLAP);
      }
    });

    connection.on('committed_transcript', (data) => {
      const text = data.text?.trim();
      if (!text) return;
      console.log('[FINAL]', text);
      logTranscript('FINAL', text);
      onTranscriptCb && onTranscriptCb(text, true);
      // Send remaining buffer + forward full final
      partialBuffer = '';
      forwardToCAP(text.substring(0, 500).replace(/"/g, "'"));
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

// ── Forward transcript via CPI → CAP ────────────────────────────────────────
// CPI is the enterprise relay: Bridge → ElevenLabs → CPI → CAP
const CPI_URL = process.env.CPI_URL || 'http://localhost:4004/odata/v4/mj/receiveTranscript';
const CPI_USER = process.env.CPI_USER || '';
const CPI_PASSWORD = process.env.CPI_PASSWORD || '';

const cpiCallLog = [];

async function forwardToCAP(text) {
  const entry = { ts: new Date().toISOString(), transcript: text.substring(0, 200), status: null };
  cpiCallLog.push(entry);
  if (cpiCallLog.length > 50) cpiCallLog.shift();
  try {
    const body = text.substring(0, 500);
    const headers = { 'Content-Type': 'text/plain' };
    if (CPI_USER) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${CPI_USER}:${CPI_PASSWORD}`).toString('base64');
    }
    const res = await fetch(CPI_URL, { method: 'POST', headers, body });
    entry.status = res.ok ? 'ok' : `error ${res.status}`;
    if (!res.ok) console.error('CPI forward error:', res.status);
    else console.log('Forwarded to CPI:', body.substring(0, 80));
  } catch (e) {
    entry.status = `error: ${e.message}`;
    console.error('CPI forward error:', e.message);
  }
}

module.exports.getCpiLog = () => cpiCallLog;

// ── Public API ───────────────────────────────────────────────────────────────
const STT_ENABLED = process.env.STT_ENABLED === 'true';

function init(onTranscript) {
  onTranscriptCb = onTranscript;
  if (!STT_ENABLED) {
    console.log('STT_ENABLED=false — ElevenLabs not connected (set STT_ENABLED=true to enable)');
    return;
  }
  fs.writeFileSync(LOG_FILE, '');
  console.log('ElevenLabs: connecting...');
  console.log('Log:', LOG_FILE);
  initElevenLabs();
}

function sendPcm(buffer) {
  if (!STT_ENABLED) return;
  sendToElevenLabs(buffer);
}

module.exports = { init, sendPcm };

/*
── COMMENTED OUT — other STT services tested during comparison ─────────────────

OpenAI batch (whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe):
  batchTranscribe(model, pcm, logFn) — see git history

OpenAI Realtime (gpt-4o-realtime-preview):
  initRealtime(), sendToRealtime(buffer) — session.update with input_audio_transcription
  Issue: server_vad never fires with music background; manual commit every 3s worked
         but transcription quality was poor vs ElevenLabs

Groq (whisper-large-v3, whisper-large-v3-turbo):
  groqTranscribe(model, pcm, logFn) — 2s chunks, 0.5s overlap
  whisper-large-v3 was best of Groq options

Deepgram (nova-2, nova-3):
  makeDeepgramSocket(model, logFn) — WebSocket streaming
  Dates transcribed OK but singing lyrics poor

AssemblyAI (whisper-rt):
  WebSocket wss://streaming.assemblyai.com/v3/ws — good for HIStory narration

Parakeet (NVIDIA via Gradio):
  Python child process — Space returning MaskedConvSequential error, ruled out

distil-whisper-large-v3-en (Groq):
  Empty logs on music — ruled out
*/
