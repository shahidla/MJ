// Temporary: bridge calls OpenAI whisper-1 directly.
// When CPI iFlow 1 is ready, delete this file — CPI will call AssemblyAI instead.

const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'whisper-1';
const SAMPLE_RATE = 16000;
const CHUNK_SECONDS = 2;
const OVERLAP_SECONDS = 0.5;
const MIN_BYTES = Math.floor(SAMPLE_RATE * 2 * CHUNK_SECONDS);
const OVERLAP_BYTES = Math.floor(SAMPLE_RATE * 2 * OVERLAP_SECONDS);
const LOG_FILE = path.join(__dirname, 'transcripts-openai-whisper-1.log');

let pendingPcm = Buffer.alloc(0);
let onTranscript = null;

function logTranscript(text) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${text}\n`);
}

function pcm16ToWav(pcmBuffer) {
  const ch = 1, bits = 16;
  const byteRate = (SAMPLE_RATE * ch * bits) / 8;
  const blockAlign = (ch * bits) / 8;
  const h = Buffer.alloc(44);
  let o = 0;
  h.write('RIFF', o); o += 4;
  h.writeUInt32LE(36 + pcmBuffer.length, o); o += 4;
  h.write('WAVE', o); o += 4;
  h.write('fmt ', o); o += 4;
  h.writeUInt32LE(16, o); o += 4;
  h.writeUInt16LE(1, o); o += 2;
  h.writeUInt16LE(ch, o); o += 2;
  h.writeUInt32LE(SAMPLE_RATE, o); o += 4;
  h.writeUInt32LE(byteRate, o); o += 4;
  h.writeUInt16LE(blockAlign, o); o += 2;
  h.writeUInt16LE(bits, o); o += 2;
  h.write('data', o); o += 4;
  h.writeUInt32LE(pcmBuffer.length, o);
  return Buffer.concat([h, pcmBuffer]);
}

async function transcribe(pcmBuffer) {
  if (!API_KEY) { console.error('OpenAI: OPENAI_API_KEY not set'); return; }
  const wav = pcm16ToWav(pcmBuffer);
  const form = new FormData();
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'chunk.wav');
  form.append('model', MODEL);
  form.append('language', 'en');
  form.append('response_format', 'json');
  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form
    });
    const d = await res.json();
    const text = d.text?.trim();
    if (text) {
      console.log('OpenAI whisper-1:', text);
      logTranscript(text);
      onTranscript(text, true);
    } else if (d.error) {
      console.error('OpenAI error:', d.error.message);
    }
  } catch (e) {
    console.error('OpenAI fetch error:', e.message);
  }
}

function connect(onTranscriptCb) {
  if (!API_KEY) { console.error('OpenAI: OPENAI_API_KEY not set'); return; }
  onTranscript = onTranscriptCb;
  fs.writeFileSync(LOG_FILE, '');
  console.log(`OpenAI ${MODEL}: ready (2s chunks, 0.5s overlap)`);
  console.log('Log:', LOG_FILE);
}

function sendPcm(buffer) {
  pendingPcm = Buffer.concat([pendingPcm, buffer]);
  if (pendingPcm.length >= MIN_BYTES) {
    const chunk = pendingPcm.slice(0, MIN_BYTES);
    pendingPcm = pendingPcm.slice(MIN_BYTES - OVERLAP_BYTES);
    transcribe(chunk).catch(e => console.error('OpenAI async error:', e.message));
  }
}

function disconnect() {}

module.exports = { connect, sendPcm, disconnect };
