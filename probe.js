const mineflayer = require('mineflayer');
const CONFIG = require('./config');

console.log('[1/5] Initializing Mineflayer client...');
console.log(`Target: ${CONFIG.host}:${CONFIG.port} | User: ${CONFIG.username} | Version: ${CONFIG.version || 'auto'}`);

const bot = mineflayer.createBot({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  auth: CONFIG.auth || 'offline',
  version: CONFIG.version || false,
  checkTimeoutInterval: 30000
});

// 1. Connection Lifecycle
bot._client.on('connect', () => console.log('[2/5] TCP Socket Connected to Server!'));

bot._client.on('packet', (data, meta) => {
  // Log critical login/configuration packets
  if (['login', 'game_state_change', 'resource_pack_send', 'transfer', 'custom_payload', 'keep_alive'].includes(meta.name)) {
    console.log(`[PACKET IN: ${meta.state} -> ${meta.name}]`);
  }
});

// 2. Resource Pack Auto-Accept (Prevents spawn hangs)
bot._client.on('resource_pack_send', (data) => {
  console.log('[3/5] Server sent resource pack. Auto-accepting...');
  try {
    bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 3 }); // ACCEPTED
    bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 0 }); // SUCCESSFULLY_LOADED
  } catch (e) {}
});

bot._client.on('add_resource_pack', (data) => {
  console.log('[3/5] Server added resource pack. Auto-accepting...');
  try {
    bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 3 });
    bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 0 });
  } catch (e) {}
});

// 3. Login & Spawn Events
bot.on('login', () => console.log('[4/5] Login Packet Received! Waiting for terrain chunks...'));

bot.once('spawn', () => {
  console.log('[5/5] SUCCESS: Bot officially spawned in world!');
  console.log(`- Position: (${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.y.toFixed(1)}, ${bot.entity.position.z.toFixed(1)})`);
  console.log(`- Game Mode: ${bot.game.gameMode}`);
  console.log(`- Hardcore: ${bot.game.hardcore}`);
  console.log(`- Dimension: ${bot.game.dimension}`);

  // Test physical control states
  console.log('\n[*] Attempting 1-second WASD forward press...');
  bot.setControlState('forward', true);
  setTimeout(() => {
    bot.setControlState('forward', false);
    console.log('[*] WASD forward test completed.');
  }, 1000);
});

// 4. Failure Listeners
bot.on('kicked', (reason) => console.log('[DISCONNECT: KICKED]', JSON.stringify(reason)));
bot.on('end', (reason) => console.log('[DISCONNECT: END]', reason));
bot.on('error', (err) => console.log('[ERROR]', err.message));

// Watchdog timer if no packets arrive within 8s
setTimeout(() => {
  if (!bot.entity) {
    console.log('\n[!] WATCHDOG: 8 seconds elapsed without world spawn.');
    console.log(`- Socket State: ${bot._client.state}`);
  }
}, 8000);
