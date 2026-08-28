module.exports = {
  name: 'players',
  aliases: ['list', 'online', 'who'],
  execute({ bot, reply }) {
    const list = Object.values(bot.players || {}).map(p => p.username).filter(Boolean);
    const total = list.length;
    if (total === 0) { reply('No players on tablist.'); return; }
    const preview = list.slice(0, 8).join(', ');
    const extra = total > 8 ? ` (+${total - 8} more)` : '';
    reply(`Online (${total}): ${preview}${extra}`);
  }
};
