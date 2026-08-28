module.exports = {
  name: 'beep',
  aliases: ['testvoice', 'voicetest'],
  description: 'Plays an audible 440Hz test tone over SVC with packet counters',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let bot, voiceClient, reply;

    if (context && context.bot) {
      bot = context.bot;
      voiceClient = context.voiceClient;
      reply = context.reply || context.sendSafeChat;
    } else {
      bot = context;
      voiceClient = legacyArgs[1];
      reply = legacyArgs[3];
    }

    voiceClient = voiceClient || bot?.voiceClient || global.voiceClient;
    const sendDm = reply || console.log;

    if (!voiceClient || !voiceClient.isReady) {
      sendDm(`[Test]: Voice client is not ready (Status: ${voiceClient?.status || 'UNKNOWN'}).`);
      return;
    }

    sendDm('[Test]: Generating 3s 440Hz test tone...');

    const sampleRate = 48000;
    const freq = 440;
    const durationSec = 3;
    const totalSamples = sampleRate * durationSec;
    // Standalone memory allocation
    const pcm = Buffer.alloc(totalSamples * 2);

    for (let i = 0; i < totalSamples; i++) {
      const sample = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 24000;
      pcm.writeInt16LE(Math.floor(sample), i * 2);
    }

    voiceClient.pushLiveAudio(pcm);
    sendDm(`[Test]: Pushed ${pcm.length} bytes PCM (${voiceClient.audioQueue.length} Opus frames queued for playback).`);
  }
};
