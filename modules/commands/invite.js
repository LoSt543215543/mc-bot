module.exports = {
  name: 'invite',
  aliases: ['inv'],
  description: 'Invites a player to party',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let bot, reply, args, username;

    if (context && context.bot) {
      bot = context.bot;
      reply = context.reply || context.sendSafeChat;
      args = context.args || [];
      username = context.username;
    } else {
      bot = context;
      reply = legacyArgs[3];
      username = legacyArgs[4];
      const raw = legacyArgs[5] || '';
      args = raw.split(/\s+/).slice(1);
    }

    const sendDm = reply || ((msg) => bot?.whisper?.(username, msg) || console.log(`[Invite]: ${msg}`));
    const target = args && args[0] ? args[0].trim() : null;

    if (!target) {
      sendDm('[Invite]: Specify a username: !invite <player>');
      return;
    }

    if (bot && typeof bot.chat === 'function') {
      // DripMC / standard Paper party command
      bot.chat(`/party invite ${target}`);
      sendDm(`[Invite]: Sent party invite to "${target}".`);
    }
  }
};
