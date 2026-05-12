# ElevenLabs STT Feasibility Test — ATEST Folder
**Folder:** `C:\Users\shahi\Downloads\ATEST`
**Date:** 2026-05-12
**Purpose:** Prove ElevenLabs can transcribe a vocal MP3 in real-time over WebSocket before integrating into the MJ Live project.

---

## Verdict: CONFIRMED WORKING

Both batch and real-time streaming STT work with ElevenLabs. Real-time streaming is the one relevant to MJ Live.

---

## Two Modes Tested

### 1. Batch (`stt.js`) — one API call
- Upload full MP3 → wait ~8 seconds → get full transcript back
- Model: `scribe_v2`
- SDK method: `client.speechToText.convert({ file, modelId })`
- Result is at `result.text` (NOT `result.data.text`)
- Run: `node stt.js`

### 2. Realtime Streaming (`stt_realtime.js`) — WebSocket chunks ✅ THIS IS THE ONE FOR MJ
- WebSocket to `wss://api.elevenlabs.io/v1/speech-to-text/realtime`
- Model: `scribe_v2_realtime`
- Fires `partial_transcript` events as audio streams in (word by word)
- Fires `committed_transcript` when a segment is finalised
- Transcript field is `data.text` (NOT `data.transcript`)
- Run: `node stt_realtime.js`

---

## How Real-Time Streaming Works (for MJ integration)

```
MP3 file (or live mic PCM in MJ)
    ↓
ffmpeg decodes → raw PCM 16kHz, 16-bit, mono
    ↓
Buffer all PCM, send in 100ms chunks via setInterval
    ↓
connection.send({ audioBase64: chunk.toString('base64') })
    ↓
ElevenLabs WebSocket fires events:
    partial_transcript  → data.text  (live, updating)
    committed_transcript → data.text (final, locked)
    ↓
Log to file + console
```

**Key insight for MJ:** MJ already sends live PCM from the browser mic via WebSocket (same pattern in `bridge/stt-all.js`). For ElevenLabs, you just change the WebSocket endpoint and event names — the chunk-sending logic is identical.

---

## NPM Packages Required

```json
"@elevenlabs/elevenlabs-js": "^2.3.0",
"@ffmpeg-installer/ffmpeg": "^1.1.0",
"dotenv": "^16.4.5"
```

`@ffmpeg-installer/ffmpeg` — bundled ffmpeg binary, **no system install needed**. It provides the path via `ffmpegInstaller.path`.

---

## Complete Working Code — stt_realtime.js

```js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const AUDIO_FILE  = path.resolve('./vocals.mp3');
const timestamp   = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE    = path.resolve(`./logs/realtime_${timestamp}.txt`);
const CHUNK_SIZE  = 16000 * 2 * 0.1; // 100ms of PCM at 16kHz 16-bit mono

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

async function main() {
  fs.mkdirSync(path.resolve('./logs'), { recursive: true });
  fs.writeFileSync(LOG_FILE, `ElevenLabs STT (realtime) — ${new Date().toISOString()}\nAudio: ${AUDIO_FILE}\n\n`);

  const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

  const connection = await client.speechToText.realtime.connect({
    modelId:     'scribe_v2_realtime',
    audioFormat: 'pcm_16000',
    sampleRate:  16000,
  });

  connection.on('session_started', () => {
    log('Session started — streaming audio...');
    streamAudio(connection);
  });

  connection.on('partial_transcript', (data) => {
    const line = `[PARTIAL] ${data.text}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
  });

  connection.on('committed_transcript', (data) => {
    const line = `[FINAL]   ${data.text}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
  });

  connection.on('error',  (err) => log(`ERROR: ${err?.error ?? err?.message}`));
  connection.on('close',  ()    => log(`Done. Log: ${LOG_FILE}`));
}

function streamAudio(connection) {
  const ff = spawn(ffmpegInstaller.path, [
    '-i', AUDIO_FILE, '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'pipe:1'
  ]);

  const pcmChunks = [];
  ff.stdout.on('data', (chunk) => pcmChunks.push(chunk));
  ff.stdout.on('end', () => {
    const allPcm = Buffer.concat(pcmChunks);
    const total  = Math.ceil(allPcm.length / CHUNK_SIZE);
    let   index  = 0;

    const interval = setInterval(() => {
      if (index >= total) {
        clearInterval(interval);
        connection.commit();
        connection.close();
        return;
      }
      const slice = allPcm.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
      connection.send({ audioBase64: slice.toString('base64') });
      index++;
    }, 100); // real-time pace: 100ms chunk every 100ms

    process.on('SIGINT', () => {
      clearInterval(interval);
      connection.close();
      process.exit(0);
    });
  });
}

main().catch(err => { log(`FATAL: ${err.message}`); process.exit(1); });
```

---

## Critical Gotchas (things that went wrong, fixed here)

| Issue | Wrong | Correct |
|---|---|---|
| Transcript field name | `data.transcript` | `data.text` |
| Batch result field | `result.data.text` | `result.text` |
| SDK param casing | `model_id` (snake) | `modelId` (camel) |
| Sending speed | dump all at once | 100ms interval (rate limit error otherwise) |
| ffmpeg | system install | `@ffmpeg-installer/ffmpeg` npm package |

---

## Actual Output from vocals.mp3 (Billie Jean vocal track)

Streaming built up word by word in real-time:
```
[PARTIAL] She was more like-
[PARTIAL] She was more like a beauty queen.
[PARTIAL] She was more like a beauty queen from a movie scene. I said, "Don't mind, but who-"
[PARTIAL] She was more like a beauty queen from a movie scene. I said, "Don't mind, but what do you mean?"
[FINAL]   She was more like a beauty queen from a movie scene. I said, "Don't mind, but what do you mean?" I...
[PARTIAL] She said, "I am the one." Who will dance on the floor in the round.
...
[PARTIAL] I dream things that never were and say, "Why not?" That's one small step for man, one giant leap for mankind.
```

---

## MJ Integration Notes

In MJ's `bridge/stt-all.js`, live mic PCM already comes in via `sendPcm(buffer)`. To add ElevenLabs as an STT option:

1. Add the ElevenLabs connection setup (same as above) in `bridge/`
2. In `sendPcm()`, alongside `sendToRealtime(buffer)`, add `sendToElevenLabs(buffer)`
3. The buffer is already PCM — no ffmpeg needed when coming from the browser mic
4. Listen for `committed_transcript` events → `data.text` → push to Solace topic

**The only difference vs OpenAI realtime:** event names.
- OpenAI: `conversation.item.input_audio_transcription.completed` → `evt.transcript`
- ElevenLabs: `committed_transcript` → `data.text`

---

## Logs Location
All runs saved to `ATEST/logs/` with timestamps:
- `batch_<timestamp>.txt` — batch runs
- `realtime_<timestamp>.txt` — streaming runs
