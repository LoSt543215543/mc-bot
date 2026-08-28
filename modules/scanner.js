const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../bases_found.txt');

// Blocks indicating player builds/stashes
const TARGET_BLOCK_NAMES = [
  'nether_portal',
  'respawn_anchor',
  'ender_chest',
  'shulker_box',
  'white_shulker_box',
  'beacon',
  'enchanting_table',
  'brewing_stand',
  'chest',
  'trapped_chest',
  'barrel'
];

function initScanner(bot, chat) {
  let targetIds = new Set();
  const loggedLocations = new Set();

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    targetIds = new Set(
      TARGET_BLOCK_NAMES
        .map(name => mcData.blocksByName[name]?.id)
        .filter(Boolean)
    );
    chat.log('[Scanner] Passive chunk sniffer online.');
  });

  // Fires automatically every time a chunk enters the bot's render memory
  bot.on('chunkColumnLoad', (chunkPoint) => {
    const startX = chunkPoint.x * 16;
    const startZ = chunkPoint.z * 16;
    const minHeight = bot.game.minY || 0;
    const maxHeight = bot.game.height || 256;

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        for (let y = minHeight; y < maxHeight; y++) {
          const block = bot.blockAt(bot.entity.position.set(startX + x, y, startZ + z), false);

          if (block && targetIds.has(block.type)) {
            const chunkKey = `${Math.floor(block.position.x / 16)},${Math.floor(block.position.z / 16)}`;

            if (!loggedLocations.has(chunkKey)) {
              loggedLocations.add(chunkKey);

              const isNether = bot.game.dimension === 'minecraft:the_nether' || bot.game.dimension === -1;
              const ovwX = isNether ? block.position.x * 8 : block.position.x;
              const ovwZ = isNether ? block.position.z * 8 : block.position.z;

              const alertMsg = `[BASE FOUND] ${block.name} @ Nether (${block.position.x}, ${block.position.y}, ${block.position.z}) -> Overworld (~${ovwX}, ~${ovwZ})`;
              
              chat.log(alertMsg);
              fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} | ${alertMsg}\n`);
            }
          }
        }
      }
    }
  });
}

module.exports = initScanner;
