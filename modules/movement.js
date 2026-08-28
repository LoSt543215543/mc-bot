const { Movements } = require('mineflayer-pathfinder');

let defaultMove = null;

function setupMovement(bot, chat) {
  defaultMove = new Movements(bot);
  defaultMove.canDig = false;
  defaultMove.allowParkour = true;
  defaultMove.allowSprinting = true;
  defaultMove.maxDropDown = 4;

  bot.pathfinder.setMovements(defaultMove);

  // Auto-jump for manual WASD (inactive during Pathfinder routines)
  bot.on('physicsTick', () => {
    if (!bot.entity) return;

    const isPathfinding = bot.pathfinder && bot.pathfinder.isMoving();
    if (isPathfinding) return;

    const isManualMoving = bot.controlState.forward || 
                           bot.controlState.back || 
                           bot.controlState.left || 
                           bot.controlState.right;

    if (isManualMoving && bot.entity.isCollidedHorizontally && bot.entity.onGround) {
      bot.setControlState('jump', true);
    } else if (!bot.entity.onGround && bot.controlState.jump && !isManualMoving) {
      bot.setControlState('jump', false);
    }
  });

  return defaultMove;
}

function stopAllActions(bot) {
  if (!bot) return;
  if (bot.pathfinder) {
    try {
      bot.pathfinder.setGoal(null);
      bot.pathfinder.stop();
    } catch (e) {}
  }
  if (bot.clearControlStates) {
    bot.clearControlStates();
  }
}

function resolveCoordinate(valStr, botAxisPos) {
  if (!valStr) return botAxisPos;
  valStr = valStr.toString().trim();
  if (valStr.startsWith('~')) {
    const offset = parseFloat(valStr.slice(1)) || 0;
    return Math.floor(botAxisPos + offset);
  }
  const num = parseFloat(valStr);
  return isNaN(num) ? botAxisPos : Math.floor(num);
}

module.exports = {
  setupMovement,
  stopAllActions,
  resolveCoordinate
};
