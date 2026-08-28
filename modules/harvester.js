const { directMoveTo, setupPathfinder } = require('./movement');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getLogCount(bot) {
  if (!bot || !bot.inventory) return 0;
  return bot.inventory.items()
    .filter(item => item.name.includes('_log') || item.name.includes('_wood'))
    .reduce((sum, item) => sum + item.count, 0);
}

async function equipBestAxe(bot) {
  const axes = bot.inventory.items().filter(i => i.name.endsWith('_axe'));
  if (axes.length > 0) {
    try {
      await bot.equip(axes[0], 'hand');
    } catch (e) {}
  }
}

async function harvestTrees(bot, chat, targetLogs = 64, isCancelled = () => false) {
  setupPathfinder(bot);
  chat.log(`[Harvester] Starting tree harvest (Target: ${targetLogs} logs)...`);
  let initialLogs = getLogCount(bot);

  while (getLogCount(bot) - initialLogs < targetLogs && !isCancelled()) {
    // 1. Find nearest log within 32 blocks
    const targetBlock = bot.findBlock({
      matching: (block) => block && (block.name.includes('_log') || block.name.includes('_wood')),
      maxDistance: 32
    });

    if (!targetBlock) {
      chat.log('[Harvester] No trees/logs found in 32-block radius.');
      break;
    }

    // 2. A* Pathfind directly into chopping range (within 2.2 blocks)
    const blockPos = targetBlock.position;
    const dist = bot.entity.position.distanceTo(blockPos);

    if (dist > 2.5) {
      await directMoveTo(bot, blockPos, chat, 20000);
    }

    if (isCancelled()) break;

    // 3. Equip axe and chop
    await equipBestAxe(bot);

    try {
      await bot.lookAt(blockPos.offset(0.5, 0.5, 0.5), true);
      await bot.dig(targetBlock);
      await delay(250);
    } catch (err) {
      chat.log(`[Harvester] Dig interrupted: ${err.message}`);
      await delay(500);
    }
  }

  const collected = getLogCount(bot) - initialLogs;
  chat.log(`[Harvester] Finished. Gathered ${collected} logs.`);
  return collected;
}

module.exports = {
  harvestTrees,
  getLogCount
};
