const dj = require('../dj');

module.exports = {
  name: 'stop',
  aliases: ['halt', 'freeze', 'stopall', 'peace'],
  description: 'Immediately halts bot movement, pathfinding, and music playback',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let bot, reply;

    if (context && context.bot) {
      bot = context.bot;
      reply = context.reply || context.sendSafeChat;
    } else {
      bot = context;
      reply = legacyArgs[3] || ((msg) => bot?.chat?.(msg));
    }

    const sendReply = reply || ((msg) => { if (bot && typeof bot.chat === 'function') bot.chat(msg); });

    // 1. Stop Pathfinder & Navigation
    if (bot && bot.pathfinder) {
      try {
        bot.pathfinder.setGoal(null);
        bot.pathfinder.stop();
      } catch (e) {}
    }

    // 2. Clear key/movement states
    if (bot && typeof bot.setControlState === 'function') {
      ['forward', 'back', 'left', 'right', 'jump', 'sprint', 'sneak'].forEach(ctrl => {
        try { bot.setControlState(ctrl, false); } catch (e) {}
      });
    }

    // 3. Stop DJ / Music Streams
    try {
      dj.stop();
    } catch (e) {}

    console.log('[Stop] Halted all movements, actions, and audio streams.');
    sendReply('[Bot]: Movement and music playback stopped.');
  }
};
