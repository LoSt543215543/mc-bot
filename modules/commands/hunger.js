module.exports = {
  name: 'hunger',
  aliases: ['food'],
  execute({ bot, reply }) {
    reply(`Hunger: ${Math.round(bot.food || 20)}/20`);
  }
};
