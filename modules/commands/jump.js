module.exports = {
  name: 'jump',
  aliases: ['hop'],
  execute({ bot, reply }) {
    bot.setControlState('jump', true);
    setTimeout(() => { 
      if (bot) bot.setControlState('jump', false); 
      reply('Jumped!'); 
    }, 300);
  }
};
