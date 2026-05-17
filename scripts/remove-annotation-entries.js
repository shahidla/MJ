// Removes the song annotation KB entries — let real historical entries surface instead
require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '../db/data/mj-HistoryEvents.csv');

// Headlines to remove
const REMOVE = [
  "They Don't Care About Us — MJ on systemic racism and police brutality",
  "Earth Song — MJ on environmental destruction and human suffering",
  "Man in the Mirror — MJ on personal transformation as the start of global change"
];

const lines = fs.readFileSync(CSV_FILE, 'utf8').split('\n');
const filtered = lines.filter(line => !REMOVE.some(r => line.includes(r)));
const removed = lines.length - filtered.length;

fs.writeFileSync(CSV_FILE, filtered.join('\n'), 'utf8');
console.log(`Removed ${removed} annotation entries. KB now has ${filtered.filter(l=>l.trim()).length - 1} entries.`);
