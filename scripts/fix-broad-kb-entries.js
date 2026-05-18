require('dotenv').config({ path: '.env' });
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../db.sqlite');
const CSV_FILE = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');

const UPDATES = [
  {
    // Fix 5: MJ 1971 interview — too broad, appearing for any MJ authenticity query
    id: 'd629d959-6422-4839-91d5-edabf47d37eb',
    year: 1971,
    headline: 'Michael Jackson interview — I only sing what I mean',
    context: `In a 1971 interview as a member of The Jackson 5, Michael Jackson said: "Whatever I sing, that's what I really mean. I keep singing a song. I don't sing it if I don't mean it. Remember it will be for us, the children of today, that make the world tomorrow a better and happier place." This quote opens the HIStory album, spoken before the historical montage begins. It is his artistic covenant — every lyric he sings is a statement of belief.`,
    embeddingQuery: `1971 Michael Jackson HIStory album intro speech children of today whatever I sing that's what I really mean artistic philosophy HIStory opening`
  },
  {
    // Fix 6: JFK 1961 "Ask not" — too broad, appearing for any "call to action" query
    id: '1a2b3c4d-0001-0001-0001-000000000059',
    year: 1961,
    headline: 'President Kennedy Ask not what your country can do',
    context: `January 20 1961. John F Kennedy's inaugural address. Ask not what your country can do for you — ask what you can do for your country. The youngest elected president in American history speaks to a frozen Washington DC. The Cold War is at its peak. The space race has begun. Cuba is about to become a crisis. Kennedy's words define a generation of public service — the Peace Corps is founded weeks later. He will be dead in 1963.`,
    embeddingQuery: `1961 Kennedy inaugural address ask not what your country can do Cold War Peace Corps generation public service civic duty`
  },
  {
    // Fix 7: Beethoven 1827 — HIStory speech opens with this date
    id: '1a2b3c4d-0001-0001-0001-000000000071',
    year: 1827,
    headline: 'Beethoven dies — the last symphony written in silence',
    context: `March 26 1827. A Monday. Ludwig van Beethoven dies in Vienna aged 56. He had been deaf for the last decade of his life — composing his greatest works, including the Ninth Symphony, without hearing a single note. Twenty thousand people attended his funeral. The HIStory album opens with this date — March 26th, 1827 — as its first historical reference point. A man who created beauty he could not hear. The perfect opening for a tribute to Michael Jackson.`,
    embeddingQuery: `1827 Beethoven dies March 26 Vienna deaf Ninth Symphony HIStory album opening date`
  },
  {
    // Fix 8: Ryan White — Earth Song asks "What about Ryan White"
    id: '1a2b3c4d-0001-0001-0001-000000000056',
    year: 1988,
    headline: 'Ryan White banned from school AIDS crisis — what about Ryan White',
    context: `1988. Thirteen-year-old Ryan White is barred from attending school in Indiana after testing positive for HIV — contracted through a blood transfusion for haemophilia. His family faces death threats, their house is shot at. Ryan becomes the face of AIDS discrimination in America. He fights for the right to attend school and wins. He dies in 1990 aged 18, one month before his high school graduation. Michael Jackson was his close friend and paid for his funeral. Earth Song asks: "What about Ryan White?" — a child punished for being sick.`,
    embeddingQuery: `Ryan White AIDS crisis 1988 what about Ryan White Earth Song child HIV school banned Michael Jackson friend`
  }
];

async function getEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  });
  const json = await res.json();
  if (!json.data) { console.error('OpenAI error:', JSON.stringify(json)); process.exit(1); }
  return JSON.stringify(json.data[0].embedding);
}

function csvEscape(val) {
  const s = String(val ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function main() {
  const better = require('../node_modules/@cap-js/sqlite/node_modules/better-sqlite3');
  const db = better(DB_PATH);

  let csv = fs.readFileSync(CSV_FILE, 'utf8');
  const csvLines = csv.split('\n');

  for (const u of UPDATES) {
    console.log(`\nProcessing: ${u.headline}`);
    const embedding = await getEmbedding(u.embeddingQuery + ' ' + u.context);

    // Update SQLite
    const exists = db.prepare('SELECT id FROM mj_HistoryEvents WHERE id = ?').get(u.id);
    if (exists) {
      db.prepare('UPDATE mj_HistoryEvents SET year=?, headline=?, context=?, embedding=? WHERE id=?')
        .run(u.year, u.headline, u.context, embedding, u.id);
      console.log('  Updated in SQLite.');
    } else {
      db.prepare('INSERT INTO mj_HistoryEvents (id, year, headline, context, embedding) VALUES (?, ?, ?, ?, ?)')
        .run(u.id, u.year, u.headline, u.context, embedding);
      console.log('  Inserted into SQLite.');
    }

    // Update CSV
    const rowIdx = csvLines.findIndex(l => l.startsWith(u.id + ','));
    const newRow = `${u.id},${u.year},${csvEscape(u.headline)},${csvEscape(u.context)},${csvEscape(embedding)}`;
    if (rowIdx >= 0) {
      csvLines[rowIdx] = newRow;
      console.log('  Updated in CSV.');
    } else {
      csvLines.push(newRow);
      console.log('  Added to CSV.');
    }
  }

  db.close();
  fs.writeFileSync(CSV_FILE, csvLines.join('\n'), 'utf8');
  console.log('\nAll done.');
}

main().catch(console.error);
