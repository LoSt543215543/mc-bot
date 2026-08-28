module.exports = {
  name: 'tome',
  aliases: ['come', 'here'],
  description: 'Navigates the bot to the calling player',
  adminOnly: false,
  djOnly: false,
  run: async (context) => {
    const followCmd = require('./follow');
    if (followCmd && typeof followCmd.run === 'function') {
      await followCmd.run(context);
    }
  }
};
