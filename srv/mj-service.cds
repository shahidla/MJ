using { mj } from '../db/schema';

service MJService {

  // Receives transcript from CPI, runs cognitive pipeline
  action receiveTranscript(transcript : String) returns String;

  // Read-only access to chronicle for monitoring
  entity ChronicleEvents as projection on mj.ChronicleEvents;
  entity HistoryEvents    as projection on mj.HistoryEvents;

}
