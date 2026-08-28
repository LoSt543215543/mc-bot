module.exports = {
  name: 'dropall',
  aliases: [],
  async execute({ bot, reply }) {
    const items = bot.inventory.items();
    if (!items || items.length === 0) { reply('Inventory is already empty.'); return; }
    for (const item of items) { try { await bot.tossStack(item); } catch (e) {} }
    reply('Dropped all inventory items.');
  }
};
