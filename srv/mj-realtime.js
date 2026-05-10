// srv/mj-realtime.js

const WebSocket = require("ws");
const { v4: uuid } = require("uuid");
const config = require("../config/openai");

let session = null;

/**
 * Ensure a single realtime session is open.
 */
function ensureSession() {
  if (
    session &&
    session.socket &&
    (session.socket.readyState === WebSocket.OPEN ||
      session.socket.readyState === WebSocket.CONNECTING)
  ) {
    return session;
  }

  if (!config.apiKey) {
    console.error("MJ realtime: OPENAI_API_KEY is not set");
    throw new Error("OPENAI_API_KEY is not set");
  }

  const sessionId = uuid();
  console.log("MJ realtime: creating new session", sessionId);

  const ws = new WebSocket(config.realtimeUrl, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "OpenAI-Beta": "realtime=v1"
    }
  });

  session = {
    id: sessionId,
    socket: ws,
    listeners: new Set(),
    pending: false // whether a response is currently in flight
  };

  ws.on("open", () => {
    console.log("MJ realtime: session open", sessionId);

    const s = session;
    if (!s || s.socket !== ws) return;

    const sessionUpdate = {
      type: "session.update",
      session: {
        input_audio_format: "pcm16"
        // no server_vad here – realtime API complained about this field
      }
    };

    console.log("MJ realtime: sending session.update");
    ws.send(JSON.stringify(sessionUpdate));
  });

  ws.on("message", (data) => {
    const s = session;
    if (!s || s.socket !== ws) return;

    let evt;
    try {
      evt = JSON.parse(data.toString());
    } catch (e) {
      console.error("MJ realtime: parse error", e);
      return;
    }

    console.log("MJ realtime: got event type", evt.type);

    if (evt.type === "error") {
      console.error(
        "MJ realtime error:",
        JSON.stringify(evt, null, 2)
      );
    }

    // clear pending when a response finishes
    if (evt.type === "response.done") {
      const s2 = session;
      if (s2 && s2.socket === ws) {
        s2.pending = false;
        console.log("MJ realtime: response.done, pending set to false");
      }
    }

    s.listeners.forEach((fn) => {
      try {
        fn(evt);
      } catch (e) {
        console.error("MJ listener error", e);
      }
    });
  });

  ws.on("error", (err) => {
    console.error("MJ realtime: socket error", err);
  });

  ws.on("close", (code, reason) => {
    console.log(
      "MJ realtime: session closed",
      sessionId,
      "code:",
      code,
      "reason:",
      reason ? reason.toString() : ""
    );
    // do not null session immediately; next ensureSession will recreate
  });

  return session;
}

/**
 * Append a PCM16 audio chunk (Buffer) to current session.
 * Also commits and creates a response when no response is pending.
 */
function appendAudio(pcmBuffer) {
  const s = ensureSession();
  const ws = s.socket;

  console.log(
    "MJ realtime: appendAudio called, bytes:",
    pcmBuffer ? pcmBuffer.length : 0,
    "readyState:",
    ws.readyState,
    "pending:",
    s.pending
  );

  if (ws.readyState !== WebSocket.OPEN) {
    console.log(
      "MJ realtime: socket not open yet, dropping chunk of",
      pcmBuffer ? pcmBuffer.length : 0,
      "bytes"
    );
    return;
  }

  const audioBase64 = pcmBuffer.toString("base64");

  const appendMsg = {
    type: "input_audio_buffer.append",
    audio: audioBase64
  };

  ws.send(JSON.stringify(appendMsg));

  // If no response is currently in flight, commit and ask for one
  if (!s.pending) {
    console.log("MJ realtime: committing buffer and creating response");

    const commitMsg = {
      type: "input_audio_buffer.commit"
    };
    ws.send(JSON.stringify(commitMsg));

    const createMsg = {
      type: "response.create",
      response: {
        instructions:
          "Transcribe the latest committed audio buffer into plain text lyrics only.",
        modalities: ["text"]
      }
    };
    ws.send(JSON.stringify(createMsg));

    s.pending = true;
  }
}

/**
 * Register listener for all events from OpenAI.
 */
function registerListener(listener) {
  const s = ensureSession();
  s.listeners.add(listener);
  console.log("MJ realtime: listener registered, total:", s.listeners.size);
}

/**
 * Unregister listener
 */
function unregisterListener(listener) {
  if (!session) return;
  session.listeners.delete(listener);
  console.log("MJ realtime: listener removed, total:", session.listeners.size);
}

module.exports = {
  appendAudio,
  registerListener,
  unregisterListener
};
