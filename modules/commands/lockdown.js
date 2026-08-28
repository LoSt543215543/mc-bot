const security = require('../security');

module.exports = {
  name: 'lockdown',
  aliases: ['ld', 'lock'],
  description: 'Toggles security lockdown mode (Admin only)',
  adminOnly: true,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let reply, args, username;

    if (context && context.bot) {
      reply = context.reply || context.sendSafeChat;
      args = context.args || [];
      username = context.username;
    } else {
      reply = legacyArgs[3];
      username = legacyArgs[4] || 'LoSt54321';
      const raw = legacyArgs[5] || '';
      args = Array.isArray(legacyArgs[6]) ? legacyArgs[6] : (raw ? raw.split(/\s+/).slice(1) : []);
    }

    const sendReply = reply || ((msg) => console.log(`[Lockdown] ${msg}`));

    let state;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'on' || sub === 'enable' || sub === '1' || sub === 'true') {
      state = security.setLockdown(true);
    } else if (sub === 'off' || sub === 'disable' || sub === '0' || sub === 'false') {
      state = security.setLockdown(false);
    } else {
      state = security.toggleLockdown();
    }

    const msg = `[Security]: Bot lockdown mode is now ${state ? 'ENABLED' : 'DISABLED'}.`;
    console.log(`[Lockdown] Executed by ${username} -> ${state ? 'ON' : 'OFF'}`);
    sendReply(msg);
  }
};
