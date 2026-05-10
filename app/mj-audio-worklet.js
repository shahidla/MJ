class MJPcmLoggerWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.bufferSize = 16000; // about 1 second at 16kHz
  }

  floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || !output || output.length === 0) {
      return true;
    }

    // tap first channel
    const inChannel = input[0];
    const outChannel = output[0];

    // pass audio through so you can hear it
    outChannel.set(inChannel);

    // convert to PCM16 and buffer for logging
    const pcm16 = this.floatTo16BitPCM(inChannel);

    this.buffer.push(pcm16);

    let totalLength = this.buffer.reduce((sum, arr) => sum + arr.length, 0);

    if (totalLength >= this.bufferSize) {
      const merged = new Int16Array(totalLength);
      let offset = 0;
      for (const chunk of this.buffer) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.buffer = [];

      this.port.postMessage(merged);
    }

    return true;
  }
}

registerProcessor("mj-pcm-logger-worklet", MJPcmLoggerWorklet);
