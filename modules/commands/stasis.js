const stasis = require('../stasis');
const { stopAllActions, resolveCoordinate } = require('../movement');

module.exports = {
  name: 'stasis',
  aliases: ['pearl', 'tpme'],
  execute({ bot, chat, username, parts, defaultMove, reply }) {
    const sub = parts[1] ? parts[1].toLowerCase() : '';
    if (sub === 'define' || sub === 'set' || sub === 'add') {
      if (parts.length < 5) {
        reply('Usage: !stasis define <x> <y> <z>');
        return;
      }
      const botPos = bot.entity ? bot.entity.position : { x: 0, y: 0, z: 0 };
      const coords = {
        x: resolveCoordinate(parts[2], botPos.x),
        y: resolveCoordinate(parts[3], botPos.y),
        z: resolveCoordinate(parts[4], botPos.z)
      };
      stasis.defineChamber(username, coords);
      reply(`Saved stasis chamber at (${coords.x}, ${coords.y}, ${coords.z}). Type !stasis to activate.`);
      return;
    }

    stopAllActions(bot);
    stasis.triggerStasis(bot, chat, username, defaultMove, reply);
  }
};
