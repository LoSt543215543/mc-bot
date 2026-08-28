module.exports = {
  name: 'kys',
  aliases: ['kill', 'die', 'respawn'],
  description: 'Forces the bot to respawn or execute /kill',
  adminOnly: true,
  djOnly: false,
  run: async ({ bot, sendSafeChat, username }) => {
    console.log(`[Command:kys] Requested by ${username}`);
    if (typeof sendSafeChat === 'function') sendSafeChat('/kill');
    if (bot && typeof bot.respawn === 'function') {
      setTimeout(() => {
        try { bot.respawn(); } catch (e) {}
      }, 1000);
    }
  }
};
