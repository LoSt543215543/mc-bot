const { Vec3 } = require('vec3');

let combatTarget = null;
let combatInterval = null;
let strafeInterval = null;
let lastAttackTime = 0;

const WEAPON_TIERS = {
  'netherite_sword': 100,
  'diamond_sword': 90,
  'mace': 88,
  'netherite_axe': 85,
  'diamond_axe': 80,
  'trident': 75,
  'iron_sword': 70,
  'iron_axe': 65,
  'stone_sword': 50,
  'stone_axe': 45,
  'golden_sword': 35,
  'golden_axe': 30,
  'wooden_sword': 20,
  'wooden_axe': 15
};

async function equipBestWeapon(bot, chat) {
  if (!bot || !bot.inventory) return;

  const items = bot.inventory.items();
  let bestWeapon = null;
  let bestScore = -1;

  for (const item of items) {
    const score = WEAPON_TIERS[item.name] || -1;
    if (score > bestScore) {
      bestScore = score;
      bestWeapon = item;
    }
  }

  if (bestWeapon) {
    const currentHeld = bot.heldItem;
    if (!currentHeld || currentHeld.name !== bestWeapon.name) {
      try {
        await bot.equip(bestWeapon, 'hand');
        const name = bestWeapon.displayName || bestWeapon.name;
        chat.log(`[Combat] Equipped best weapon: ${name}`);
      } catch (err) {
        chat.log(`[Combat] Failed to equip ${bestWeapon.name}: ${err.message}`);
      }
    }
  }
}

function clampAngle(angle) {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

function stepLookAt(bot, targetVec, maxTurnRate = 0.22) {
  if (!bot.entity) return 999;

  const botEye = bot.entity.position.offset(0, 1.6, 0);
  const dx = targetVec.x - botEye.x;
  const dy = targetVec.y - botEye.y;
  const dz = targetVec.z - botEye.z;
  const dist2D = Math.hypot(dx, dz);

  const desiredYaw = Math.atan2(-dx, -dz);
  const desiredPitch = -Math.atan2(dy, dist2D);

  const curYaw = bot.entity.yaw;
  const curPitch = bot.entity.pitch;

  const diffYaw = clampAngle(desiredYaw - curYaw);
  const diffPitch = clampAngle(desiredPitch - curPitch);

  const stepYaw = Math.sign(diffYaw) * Math.min(Math.abs(diffYaw), maxTurnRate);
  const stepPitch = Math.sign(diffPitch) * Math.min(Math.abs(diffPitch), maxTurnRate * 0.8);

  bot.look(curYaw + stepYaw, curPitch + stepPitch, true);
  return Math.hypot(diffYaw, diffPitch) * (180 / Math.PI);
}

function stopCombat(bot) {
  combatTarget = null;
  if (combatInterval) {
    clearInterval(combatInterval);
    combatInterval = null;
  }
  if (strafeInterval) {
    clearInterval(strafeInterval);
    strafeInterval = null;
  }
  if (bot && bot.clearControlStates) {
    bot.clearControlStates();
  }
}

async function startCombat(bot, chat, targetName) {
  stopCombat(bot);

  // Auto-equip top weapon from inventory
  await equipBestWeapon(bot, chat);

  let target = null;
  const lowerName = targetName ? targetName.toLowerCase() : null;

  if (lowerName) {
    target = Object.values(bot.entities).find(e => 
      e !== bot.entity && 
      ((e.username && e.username.toLowerCase().includes(lowerName)) || 
       (e.name && e.name.toLowerCase().includes(lowerName)))
    );
  } else {
    const candidates = Object.values(bot.entities).filter(e => 
      e !== bot.entity && 
      (e.type === 'player' || e.type === 'hostile' || e.type === 'mob') &&
      e.position && 
      bot.entity.position.distanceTo(e.position) < 16
    );
    candidates.sort((a, b) => bot.entity.position.distanceTo(a.position) - bot.entity.position.distanceTo(b.position));
    target = candidates[0];
  }

  if (!target) {
    chat.log(`[Combat] No target found matching "${targetName || 'nearest entity'}".`);
    return false;
  }

  combatTarget = target;
  const label = target.username || target.name || 'target';
  chat.log(`[Combat] Engaged in combat with ${label}.`);

  // Randomized Human Strafe Loop
  strafeInterval = setInterval(() => {
    if (!combatTarget || !combatTarget.isValid) return;

    const rand = Math.random();
    if (rand < 0.35) {
      bot.setControlState('left', true);
      bot.setControlState('right', false);
    } else if (rand < 0.70) {
      bot.setControlState('left', false);
      bot.setControlState('right', true);
    } else {
      bot.setControlState('left', false);
      bot.setControlState('right', false);
    }

    if (Math.random() < 0.25 && bot.entity.onGround) {
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 250);
    }
  }, 650);

  // 20 TPS Combat Loop
  combatInterval = setInterval(() => {
    if (!combatTarget || !combatTarget.isValid) {
      chat.log('[Combat] Target lost or defeated.');
      stopCombat(bot);
      return;
    }

    const targetPos = combatTarget.position.offset(0, combatTarget.height ? combatTarget.height * 0.6 : 1.0, 0);
    const dist = bot.entity.position.distanceTo(combatTarget.position);

    const angleDiffDeg = stepLookAt(bot, targetPos, 0.28);

    // Obstacle vault assist when chasing
    if (bot.entity.isCollidedHorizontally && bot.entity.onGround) {
      bot.setControlState('jump', true);
    } else if (!bot.entity.isCollidedHorizontally && bot.entity.velocity.y < 0) {
      bot.setControlState('jump', false);
    }

    // Distance management
    if (dist > 3.0) {
      bot.setControlState('forward', true);
      bot.setControlState('back', false);
    } else if (dist < 1.8) {
      bot.setControlState('forward', false);
      bot.setControlState('back', true);
    } else {
      bot.setControlState('forward', false);
      bot.setControlState('back', false);
    }

    // Attack validation
    const now = Date.now();
    const cooldownJitter = 620 + (Math.random() * 80 - 40);

    if (dist <= 2.9 && angleDiffDeg <= 20 && now - lastAttackTime > cooldownJitter) {
      lastAttackTime = now;
      bot.attack(combatTarget);
    }
  }, 50);

  return true;
}

module.exports = {
  startCombat,
  stopCombat,
  equipBestWeapon,
  isCombatActive: () => combatTarget !== null
};
