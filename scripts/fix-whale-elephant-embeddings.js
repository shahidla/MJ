require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');

const UPDATES = [
  {
    id: '1a2b3c4d-0001-0001-0001-000000000065',
    year: 1986,
    headline: 'African elephant poached to near extinction — what about elephants',
    context: `In 1986 Africa's elephant population had crashed from 1.3 million to 600,000 — 700,000 elephants killed in seven years for ivory. The trade was worth $1 billion annually. In 1989 CITES finally banned ivory trade but 80 percent of herds in some regions were already gone. Michael Jackson sings: "What about elephants — have we lost their trust?" The answer by 1986 was yes.`
  }
];

async function getEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  });
  const json = await res.json();
  return JSON.stringify(json.data[0].embedding);
}

function csvEscape(val) {
  const s = String(val ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function main() {
  let csv = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csv.split('\n');

  for (const u of UPDATES) {
    console.log(`Updating: ${u.headline}`);
    const embedding = await getEmbedding(`what about elephants ${u.year} ${u.headline} ${u.context}`);
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].startsWith(u.id)) {
        lines[i] = `${u.id},${u.year},${csvEscape(u.headline)},${csvEscape(u.context)},${csvEscape(embedding)}`;
        console.log('  Updated.');
        break;
      }
    }
  }

  fs.writeFileSync(CSV_FILE, lines.join('\n'), 'utf8');
  console.log('Done.');
}

main().catch(console.error);
