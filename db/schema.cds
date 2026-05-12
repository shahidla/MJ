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
  insight       : String(1000);
  ragContext    : String(2000); // what HANA Vector returned
  actNumber     : Integer;      // 1-4
}
