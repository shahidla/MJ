// srv/mj-events.js
//https://port4004-workspaces-ws-w40uc.us10.trial.applicationstudio.cloud.sap/mj-sse-test.html
const cds = require("@sap/cds");
const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const config = require("../config/openai");

// keep connected SSE browser clients
let mjClients = [];
let chunkSeq = 0;

// JSON parser middleware
function expressJson() {
  return express.json();
}

// Build a mono 16 kHz 16 bit WAV from raw PCM16 buffer
function pcm16ToWav(pcmBuffer) {
  const numChannels = 1;
  const sampleRate = 16000;
  const bitsPerSample = 16;

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44);

  let offset = 0;

  buffer.write("RIFF", offset);
  offset += 4;

  buffer.writeUInt32LE(36 + dataSize, offset);
  offset += 4;

  buffer.write("WAVE", offset);
  offset += 4;

  buffer.write("fmt ", offset);
  offset += 4;

  buffer.writeUInt32LE(16, offset); // PCM chunk size
  offset += 4;

  buffer.writeUInt16LE(1, offset); // PCM format
  offset += 2;

  buffer.writeUInt16LE(numChannels, offset);
  offset += 2;

  buffer.writeUInt32LE(sampleRate, offset);
  offset += 4;

  buffer.writeUInt32LE(byteRate, offset);
  offset += 4;

  buffer.writeUInt16LE(blockAlign, offset);
  offset += 2;

  buffer.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  buffer.write("data", offset);
  offset += 4;

  buffer.writeUInt32LE(dataSize, offset);
  offset += 4;

  return Buffer.concat([buffer, pcmBuffer]);
}

// Simple buffer to aggregate a few chunks before calling STT
let pendingPcm = Buffer.alloc(0);
const MIN_BYTES_FOR_STT = 16000 * 2 * 3; // about three seconds at 16 kHz mono

// Call OpenAI audio transcription for buffered audio and broadcast result
async function transcribeAndBroadcast() {
  if (!config.apiKey) {
    console.error("MJ STT: OPENAI_API_KEY is not set");
    return;
  }

  if (!pendingPcm || pendingPcm.length < MIN_BYTES_FOR_STT) {
    return;
  }

  const pcmBuffer = pendingPcm;
  pendingPcm = Buffer.alloc(0);

  try {
    const wavBuffer = pcm16ToWav(pcmBuffer);

    const formData = new FormData();
    formData.append("file", wavBuffer, {
      filename: "chunk.wav",
      contentType: "audio/wav"
    });

formData.append("model", "gpt-4o-transcribe");
formData.append(
"prompt",
"Transcribe only the words that are clearly audible in this audio segment. " +
"Do not guess or invent any words, numbers, or dates. " +
"strictly transcribe only what is heard. " +
"do not hallucinate. " +
"If a date or year is clearly spoken, transcribe it exactly as heard. " +
"If any part of the audio is unclear, transcribe only that has been heard. " +
"Do not use outside knowledge " +
"Never add dates or numbers that are not explicitly present in the audio. " +
"Return only the raw transcription with no commentary."
);
    const response = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${config.apiKey}`
        },
        timeout: 60000
      }
    );

    const text = response.data && response.data.text;
    if (text && text.trim()) {
      console.log("MJ STT transcript:", text);

      const payload = {
        type: "MJTranscript",
        text
      };
      const data = JSON.stringify(payload);

      mjClients.forEach((clientRes) => {
        if (!clientRes.writableEnded) {
          clientRes.write(`data: ${data}\n\n`);
        }
      });
    } else {
      console.log("MJ STT transcript empty or whitespace");
    }
  } catch (e) {
    if (e.response && e.response.data) {
      console.error("MJ STT error:", e.response.data);
    } else {
      console.error("MJ STT error:", e);
    }
  }
}

module.exports = function () {
  const app = cds.app;

  // raw audio endpoint -> collect chunks and call STT when enough audio is buffered
  app.post(
    "/mj/audio-debug",
    express.raw({ type: "application/octet-stream", limit: "2mb" }),
    async (req, res) => {
      const buf = req.body;
      const len = buf ? buf.length : 0;
      chunkSeq += 1;
      console.log("MJ audio chunk received, bytes:", len, "seq:", chunkSeq);

      if (buf && buf.length > 0) {
        pendingPcm = Buffer.concat([pendingPcm, buf]);
        console.log(
          "MJ STT buffer size bytes:",
          pendingPcm.length
        );

        // fire STT only when we have at least a few seconds of audio
        if (pendingPcm.length >= MIN_BYTES_FOR_STT) {
          transcribeAndBroadcast().catch((e) => {
            console.error("MJ STT async error:", e);
          });
        }
      }

      res.status(204).end();
    }
  );

  // SSE endpoint
  app.get("/mj/stream", (req, res) => {
    if (req.socket && req.socket.setTimeout) {
      req.socket.setTimeout(0);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    res.write("event: ping\ndata: 1\n\n");

    mjClients.push(res);
    console.log("MJ SSE client connected, total:", mjClients.length);

    const pingInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write("event: ping\ndata: 1\n\n");
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(pingInterval);
      const idx = mjClients.indexOf(res);
      if (idx >= 0) mjClients.splice(idx, 1);
      console.log("MJ SSE client disconnected, total:", mjClients.length);
      res.end();
    });
  });

  // notify endpoint still available for manual pushes
  app.post("/mj/notify", expressJson(), (req, res) => {
    const payload = req.body || {};
    const data = JSON.stringify(payload);

    console.log("MJ notify from backend:", data);

    mjClients.forEach((clientRes) => {
      if (!clientRes.writableEnded) {
        clientRes.write(`data: ${data}\n\n`);
      }
    });

    res.status(204).end();
  });

  // test endpoint
  app.get("/mj/notify-test", (req, res) => {
    const payload = {
      type: "MJTranscriptTest",
      text: "Billie Jean spike line"
    };
    const data = JSON.stringify(payload);

    console.log("MJ notify test from browser:", data);

    mjClients.forEach((clientRes) => {
      if (!clientRes.writableEnded) {
        clientRes.write(`data: ${data}\n\n`);
      }
    });

    res.status(200).json({ status: "ok", sent: payload });
  });
};
