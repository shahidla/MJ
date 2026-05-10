// server.js
const cds = require("@sap/cds");
const express = require("express");

let latestEqFrame = null;

cds.on("bootstrap", (app) => {
  // 1  Equalizer debug endpoint from producer
  app.use("/mj/eq-debug", express.json(), (req, res) => {
    latestEqFrame = req.body;
    console.log("MJ.EqualizerFrame received", JSON.stringify(latestEqFrame));
    res.status(204).end();
  });

  // 2  SSE stream for consumer
  app.get("/mj/eq-stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const send = () => {
      if (latestEqFrame) {
        res.write("event: mj.eq.frame\n");
        res.write("data: " + JSON.stringify(latestEqFrame) + "\n\n");
      }
    };

    // send frames periodically
    const interval = setInterval(send, 200);

    req.on("close", () => {
      clearInterval(interval);
    });
  });
});

module.exports = cds.server;
