// Updates the Elizabeth 1940 KB entry with the exact HIStory phrase and regenerates embedding
require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');

const ENTRY_ID = 'e5f746dc-ca93-4740-91e3-8928f462f988';
const NEW_CONTEXT = `In 1940 Princess Elizabeth, before she became Queen of the United Kingdom, gave a radio speech to encourage the children of Britain who had been evacuated from cities during World War II. She spoke directly to children separated from their families, offering comfort and reassurance. Her exact words, sampled in Michael Jackson's HIStory: "Remember, it will be for us, the children of today, to make the world of tomorrow a better and happier place." Her words symbolized resilience and hope — spoken from Buckingham Palace to a nation at war.`;

async function getEmbedding(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  });
  const json = await res.json();
  return JSON.stringify(json.data[0].embedding);
}

async function main() {
  console.log('Generating new embedding for Elizabeth 1940 entry...');
  const embedding = await getEmbedding(`1940 Princess Elizabeth speaks to children evacuated during World War II ${NEW_CONTEXT}`);

  // Update CSV
  const csvFile = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');
  let csv = fs.readFileSync(csvFile, 'utf8');
  const lines = csv.split('\n');
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].includes(ENTRY_ID)) {
      // Rebuild the line: id,year,headline,context,embedding
      const quotedContext = '"' + NEW_CONTEXT.replace(/"/g, '""') + '"';
      const quotedEmbed = '"' + embedding.replace(/"/g, '""') + '"';
      lines[i] = `${ENTRY_ID},1940,"Princess Elizabeth speaks to children evacuated during World War II",${quotedContext},${quotedEmbed}`;
      console.log('CSV entry updated.');
      break;
    }
  }
  fs.writeFileSync(csvFile, lines.join('\n'), 'utf8');
  console.log('Done.');
}

main().catch(console.error);
