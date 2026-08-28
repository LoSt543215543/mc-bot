const { stopCombat } = require('../combat');

module.exports = {
  name: 'stopfight',
  aliases: ['peace'],
  execute({ bot, reply }) {
    stopCombat(bot);
    reply('Combat mode deactivated.');
  }
};
