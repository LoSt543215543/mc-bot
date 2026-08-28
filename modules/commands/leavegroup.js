module.exports = {
  name: 'leavegroup',
  aliases: ['vcleave', 'groupleave', 'uninvite'],
  execute({ bot, reply }) {
    bot.chat('/voicechat leave');
    reply('Left voice chat group.');
  }
};
