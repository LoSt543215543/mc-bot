module.exports = {
  name: 'drophand',
  aliases: ['toss'],
  async execute({ bot, reply }) {
    const held = bot.heldItem;
    if (!held) { reply('Nothing in hand to drop.'); return; }
    const name = held.displayName || held.name;
    const count = held.count;
    try { await bot.tossStack(held); reply(`Dropped ${count}x ${name}.`); } catch (e) { reply(`Failed to drop: ${e.message}`); }
  }
};
