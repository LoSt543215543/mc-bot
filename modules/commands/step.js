const { stopAllActions } = require('../movement');

module.exports = {
  name: 'step',
  aliases: ['walk'],
  execute({ bot, chat, reply }) {
    stopAllActions(bot);
    const start = bot.entity.position.clone();
    bot.setControlState('forward', true);
    setTimeout(() => {
      if (bot && bot.entity) {
        bot.setControlState('forward', false);
        const movedDist = start.distanceTo(bot.entity.position);
        chat.log(`[STEP] Moved: ${movedDist.toFixed(2)}m`);
        reply(`Stepped forward ${movedDist.toFixed(2)}m.`);
      }
    }, 1000);
  }
};
