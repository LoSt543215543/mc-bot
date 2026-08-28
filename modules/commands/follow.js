module.exports = {
  name: 'follow',
  aliases: ['stalk', 'come', 'tome'],
  description: 'Pathfinds and follows the caller or a target player',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    // Universal Context Extraction
    let bot = context?.bot;
    let username = context?.username;
    let args = context?.args || [];
    let sendSafeChat = context?.sendSafeChat;
    let defaultMove = context?.defaultMove;

    if (!bot) {
      bot = context;
      args = Array.isArray(legacyArgs[0]) ? legacyArgs[0] : (typeof legacyArgs[5] === 'string' ? legacyArgs[5].split(/\s+/).slice(1) : []);
      username = legacyArgs[4] || 'LoSt54321';
      sendSafeChat = typeof legacyArgs[3] === 'function' ? legacyArgs[3] : (msg) => bot?.chat(msg);
    }

    if (!bot || !bot.players) {
      console.warn('[Follow] Bot instance not ready.');
      return;
    }

    // Determine target player name
    const targetName = (args && args.length > 0 ? args[0] : username).replace(/^@/, '').trim();
    if (!targetName) return;

    const targetPlayer = bot.players[targetName];
    if (!targetPlayer || !targetPlayer.entity) {
      const failMsg = `[Bot]: Cannot follow ${targetName} (Player entity not within render distance).`;
      if (typeof sendSafeChat === 'function') sendSafeChat(failMsg);
      return;
    }

    try {
      const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
      const mcData = require('minecraft-data')(bot.version);

      if (!bot.pathfinder) {
        console.warn('[Follow] Initializing mineflayer-pathfinder plugin on bot.');
        bot.loadPlugin(pathfinder);
      }

      const move = defaultMove || new Movements(bot, mcData);
      move.canDig = false;
      move.allowParkour = true;
      move.allowSprinting = true;

      bot.pathfinder.setMovements(move);
      const goal = new goals.GoalFollow(targetPlayer.entity, 2);
      bot.pathfinder.setGoal(goal, true);

      const successMsg = `[Bot]: Now following ${targetName} [${Math.round(targetPlayer.entity.position.x)}, ${Math.round(targetPlayer.entity.position.y)}, ${Math.round(targetPlayer.entity.position.z)}].`;
      if (typeof sendSafeChat === 'function') sendSafeChat(successMsg);
      console.log(`[Follow] Active target: ${targetName}`);
    } catch (err) {
      console.error('[Follow Error]:', err.message);
      if (typeof sendSafeChat === 'function') sendSafeChat(`[Bot]: Pathfinding error: ${err.message}`);
    }
  }
};
