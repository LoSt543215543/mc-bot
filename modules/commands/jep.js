const { stopAllActions } = require('../movement');

module.exports = {
  name: 'jep',
  aliases: ['jumpwalk', 'bhop'],
  execute({ bot, chat, parts, reply }) {
    if (!bot.entity) return;
    stopAllActions(bot);
    const seconds = (parts[1] && !isNaN(parseFloat(parts[1]))) ? parseFloat(parts[1]) : 2.5;
    const startPos = bot.entity.position.clone();

    bot.setControlState('forward', true);
    bot.setControlState('jump', true);
    bot.setControlState('sprint', true);
    reply(`Jump-walking for ${seconds.toFixed(1)}s...`);

    setTimeout(() => {
      if (bot && bot.entity) {
        bot.setControlState('forward', false);
        bot.setControlState('jump', false);
        bot.setControlState('sprint', false);
        const dist = startPos.distanceTo(bot.entity.position);
        chat.log(`[JEP] Jump-walk complete. Moved: ${dist.toFixed(2)}m`);
        reply(`Moved ${dist.toFixed(2)}m.`);
      }
    }, seconds * 1000);
  }
};
