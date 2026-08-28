const { startMineAndReplace } = require('../miner');
const { stopAllActions, resolveCoordinate } = require('../movement');

module.exports = {
  name: 'mine',
  aliases: ['dig', 'quarry'],
  execute({ bot, chat, parts, reply }) {
    if (parts.length < 7) { reply('Usage: !mine <x1 y1 z1 x2 y2 z2> [replace <block>]'); return; }
    const botPos = bot.entity.position;
    const x1 = resolveCoordinate(parts[1], botPos.x), y1 = resolveCoordinate(parts[2], botPos.y), z1 = resolveCoordinate(parts[3], botPos.z);
    const x2 = resolveCoordinate(parts[4], botPos.x), y2 = resolveCoordinate(parts[5], botPos.y), z2 = resolveCoordinate(parts[6], botPos.z);
    const box = { minX: Math.min(x1, x2), maxX: Math.max(x1, x2), minY: Math.min(y1, y2), maxY: Math.max(y1, y2), minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2) };
    
    let replaceBlock = null;
    const replaceIdx = parts.findIndex(p => p.toLowerCase() === 'replace');
    if (replaceIdx !== -1 && parts[replaceIdx + 1]) replaceBlock = parts[replaceIdx + 1].trim();

    stopAllActions(bot);
    reply(`Mining box (${box.minX},${box.minY},${box.minZ}) to (${box.maxX},${box.maxY},${box.maxZ})...`);
    startMineAndReplace(bot, chat, box, replaceBlock);
  }
};
