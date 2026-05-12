using { mj } from '../db/schema';

service MJService {

  // Cognitive pipeline entry point — called by bridge/CPI with each transcript
  action receiveTranscript(transcript : String) returns String;

  // Finale trigger — call when audio ends to generate closing reflection
  action generateFinale() returns String;

  // Read-only access to chronicle for monitoring
  entity ChronicleEvents as projection on mj.ChronicleEvents;
  entity HistoryEvents    as projection on mj.HistoryEvents;

}
