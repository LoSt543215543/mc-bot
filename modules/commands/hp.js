module.exports = {
  name: 'hp',
  aliases: ['health'],
  execute({ bot, reply }) {
    reply(`Health: ${Math.round(bot.health || 20)}/20 HP`);
  }
};
