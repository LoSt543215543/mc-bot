module.exports = {
  name: 'pos',
  aliases: ['coords', 'where', 'location'],
  execute({ bot, reply }) {
    const p = bot.entity ? bot.entity.position : { x: 0, y: 0, z: 0 };
    reply(`Pos: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})`);
  }
};
