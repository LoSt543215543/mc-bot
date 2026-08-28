const dj = require('../dj');

module.exports = {
  name: 'skip',
  aliases: ['next'],
  description: 'Skips the currently playing song',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let reply, username;

    if (context && context.bot) {
      reply = context.reply || context.sendSafeChat;
      username = context.username;
    } else {
      reply = legacyArgs[3];
      username = legacyArgs[4] || 'LoSt54321';
    }

    if (!dj.isPlaying) {
      if (typeof reply === 'function') reply('[DJ]: No song is currently playing.');
      return;
    }

    if (typeof reply === 'function') reply(`[DJ]: Skipped track.`);
    dj.skip();
  }
};
