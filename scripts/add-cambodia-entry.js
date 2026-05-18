require('dotenv').config({ path: '.env' });
const path = require('path');

const ENTRY = {
  id: '1a2b3c4d-0001-0001-0001-000000000070',
  year: 1975,
  headline: 'Cambodian genocide — Khmer Rouge killing fields',
  context: `1975. Pol Pot and the Khmer Rouge seize Cambodia. Over four years they execute intellectuals, ethnic minorities, and anyone deemed a threat. Between 1.5 and 2 million people die — a quarter of Cambodia's population. Mass graves are discovered across the country. The killing fields become a symbol of ideological genocide. Michael Jackson's Earth Song asks "What about killing fields?" — this is the answer.`
};

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

async function main() {
  console.log('Generating embedding for Cambodia entry...');
  const embedding = await getEmbedding(`1975 Cambodia Khmer Rouge killing fields genocide Pol Pot ${ENTRY.headline} ${ENTRY.context}`);

  // Insert directly into SQLite
  const better = require('../node_modules/@cap-js/sqlite/node_modules/better-sqlite3');
  const db = better(path.join(__dirname, '../db.sqlite'));

  const existing = db.prepare('SELECT id FROM mj_HistoryEvents WHERE id = ?').get(ENTRY.id);
  if (existing) {
    db.prepare('UPDATE mj_HistoryEvents SET year=?, headline=?, context=?, embedding=? WHERE id=?')
      .run(ENTRY.year, ENTRY.headline, ENTRY.context, embedding, ENTRY.id);
    console.log('Updated existing entry.');
  } else {
    db.prepare('INSERT INTO mj_HistoryEvents (id, year, headline, context, embedding) VALUES (?, ?, ?, ?, ?)')
      .run(ENTRY.id, ENTRY.year, ENTRY.headline, ENTRY.context, embedding);
    console.log('Inserted new entry.');
  }
  db.close();

  // Also add to CSV
  const fs = require('fs');
  const CSV_FILE = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');
  let csv = fs.readFileSync(CSV_FILE, 'utf8');
  if (!csv.includes(ENTRY.id)) {
    const escape = v => { const s = String(v||''); return (s.includes(',') || s.includes('"') || s.includes('\n')) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const row = `${ENTRY.id},${ENTRY.year},${escape(ENTRY.headline)},${escape(ENTRY.context)},${escape(embedding)}`;
    csv = csv.trimEnd() + '\n' + row + '\n';
    fs.writeFileSync(CSV_FILE, csv, 'utf8');
    console.log('Added to CSV.');
  }
  console.log('Done.');
}

main().catch(console.error);
