const dj = require('../dj');

module.exports = {
  name: 'play',
  aliases: ['yt', 'music', 'song'],
  description: 'Streams audio from YouTube or search queries through Simple Voice Chat',
  adminOnly: false,
  djOnly: true,
  run: async (context, ...legacyArgs) => {
    let bot, voiceClient, reply, username, args, raw;

    if (context && context.bot) {
      bot = context.bot;
      voiceClient = context.voiceClient;
      reply = context.reply || context.sendSafeChat;
      username = context.username;
      args = context.args || [];
      raw = context.raw || '';
    } else {
      bot = context;
      voiceClient = legacyArgs[1];
      reply = legacyArgs[3];
      username = legacyArgs[4] || 'LoSt54321';
      raw = legacyArgs[5] || '';
      args = Array.isArray(legacyArgs[6]) ? legacyArgs[6] : (raw ? raw.split(/\s+/).slice(1) : []);
    }

    voiceClient = voiceClient || bot?.voiceClient || bot?.voice || global.voiceClient || global.voiceWorker;
    const sendDm = reply || ((msg) => bot?.whisper?.(username, msg));

    const query = (args && args.length > 0 ? args.join(' ') : String(raw || '').replace(/^!\w+\s*/, '')).trim();

    if (!query) {
      sendDm('[DJ]: Usage: !play <YouTube URL or Song Title>');
      return;
    }

    if (!voiceClient) {
      sendDm('[DJ]: Voice client is not connected.');
      return;
    }

    try {
      await dj.addSong(query, username, voiceClient, sendDm);
    } catch (err) {
      console.error('[Play Command Error]:', err);
      sendDm(`[DJ Error]: ${err.message}`);
    }
  }
};
