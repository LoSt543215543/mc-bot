const fs = require('fs');
const path = require('path');
const { Vec3 } = require('vec3');
const { goals } = require('mineflayer-pathfinder');

const STASIS_FILE = path.join(__dirname, '../stasis_locations.json');
let stasisChambers = {};

try {
  if (fs.existsSync(STASIS_FILE)) {
    stasisChambers = JSON.parse(fs.readFileSync(STASIS_FILE, 'utf8'));
  }
} catch (e) {
  console.error('[Stasis] Error loading stasis_locations.json:', e.message);
}

function saveChambers() {
  try {
    fs.writeFileSync(STASIS_FILE, JSON.stringify(stasisChambers, null, 2), 'utf8');
  } catch (e) {
    console.error('[Stasis] Error saving stasis_locations.json:', e.message);
  }
}

function defineChamber(username, coords) {
  const userKey = (username || 'UNKNOWN_USER').toLowerCase();
  stasisChambers[userKey] = coords;
  saveChambers();
}

function getChamber(username) {
  const userKey = (username || 'UNKNOWN_USER').toLowerCase();
  return stasisChambers[userKey] || null;
}

async function triggerStasis(bot, chat, username, defaultMove, replyFn) {
  const savedCoords = getChamber(username);
  if (!savedCoords) {
    replyFn(`No stasis chamber saved for you! Set it with: !stasis define <x> <y> <z>`);
    return;
  }

  const targetCoords = new Vec3(savedCoords.x, savedCoords.y, savedCoords.z);
  chat.log(`[STASIS] Heading to ${username}'s stasis chamber at (${targetCoords.x}, ${targetCoords.y}, ${targetCoords.z})...`);
  replyFn(`Activating your stasis chamber at (${targetCoords.x}, ${targetCoords.y}, ${targetCoords.z})...`);

  bot.pathfinder.setMovements(defaultMove);

  try {
    await bot.pathfinder.goto(new goals.GoalNear(targetCoords.x, targetCoords.y, targetCoords.z, 2.5));

    let trapdoorBlock = null;
    const offsets = [
      new Vec3(0, 0, 0), new Vec3(0, 1, 0), new Vec3(0, -1, 0),
      new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1)
    ];

    for (const off of offsets) {
      const b = bot.blockAt(targetCoords.plus(off));
      if (b && b.name && b.name.toLowerCase().includes('trapdoor')) {
        trapdoorBlock = b;
        break;
      }
    }

    if (!trapdoorBlock) {
      const b = bot.blockAt(targetCoords);
      if (b && b.name !== 'air') trapdoorBlock = b;
    }

    if (!trapdoorBlock) {
      replyFn(`Arrived, but no trapdoor found at (${targetCoords.x}, ${targetCoords.y}, ${targetCoords.z}).`);
      return;
    }

    await bot.lookAt(trapdoorBlock.position.offset(0.5, 0.5, 0.5), true);
    await bot.activateBlock(trapdoorBlock);
    chat.log(`[STASIS] Flipped trapdoor "${trapdoorBlock.name}" for ${username}`);
    replyFn(`Stasis trapdoor activated! Welcome back.`);
  } catch (err) {
    chat.log(`[STASIS Error]: ${err.message}`);
    replyFn(`Stasis navigation error: ${err.message}`);
  }
}

module.exports = {
  defineChamber,
  getChamber,
  triggerStasis
};
