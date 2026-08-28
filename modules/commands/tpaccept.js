module.exports = {
  name: 'tpaccept',
  aliases: ['tpyes', 'tpok', 'tpdeny', 'tpno'],
  description: 'Accepts or denies incoming teleport requests',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let bot, sendSafeChat, command;

    if (context && context.bot) {
      bot = context.bot;
      sendSafeChat = context.sendSafeChat || context.reply;
      command = context.command || 'tpaccept';
    } else {
      bot = context;
      sendSafeChat = legacyArgs[3] || ((msg) => bot?.chat?.(msg));
      command = 'tpaccept';
    }

    const reply = sendSafeChat || ((msg) => { if (bot && typeof bot.chat === 'function') bot.chat(msg); });

    if (command.includes('deny') || command.includes('no')) {
      reply('/tpdeny');
      console.log('[TPA] Sent /tpdeny');
    } else {
      reply('/tpaccept');
      console.log('[TPA] Sent /tpaccept');
    }
  }
};
