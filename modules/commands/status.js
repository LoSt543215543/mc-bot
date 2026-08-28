module.exports = {
  name: 'status',
  aliases: ['diagnose', 'health', 'hp', 'stats'],
  description: 'Reports bot HP, food, coordinates, voice status, and active modules',
  adminOnly: false,
  djOnly: false,
  run: async (context) => {
    const { bot, sendSafeChat, voiceClient, getConvoMode, isDjPlaying } = context;
    if (!bot || !bot.entity) return;

    const hp = Math.round(bot.health || 20);
    const food = Math.round(bot.food || 20);
    const pos = bot.entity.position;
    const coords = `${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}`;
    const convo = typeof getConvoMode === 'function' && getConvoMode() ? 'ON' : 'OFF';
    const vcStatus = voiceClient ? (isDjPlaying() ? 'MUSIC PLAYING' : 'READY') : 'OFFLINE';

    const statusMsg = `[Status] HP: ${hp}/20 | Food: ${food}/20 | Pos: (${coords}) | Convo: ${convo} | Voice: ${vcStatus}`;
    console.log(statusMsg);

    if (typeof sendSafeChat === 'function') {
      sendSafeChat(statusMsg);
    }
  }
};
