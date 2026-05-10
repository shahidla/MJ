namespace mj;

@cds.persistence.exists
@cds.persistence.name: 'MJ_HISTORY_EVENTS'
entity MJHistoryEvents

{
  key EVENT_ID       : Integer64;
      SONG_NAME      : String(120);
      LYRIC_TIME_SEC : Integer;
      LYRIC_TEXT     : String(2000);
      DATE_TEXT      : String(40);
      EVENT_DATE     : Date;
      CREATED_AT     : Timestamp;
}

@cds.persistence.exists
@cds.persistence.name: 'MJ_HISTORY_EVENTS_V'
entity MJHistoryEventsView

{
  key EVENT_ID       : Integer64;
      SONG_NAME      : String(120);
      LYRIC_TIME_SEC : Integer;
      LYRIC_TEXT     : String(2000);
      DATE_TEXT      : String(40);
      EVENT_DATE     : Date;
      CREATED_AT     : Timestamp;
}
