const { stopMining } = require('../miner');

module.exports = {
  name: 'stopmine',
  aliases: ['cancelmine'],
  execute({ bot, reply }) {
    stopMining(bot);
    reply('Mining task stopped.');
  }
};
