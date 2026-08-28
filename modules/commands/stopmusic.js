const dj = require('../dj');
const { exec } = require('child_process');

module.exports = {
  name: 'stopmusic',
  aliases: ['stopaudio', 'hush', 'stopsong', 'stopdj'],
  description: 'Stops music playback and clears the DJ queue',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let bot, voiceClient, reply, username;

    if (context && context.bot) {
      bot = context.bot;
      voiceClient = context.voiceClient;
      reply = context.reply || context.sendSafeChat;
      username = context.username;
    } else {
      bot = context;
      voiceClient = legacyArgs[1];
      reply = legacyArgs[3];
      username = legacyArgs[4] || 'LoSt54321';
    }

    voiceClient = voiceClient || bot?.voiceClient || bot?.voice || global.voiceClient || global.voiceWorker;
    const sendDm = reply || ((msg) => bot?.whisper?.(username, msg) || console.log(`[StopMusic]: ${msg}`));

    try {
      dj.stop();

      if (voiceClient) {
        voiceClient.isPlaying = false;
        voiceClient.isStreaming = false;
        voiceClient.currentSong = null;
        if (Array.isArray(voiceClient.queue)) voiceClient.queue = [];
        if (typeof voiceClient.flushLiveAudio === 'function') voiceClient.flushLiveAudio();
        if (voiceClient.worker && voiceClient.worker.stdin) {
          try {
            voiceClient.worker.stdin.write('CLEAR\n');
            voiceClient.worker.stdin.write('FLUSH\n');
          } catch (e) {}
        }
      }

      exec('pkill -9 -f yt-dlp 2>/dev/null; pkill -9 -f "ffmpeg -i pipe:0" 2>/dev/null');

      console.log(`[DJ] Music stopped by ${username}`);
      sendDm('[DJ]: Music playback stopped and queue cleared.');
    } catch (err) {
      console.error('[StopMusic Error]:', err);
      sendDm(`[DJ Error]: ${err.message}`);
    }
  }
};
