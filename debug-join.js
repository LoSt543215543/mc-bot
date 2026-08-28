const mineflayer = require('mineflayer');
const CONFIG = require('./config');

console.log('[*] Starting deep packet trace to dripmc.net:12031...');

const bot = mineflayer.createBot({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  auth: CONFIG.auth,
  version: '1.20.4',
  checkTimeoutInterval: 60000
});

// Trace every incoming and outgoing packet name and state
bot._client.on('packet', (data, meta) => {
  const state = bot._client.state;
  if (!['keep_alive', 'update_time', 'chunk_data'].includes(meta.name)) {
    console.log(`[IN  | ${state.toUpperCase()}] Packet: ${meta.name}`);
  }
});

// Auto-respond to configuration-phase resource pack requests
bot._client.on('resource_pack_send', (data) => {
  console.log('[+] Received resource_pack_send. Sending ACCEPTED & SUCCESS...');
  try {
    bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 3 });
    setTimeout(() => {
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 0 });
    }, 100);
  } catch (e) {
    console.log('Error answering resource pack:', e.message);
  }
});

// Auto-respond to finish_configuration to force transition to PLAY state
bot._client.on('finish_configuration', () => {
  console.log('[+] Received finish_configuration. Acknowledging transition to PLAY state...');
  try {
    bot._client.write('finish_configuration', {});
  } catch (e) {}
});

bot.on('login', () => console.log('[✓] State: LOGIN SUCCESS'));
bot.on('spawn', () => console.log(`[✓] State: SPAWNED in world at (${bot.entity.position.x}, ${bot.entity.position.y}, ${bot.entity.position.z})!`));
bot.on('message', (msg) => console.log(`[Chat]: ${msg.toString()}`));
bot.on('kicked', (reason) => console.log('[!] Kicked:', JSON.stringify(reason, null, 2)));
bot.on('error', (err) => console.log('[!] Error:', err.message));
bot.on('end', (reason) => console.log(`[!] Disconnected: ${reason}`));
