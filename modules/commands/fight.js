const { startCombat } = require('../combat');
const { stopAllActions } = require('../movement');

module.exports = {
  name: 'fight',
  aliases: ['attack', 'pvp', 'killmob'],
  async execute({ bot, chat, parts, reply }) {
    const targetName = parts[1] ? parts[1].trim() : null;
    stopAllActions(bot);
    const success = await startCombat(bot, chat, targetName);
    reply(success ? `Engaging ${targetName || 'nearest target'}.` : 'No target found.');
  }
};
