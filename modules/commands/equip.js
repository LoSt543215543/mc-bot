const { equipBestWeapon } = require('../combat');

module.exports = {
  name: 'equip',
  aliases: ['weap', 'sword'],
  async execute({ bot, chat, reply }) {
    await equipBestWeapon(bot, chat);
    const held = bot.heldItem ? (bot.heldItem.displayName || bot.heldItem.name) : 'Nothing';
    reply(`Main Hand: ${held}`);
  }
};
