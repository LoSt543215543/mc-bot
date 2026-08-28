module.exports = {
  name: 'ban',
  aliases: ['banish'],
  adminOnly: true,
  execute({ bot, chat, voiceClient, username }) {
    if (voiceClient) voiceClient.stopPlayback();
    bot.chat('banned by owner');
    chat.log(`[BAN] Triggered by ${username}`);
    setTimeout(() => {
      try { bot.quit('banned by owner'); } catch (e) {}
      process.exit(0);
    }, 500);
  }
};
