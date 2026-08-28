module.exports = {
  name: 'drop',
  aliases: [],
  async execute({ bot, cleanCmd, reply }) {
    const query = cleanCmd.replace(/^!drop\s+/i, '').trim().toLowerCase();
    if (!query || query === '!drop') { reply('Usage: !drop <item_name>'); return; }
    const matches = bot.inventory.items().filter(item => {
      const name = (item.name || '').toLowerCase();
      const displayName = (item.displayName || '').toLowerCase();
      return name.includes(query) || displayName.includes(query);
    });
    if (matches.length === 0) { reply(`No items matching "${query}" found.`); return; }
    let total = 0;
    const label = matches[0].displayName || matches[0].name;
    for (const item of matches) {
      try { total += item.count; await bot.tossStack(item); } catch (e) {}
    }
    reply(`Dropped ${total}x ${label}.`);
  }
};
