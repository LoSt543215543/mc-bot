module.exports = {
  name: 'goto',
  aliases: ['walkto', 'nav'],
  description: 'Navigates the bot to explicit X Y Z world coordinates',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let bot = context?.bot || context;
    let args = context?.args || (Array.isArray(legacyArgs[0]) ? legacyArgs[0] : []);
    let sendSafeChat = context?.sendSafeChat || ((msg) => bot?.chat(msg));
    let defaultMove = context?.defaultMove;

    if (!args || args.length < 2) {
      if (typeof sendSafeChat === 'function') sendSafeChat(`Usage: !goto <x> <y> <z> or !goto <x> <z>`);
      return;
    }

    let x = parseFloat(args[0]);
    let y = args.length >= 3 ? parseFloat(args[1]) : (bot.entity ? Math.round(bot.entity.position.y) : 64);
    let z = args.length >= 3 ? parseFloat(args[2]) : parseFloat(args[1]);

    if (isNaN(x) || isNaN(z)) {
      if (typeof sendSafeChat === 'function') sendSafeChat(`[Bot]: Invalid coordinates.`);
      return;
    }

    try {
      const { Movements, goals } = require('mineflayer-pathfinder');
      const mcData = require('minecraft-data')(bot.version);

      const move = defaultMove || new Movements(bot, mcData);
      bot.pathfinder.setMovements(move);
      bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, 1));

      if (typeof sendSafeChat === 'function') {
        sendSafeChat(`[Bot]: Navigating to (${Math.round(x)}, ${Math.round(y)}, ${Math.round(z)})...`);
      }
    } catch (err) {
      console.error('[Goto Error]:', err.message);
      if (typeof sendSafeChat === 'function') sendSafeChat(`[Bot]: Navigation failed: ${err.message}`);
    }
  }
};
