require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CSV_FILE = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');

const NEW_ENTRIES = [
  {
    year: 1986,
    headline: 'Commercial whaling moratorium — blue whales near extinction in the Southern Ocean',
    context: 'In 1986 the International Whaling Commission enacted a global moratorium on commercial whaling. By then, blue whales — the largest animals ever to live on Earth — had been reduced from 250,000 to fewer than 5,000. The Southern Ocean had been the primary hunting ground. Whale populations have never fully recovered. What about crying whales ravaging the seas — they were not ravaging, they were disappearing.'
  },
  {
    year: 1989,
    headline: 'Convention on the Rights of the Child — 40,000 children die every day from preventable causes',
    context: 'The United Nations Convention on the Rights of the Child was adopted on November 20 1989, the most widely ratified human rights treaty in history. At the time of signing, 40,000 children under five were dying every day from preventable causes — malnutrition, dirty water, lack of basic medicine. Today the number has fallen but remains in the tens of thousands. What about children dying — can you hear them cry?'
  },
  {
    year: 1992,
    headline: 'Somalia famine — children dying of starvation while the world watched',
    context: 'In 1992 Somalia collapsed into famine and civil war. An estimated 300,000 people died, the majority children under five. Images of skeletal Somali children shocked the world and triggered a US-led intervention Operation Restore Hope. UNICEF called it the worst humanitarian crisis of the decade. The images defined a generation\'s understanding of what it means when children die and the world does nothing.'
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
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function main() {
  const lines = [];
  for (let i = 0; i < NEW_ENTRIES.length; i++) {
    const e = NEW_ENTRIES[i];
    console.log(`[${i+1}/${NEW_ENTRIES.length}] ${e.year} — ${e.headline}`);
    const embedding = await getEmbedding(`${e.year} ${e.headline} ${e.context}`);
    lines.push([randomUUID(), e.year, csvEscape(e.headline), csvEscape(e.context), csvEscape(embedding)].join(','));
  }
  fs.appendFileSync(CSV_FILE, '\n' + lines.join('\n') + '\n', 'utf8');
  console.log(`Done. ${lines.length} entries added.`);
}

main().catch(console.error);
