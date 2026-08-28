const https = require('https');

console.log('[*] Testing StreamElements / Amazon Polly TTS stream...');

const voice = 'Brian'; // Options: Brian, Joanna, Matthew, Amy, Justin
const text = encodeURIComponent('Testing Amazon Polly high quality TTS pipeline.');
const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${text}`;

let totalBytes = 0;

https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error(`[-] Stream error: HTTP ${res.statusCode}`);
    process.exit(1);
  }

  res.on('data', (chunk) => {
    totalBytes += chunk.length;
    process.stdout.write(`\r[+] Receiving audio buffer: ${totalBytes} bytes...`);
  });

  res.on('end', () => {
    console.log(`\n[✓] SUCCESS! Received complete audio stream (${totalBytes} bytes).`);
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('[-] Request failed:', err.message);
  process.exit(1);
});
