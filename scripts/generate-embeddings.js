// One-time script: generate OpenAI embeddings for all HistoryEvents and store in HANA
// Run from project root: node scripts/generate-embeddings.js
require('dotenv').config({ path: '.env' });

const cds = require('@sap/cds');

async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  });
  const json = await res.json();
  if (!json.data) throw new Error(`OpenAI error: ${JSON.stringify(json)}`);
  return json.data[0].embedding; // 1536-dimension float array
}

async function main() {
  const db = await cds.connect.to('db');

  const events = await db.run(`SELECT ID, YEAR, HEADLINE, CONTEXT FROM "MJ_HISTORYEVENTS" ORDER BY YEAR ASC`);
  console.log(`Found ${events.length} events to embed\n`);

  let done = 0;
  for (const ev of events) {
    const text = `${ev.HEADLINE}. ${ev.CONTEXT}`;
    process.stdout.write(`[${++done}/${events.length}] ${ev.YEAR} — ${ev.HEADLINE.substring(0, 50)}... `);

    const vector = await embed(text);
    await db.run(`UPDATE "MJ_HISTORYEVENTS" SET EMBEDDING = '${JSON.stringify(vector)}' WHERE ID = '${ev.ID}'`);
    console.log(`✓ (${vector.length}d)`);

    await new Promise(r => setTimeout(r, 200)); // stay under rate limit
  }

  console.log(`\nAll ${done} embeddings stored. Run cds deploy if schema changed.`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
