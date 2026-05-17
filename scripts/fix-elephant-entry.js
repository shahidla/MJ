require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');
const ENTRY_ID = '1a2b3c4d-0001-0001-0001-000000000065';

const NEW_CONTEXT = `1986. The African elephant population has fallen from 1.3 million in 1979 to 600000 in 1986 — a loss of 700000 elephants in seven years. Killed for ivory. The trade is worth $1 billion a year. In 1989 CITES bans the ivory trade. By then 80 percent of the herds in some countries are gone. Michael Jackson asks in Earth Song: "What about elephants — have we lost their trust?" The elephant is not a symbol. It is a witness to what humanity has done.`;

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
  console.log('Regenerating elephant entry embedding...');
  const embedding = await getEmbedding(`1986 African elephant population crashes what about elephants ${NEW_CONTEXT}`);

  let csv = fs.readFileSync(CSV_FILE, 'utf8');
  const lines = csv.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith(ENTRY_ID)) {
      lines[i] = `${ENTRY_ID},1986,"African elephant population crashes by half",${csvEscape(NEW_CONTEXT)},${csvEscape(embedding)}`;
      console.log('Updated.');
      break;
    }
  }
  fs.writeFileSync(CSV_FILE, lines.join('\n'), 'utf8');
  console.log('Done.');
}

main().catch(console.error);
