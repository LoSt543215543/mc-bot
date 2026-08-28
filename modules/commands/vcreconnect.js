module.exports = {
  name: 'vcreconnect',
  aliases: ['vcrestart'],
  execute({ voiceClient, reply }) {
    if (voiceClient) {
      voiceClient.reconnectVoice();
      reply('Re-requesting voice chat secret from server...');
    } else {
      reply('Voice client not initialized.');
    }
  }
};
