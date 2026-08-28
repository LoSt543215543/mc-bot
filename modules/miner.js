const { Vec3 } = require('vec3');
const { goals } = require('mineflayer-pathfinder');

let isMining = false;
let miningAbort = false;

const TOOL_TIERS = {
  pickaxes: [
    'netherite_pickaxe',
    'diamond_pickaxe',
    'iron_pickaxe',
    'golden_pickaxe',
    'stone_pickaxe',
    'wooden_pickaxe'
  ],
  shovels: [
    'netherite_shovel',
    'diamond_shovel',
    'iron_shovel',
    'golden_shovel',
    'stone_shovel',
    'wooden_shovel'
  ],
  axes: [
    'netherite_axe',
    'diamond_axe',
    'iron_axe',
    'golden_axe',
    'stone_axe',
    'wooden_axe'
  ]
};

function isMiningRunning() {
  return isMining;
}

function stopMining(bot) {
  miningAbort = true;
  isMining = false;
  if (bot && bot.pathfinder) {
    try {
      bot.pathfinder.setGoal(null);
      bot.pathfinder.stop();
    } catch (e) {}
  }
}

async function equipBestTool(bot, targetBlock) {
  if (!bot || !bot.inventory || !targetBlock) return;

  const blockName = targetBlock.name.toLowerCase();
  const items = bot.inventory.items();

  let preferredList = TOOL_TIERS.pickaxes;
  if (
    blockName.includes('dirt') ||
    blockName.includes('sand') ||
    blockName.includes('gravel') ||
    blockName.includes('clay') ||
    blockName.includes('soul_')
  ) {
    preferredList = TOOL_TIERS.shovels;
  } else if (
    blockName.includes('log') ||
    blockName.includes('wood') ||
    blockName.includes('plank') ||
    blockName.includes('stem')
  ) {
    preferredList = TOOL_TIERS.axes;
  }

  // Find highest tier tool for block
  for (const toolName of preferredList) {
    const found = items.find(i => i.name === toolName);
    if (found) {
      if (!bot.heldItem || bot.heldItem.name !== toolName) {
        await bot.equip(found, 'hand');
      }
      return;
    }
  }

  // Fallback to highest tier pickaxe
  for (const toolName of TOOL_TIERS.pickaxes) {
    const found = items.find(i => i.name === toolName);
    if (found) {
      if (!bot.heldItem || bot.heldItem.name !== toolName) {
        await bot.equip(found, 'hand');
      }
      return;
    }
  }
}

function isUnderBot(bot, targetPos) {
  if (!bot.entity) return false;
  const bp = bot.entity.position;
  const dx = Math.abs(bp.x - (targetPos.x + 0.5));
  const dz = Math.abs(bp.z - (targetPos.z + 0.5));
  const dy = bp.y - targetPos.y;

  return dx < 0.85 && dz < 0.85 && dy >= 0 && dy <= 1.5;
}

async function emergencyPillarOut(bot, chat) {
  const held = bot.inventory.items().find(i => 
    i.name.includes('dirt') || i.name.includes('cobblestone') || 
    i.name.includes('stone') || i.name.includes('planks') || i.name.includes('netherrack')
  );

  if (!held) {
    chat.log('[Miner Alert] Trapped in hole and have no solid blocks to pillar up!');
    return false;
  }

  chat.log('[Miner] Trapped in hole - auto-pillaring up...');
  await bot.equip(held, 'hand');
  
  const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));
  if (!blockBelow) return false;

  bot.setControlState('jump', true);
  await new Promise(r => setTimeout(r, 280));
  try {
    await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
  } catch (e) {}
  bot.setControlState('jump', false);
  await new Promise(r => setTimeout(r, 200));
  return true;
}

async function startMineAndReplace(bot, chat, box, replaceBlockName) {
  if (isMining) {
    chat.log('[Miner] A mining task is already running.');
    return;
  }

  isMining = true;
  miningAbort = false;

  const targetPositions = [];

  // Collect all coordinates in bounding box
  for (let y = box.maxY; y >= box.minY; y--) {
    for (let x = box.minX; x <= box.maxX; x++) {
      for (let z = box.minZ; z <= box.maxZ; z++) {
        targetPositions.push(new Vec3(x, y, z));
      }
    }
  }

  // Top-Down Layer Sorting (Highest Y first, then closest distance)
  targetPositions.sort((a, b) => {
    if (b.y !== a.y) return b.y - a.y;
    const distA = bot.entity.position.distanceSquared(a);
    const distB = bot.entity.position.distanceSquared(b);
    return distA - distB;
  });

  chat.log(`[Miner] Found ${targetPositions.length} target blocks across Y:${box.maxY} -> Y:${box.minY}.`);

  for (const pos of targetPositions) {
    if (miningAbort || !isMining) break;

    const block = bot.blockAt(pos);
    if (!block || block.name === 'air' || block.name === 'cave_air' || block.name === 'bedrock') {
      continue;
    }

    // Step off target block if standing directly on it
    if (isUnderBot(bot, pos)) {
      const safeOffsets = [
        new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
        new Vec3(0, 0, 1), new Vec3(0, 0, -1)
      ];

      for (const off of safeOffsets) {
        const checkPos = bot.entity.position.plus(off);
        const checkBlock = bot.blockAt(checkPos.offset(0, -1, 0));
        const checkAir = bot.blockAt(checkPos);
        if (checkBlock && checkBlock.name !== 'air' && checkAir && checkAir.name === 'air') {
          try {
            await bot.pathfinder.goto(new goals.GoalNear(checkPos.x, checkPos.y, checkPos.z, 0.5));
            break;
          } catch (e) {}
        }
      }
    }

    // Move within dig reach (3.2 blocks)
    const dist = bot.entity.position.distanceTo(pos);
    if (dist > 4.2) {
      try {
        await bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, 3.2));
      } catch (err) {
        const headBlock = bot.blockAt(bot.entity.position.offset(1, 0, 0));
        const headBlock2 = bot.blockAt(bot.entity.position.offset(-1, 0, 0));
        if (headBlock && headBlock.name !== 'air' && headBlock2 && headBlock2.name !== 'air') {
          await emergencyPillarOut(bot, chat);
        }
        continue;
      }
    }

    // Re-verify block after pathfinding
    const targetBlock = bot.blockAt(pos);
    if (!targetBlock || targetBlock.name === 'air') continue;

    // Explicitly equip best tool
    try {
      await equipBestTool(bot, targetBlock);
    } catch (e) {}

    // Dig block
    try {
      await bot.dig(targetBlock);
    } catch (err) {
      chat.log(`[Miner Warn] Dig failed @ ${pos.x},${pos.y},${pos.z}: ${err.message}`);
      continue;
    }

    // Replacement block placement
    if (replaceBlockName) {
      const itemToPlace = bot.inventory.items().find(i => 
        i.name.toLowerCase().includes(replaceBlockName.toLowerCase())
      );

      if (itemToPlace) {
        try {
          await bot.equip(itemToPlace, 'hand');
          const refBlock = bot.blockAt(pos.offset(0, -1, 0)) || bot.blockAt(pos.offset(1, 0, 0));
          if (refBlock) {
            await bot.placeBlock(refBlock, new Vec3(0, 1, 0));
          }
        } catch (e) {}
      }
    }
  }

  isMining = false;
  chat.log('[Miner] Mining area task complete!');
}

module.exports = {
  startMineAndReplace,
  stopMining,
  isMiningRunning
};
