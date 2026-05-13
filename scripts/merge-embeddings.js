// Merges embeddings from HistoryEvents.json (HANA export) into mj-HistoryEvents.csv
// Run: node scripts/merge-embeddings.js
const fs   = require('fs');
const path = require('path');

const jsonFile = path.join(__dirname, '../db/data/HistoryEvents.json');
const csvFile  = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');
const outFile  = csvFile; // overwrite in place

// Parse JSON export
const raw  = fs.readFileSync(jsonFile, 'utf8');
const data = JSON.parse(raw);
const rows = data.value || data;

// Build id → embedding map
const embedMap = {};
for (const row of rows) {
  if (row.ID && row.EMBEDDING) embedMap[row.ID] = row.EMBEDDING;
  else if (row.id && row.embedding) embedMap[row.id] = row.embedding;
}
console.log(`Loaded ${Object.keys(embedMap).length} embeddings from JSON`);

// Parse existing CSV
const csvLines = fs.readFileSync(csvFile, 'utf8').split('\n').filter(l => l.trim());
const header   = csvLines[0]; // id,year,headline,context

// Check if embedding column already exists
if (header.includes('embedding')) {
  console.log('embedding column already in CSV — re-merging');
}

// Build new CSV with embedding column
const newHeader = header.includes('embedding') ? header : header + ',embedding';
const newLines  = [newHeader];

let matched = 0;
let missing = 0;

for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i].trim();
  if (!line) continue;

  // Extract id (first field)
  const id = line.split(',')[0];
  const embedding = embedMap[id] || '';

  if (embedding) {
    matched++;
    // Properly quote the embedding JSON array (contains commas)
    const quotedEmbed = '"' + embedding.replace(/"/g, '""') + '"';
    // Remove existing embedding if present
    const baseLine = header.includes('embedding')
      ? line.substring(0, line.lastIndexOf(','))
      : line;
    newLines.push(baseLine + ',' + quotedEmbed);
  } else {
    missing++;
    console.warn(`No embedding for id: ${id}`);
    const baseLine = header.includes('embedding')
      ? line.substring(0, line.lastIndexOf(','))
      : line;
    newLines.push(baseLine + ',');
  }
}

fs.writeFileSync(outFile, newLines.join('\n') + '\n', 'utf8');
console.log(`Done. Matched: ${matched}, Missing: ${missing}`);
console.log(`Written to: ${outFile}`);
