module.exports = {
  name: 'inv',
  aliases: ['inventory'],
  execute({ bot, reply }) {
    const items = bot.inventory.items();
    if (!items || items.length === 0) { reply('Inventory is empty.'); return; }
    const map = new Map();
    for (const item of items) {
      const displayName = item.displayName || item.name;
      map.set(displayName, (map.get(displayName) || 0) + item.count);
    }
    const summary = Array.from(map.entries()).map(([n, c]) => `${c}x ${n}`).join(', ');
    reply(`Inv: ${summary}`);
  }
};
