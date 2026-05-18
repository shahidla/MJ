using { mj } from '../db/schema';

service MJService {

  // Cognitive pipeline entry point — called by bridge/CPI with each transcript
  action receiveTranscript(transcript : String) returns String;

  // Finale trigger — call when audio ends to generate closing reflection
  action generateFinale() returns String;

  // Reset in-memory session state between demo runs
  action resetSession() returns String;

  // Returns current session ID — used by log to filter events
  action currentSession() returns String;

  // Wipe all ChronicleEvents — clean slate before a demo run
  action clearChronicle() returns String;

  // Read the finale reflection for the current session
  action currentFinale() returns String;

  // Read-only access to chronicle for monitoring
  entity ChronicleEvents as projection on mj.ChronicleEvents;
  entity HistoryEvents    as projection on mj.HistoryEvents;

}
