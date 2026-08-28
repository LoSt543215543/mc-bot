module.exports = {
  name: 'mute',
  aliases: ['unmute', 'mic', 'togglemute', 'stfu'],
  description: 'Toggles bot microphone mute state in Simple Voice Chat',
  adminOnly: false,
  djOnly: false,
  run: async (context, ...legacyArgs) => {
    let bot, voiceClient, reply, username, args, command;

    if (context && context.bot) {
      bot = context.bot;
      voiceClient = context.voiceClient;
      reply = context.reply || context.sendSafeChat;
      username = context.username;
      args = context.args || [];
      command = context.command || 'mute';
    } else {
      bot = context;
      voiceClient = legacyArgs[1];
      reply = legacyArgs[3];
      username = legacyArgs[4] || 'LoSt54321';
      const raw = legacyArgs[5] || '';
      args = raw.split(/\s+/).slice(1);
      command = 'mute';
    }

    bot = bot || global.bot;
    voiceClient = voiceClient || bot?.voiceClient || global.voiceClient;
    const sendDm = reply || ((msg) => bot?.whisper?.(username, msg) || console.log(`[Mute]: ${msg}`));

    if (!voiceClient) {
      sendDm('[Voice]: Voice client is not active.');
      return;
    }

    const sub = (args[0] || '').toLowerCase();
    let newMuteState;
    const currentState = Boolean(voiceClient.isMuted);

    if (command === 'unmute' || sub === 'off' || sub === 'false' || sub === '0') {
      newMuteState = false;
    } else if (sub === 'on' || sub === 'true' || sub === '1') {
      newMuteState = true;
    } else {
      newMuteState = !currentState;
    }

    voiceClient.setMuted(newMuteState);

    const statusText = newMuteState ? 'MUTED' : 'UNMUTED';
    sendDm(`[Voice]: Simple Voice Chat mic is now ${statusText}.`);
  }
};
