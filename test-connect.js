const mineflayer = require('mineflayer');

console.log('[*] Initiating connection test to dripmc.net...');

const bot = mineflayer.createBot({
  host: 'dripmc.net',
  port: 12031, // Try 25565 here if 12031 times out
  username: 'lost543215543@outlook.com',
  auth: 'microsoft',
  version: '1.21.1',
  connectTimeout: 10000
});

// Capture Microsoft device code URL if auth is waiting
bot.on('microsoftAuth', (data) => {
  console.log('[Auth Prompt] Open this URL in browser:', data.verification_uri);
  console.log('[Auth Prompt] Enter code:', data.user_code);
});

bot._client.on('connect', () => {
  console.log('[TCP Socket] Connected to remote host! Sending Minecraft handshake...');
});

bot.on('login', () => {
  console.log('[✓] Server accepted handshake. Logging in...');
});

bot.on('spawn', () => {
  console.log(`[✓] Spawned successfully as ${bot.username}!`);
  process.exit(0);
});

bot.on('kicked', (reason) => {
  console.log('[!] Kicked by server:');
  console.log(JSON.stringify(reason, null, 2));
  process.exit(1);
});

bot.on('error', (err) => {
  console.log('[!] Error encountered:');
  console.log(err.message || err);
  process.exit(1);
});

bot.on('end', (reason) => {
  console.log(`[!] Connection ended: ${reason}`);
});
