module.exports = {
  name: 'help',
  aliases: ['cmds', 'commands'],
  description: 'Lists all available bot commands',
  adminOnly: false,
  djOnly: false,
  run: async ({ sendSafeChat, args }) => {
    const mainCmds = [
      '!say [-lang] [-effect] <text>',
      '!tr <lang> <text>',
      '!follow [player]',
      '!tome',
      '!stop',
      '!proximity',
      '!convo [on/off]',
      '!status',
      '!play <song>',
      '!kys'
    ];
    
    const helpMsg = `Bot Commands: ${mainCmds.join(' | ')}`;
    console.log(`[Help] ${helpMsg}`);
    if (typeof sendSafeChat === 'function') {
      sendSafeChat(helpMsg);
    }
  }
};
