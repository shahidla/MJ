namespace mj;

// Knowledge base — historical events that MJ sings about
// Seeded once, queried via RAG for every transcript
entity HistoryEvents {
  key id       : UUID;
  year         : Integer;
  headline     : String(200);
  context      : String(2000); // deep historical context for RAG
  embedding    : LargeString;  // JSON-serialised vector for HANA VECTOR_SEARCH
}

// Live chronicle — events detected during each demo run
entity ChronicleEvents {
  key id        : UUID;
  sessionId     : String(50);
  ts            : Timestamp;
  transcript    : String(2000);
  emotion       : String(100);
  year          : String(20);
  event         : String(500);
  figure        : String(200);  // primary historical figure referenced
  insight       : String(1000);
  ragContext    : String(2000); // what HANA Vector returned
  actNumber     : Integer;      // 1-4
  country       : String(100);  // country where the event occurred
  lat           : Decimal(9,6); // latitude
  lng           : Decimal(9,6); // longitude
}
