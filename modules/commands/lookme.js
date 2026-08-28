const { stopAllActions } = require('../movement');

module.exports = {
  name: 'lookme',
  aliases: ['look'],
  async execute({ bot, username, reply }) {
    const pObj = bot.players[username];
    if (!pObj || !pObj.entity) { reply('Cannot see you!'); return; }
    stopAllActions(bot);
    await bot.lookAt(pObj.entity.position.offset(0, 1.6, 0), true);
    reply('Looking at your eyes.');
  }
};
