// Quick AssemblyAI batch test — uploads billie-jean.mp3, prints transcript
// Usage: node test-assemblyai.js  (API key read from ../.env)

require('dotenv').config({ path: '../.env' });

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.ASSEMBLYAI_API_KEY;
if (!API_KEY) {
  console.error('Set ASSEMBLYAI_API_KEY env var');
  process.exit(1);
}

const AUDIO_FILE = path.join(__dirname, '../app/media/billie-jean.mp3');

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function get(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    https.get({ hostname, path, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  // 1. Upload the file
  console.log('Uploading billie-jean.mp3...');
  const fileBuffer = fs.readFileSync(AUDIO_FILE);
  const upload = await post('api.assemblyai.com', '/v2/upload', {
    'authorization': API_KEY,
    'content-type': 'application/octet-stream',
    'content-length': fileBuffer.length
  }, fileBuffer);

  console.log('Upload URL:', upload.upload_url);

  // 2. Submit transcription job
  const body = JSON.stringify({ audio_url: upload.upload_url });
  const job = await post('api.assemblyai.com', '/v2/transcript', {
    'authorization': API_KEY,
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body)
  }, body);

  console.log('Job ID:', job.id, '— polling...');

  // 3. Poll until done
  while (true) {
    await sleep(3000);
    const result = await get('api.assemblyai.com', `/v2/transcript/${job.id}`, {
      'authorization': API_KEY
    });

    console.log('Status:', result.status);

    if (result.status === 'completed') {
      console.log('\n--- TRANSCRIPT ---');
      console.log(result.text);
      console.log('\n--- WORDS ---');
      result.words.forEach(w => console.log(`${(w.start / 1000).toFixed(2)}s  ${w.text}`));
      break;
    }

    if (result.status === 'error') {
      console.error('AssemblyAI error:', result.error);
      break;
    }
  }
}

run().catch(console.error);
