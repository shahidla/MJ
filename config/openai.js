// config/openai.js
module.exports = {
  // use a normal realtime-capable model
  realtimeUrl: "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
  apiKey: process.env.OPENAI_API_KEY,
  debug: true
};
