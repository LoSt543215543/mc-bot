module.exports = {
  name: 'tpa',
  aliases: ['tp', 'teleport', 'tpask', 'tpme', 'tpahere'],
  description: 'Sends or manages teleport requests',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let bot, sendSafeChat, username, args, command;

    if (context && context.bot) {
      bot = context.bot;
      sendSafeChat = context.sendSafeChat || context.reply;
      username = context.username;
      args = context.args || [];
      command = context.command || 'tpa';
    } else {
      bot = context;
      sendSafeChat = legacyArgs[3] || ((msg) => bot?.chat?.(msg));
      username = legacyArgs[4] || 'LoSt54321';
      const raw = legacyArgs[5] || '';
      args = raw.split(/\s+/).slice(1);
      command = 'tpa';
    }

    const reply = sendSafeChat || ((msg) => { if (bot && typeof bot.chat === 'function') bot.chat(msg); });

    // Handle subcommands: !tpa accept / !tpa deny
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'accept' || sub === 'yes') {
      reply('/tpaccept');
      return;
    }
    if (sub === 'deny' || sub === 'no') {
      reply('/tpdeny');
      return;
    }

    // Determine target player
    let target = (args[0] || '').replace(/^@/, '').trim();

    // If no target provided, default to the caller
    if (!target) {
      target = username;
    }

    if (command === 'tpme' || command === 'tpahere') {
      reply(`/tpahere ${target}`);
      console.log(`[TPA] Requested /tpahere ${target}`);
    } else {
      reply(`/tpa ${target}`);
      console.log(`[TPA] Requested /tpa ${target}`);
    }
  }
};
