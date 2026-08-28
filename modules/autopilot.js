const { Vec3 } = require('vec3');

let isCruising = false;
let stopRequested = false;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getYawTo(botPos, target) {
  const dx = target.x - botPos.x;
  const dz = target.z - botPos.z;
  return Math.atan2(-dx, -dz);
}

async function driveToPoint(bot, targetX, targetZ, chat, tolerance = 4) {
  const target = new Vec3(targetX, bot.entity.position.y, targetZ);
  bot.setControlState('forward', true);
  bot.setControlState('sprint', true);

  while (!stopRequested) {
    const pos = bot.entity.position;
    const dist2D = Math.hypot(target.x - pos.x, target.z - pos.z);

    if (dist2D <= tolerance) break;

    const desiredYaw = getYawTo(pos, target);
    await bot.look(desiredYaw, 0, true);
    await delay(100);
  }

  bot.setControlState('forward', false);
  bot.setControlState('sprint', false);
}

async function mountNearestBoat(bot, chat) {
  const boatEntity = bot.nearestEntity(e => 
    e.name?.includes('boat') || e.displayName?.toLowerCase().includes('boat')
  );

  if (!boatEntity) {
    chat.log('[Autopilot] No boat found within 5 blocks.');
    return false;
  }

  chat.log('[Autopilot] Mounting boat...');
  bot.mount(boatEntity);
  await delay(1000);
  return true;
}

async function startGridSweep(bot, minX, maxX, minZ, maxZ, laneSpacing, chat) {
  if (isCruising) {
    chat.log('[Autopilot] Grid sweep already active. Use !stop first.');
    return;
  }

  isCruising = true;
  stopRequested = false;

  chat.log(`[Autopilot] Starting sweep: X [${minX}, ${maxX}] | Z [${minZ}, ${maxZ}] (Step: ${laneSpacing}m)`);

  let currentX = minX;
  let goingNorth = true;

  while (currentX <= maxX && !stopRequested) {
    const targetZ = goingNorth ? maxZ : minZ;
    chat.log(`[Autopilot] Lane X=${currentX} -> Heading to Z=${targetZ}`);

    await driveToPoint(bot, currentX, targetZ, chat);
    if (stopRequested) break;

    currentX += laneSpacing;
    if (currentX <= maxX && !stopRequested) {
      chat.log(`[Autopilot] Moving East to next lane: X=${currentX}`);
      await driveToPoint(bot, currentX, targetZ, chat);
    }

    goingNorth = !goingNorth;
  }

  bot.setControlState('forward', false);
  bot.setControlState('sprint', false);
  isCruising = false;
  chat.log('[Autopilot] Sweep complete or halted.');
}

function stopAutopilot(bot) {
  stopRequested = true;
  isCruising = false;
  bot.setControlState('forward', false);
  bot.setControlState('sprint', false);
}

module.exports = {
  mountNearestBoat,
  driveToPoint,
  startGridSweep,
  stopAutopilot
};
