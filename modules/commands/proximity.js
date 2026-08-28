const { playTTS } = require('../tts');

function getCardinalDirection(angleDeg) {
  const directions = ['South', 'South-West', 'West', 'North-West', 'North', 'North-East', 'East', 'South-East'];
  const normalized = (angleDeg % 360 + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return directions[index];
}

module.exports = {
  name: 'proximity',
  aliases: ['radar', 'near', 'scan'],
  description: 'Scans for nearby players within 64 blocks and reports their distance/direction',
  adminOnly: false,
  djOnly: false,
  run: async ({ bot, sendSafeChat, voiceClient, isDjPlaying }) => {
    if (!bot || !bot.entity) return;

    const botPos = bot.entity.position;
    const players = [];

    for (const entityName of Object.keys(bot.entities)) {
      const entity = bot.entities[entityName];
      if (!entity || entity.type !== 'player' || entity.username === bot.username) continue;

      const dist = Math.hypot(entity.position.x - botPos.x, entity.position.z - botPos.z);
      if (dist <= 64) {
        const dx = entity.position.x - botPos.x;
        const dz = entity.position.z - botPos.z;
        const angle = Math.atan2(dx, dz) * (180 / Math.PI);
        const dir = getCardinalDirection(angle);

        players.push({
          username: entity.username,
          distance: Math.round(dist),
          direction: dir
        });
      }
    }

    players.sort((a, b) => a.distance - b.distance);

    if (players.length === 0) {
      sendSafeChat(`Radar: No players detected within 64 blocks.`);
      if (voiceClient && (!isDjPlaying || !isDjPlaying())) {
        playTTS('Radar scan clear. No players nearby.', voiceClient);
      }
      return;
    }

    const summaries = players.slice(0, 4).map(p => `${p.username} (${p.distance}m ${p.direction})`).join(', ');
    sendSafeChat(`Radar [${players.length}]: ${summaries}`);

    if (voiceClient && (!isDjPlaying || !isDjPlaying())) {
      const closest = players[0];
      const speech = `${players.length} player${players.length > 1 ? 's' : ''} nearby. Closest is ${closest.username}, ${closest.distance} blocks ${closest.direction}.`;
      playTTS(speech, voiceClient);
    }
  }
};
