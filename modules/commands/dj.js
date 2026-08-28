const security = require('../security');

module.exports = {
  name: 'dj',
  aliases: ['djlist'],
  execute({ parts, authorized, reply }) {
    const subAction = parts[1] ? parts[1].toLowerCase() : 'list';
    const targetDj = parts[2];

    if (subAction === 'list') {
      reply(`Trusted DJs (${security.getDjList().length}): ${security.getDjList().join(', ')}`);
      return;
    }
    if (!authorized) {
      reply('Only admins can modify the DJ whitelist.');
      return;
    }
    if (subAction === 'add' || subAction === 'allow') {
      if (!targetDj) { reply('Usage: !dj add <username>'); return; }
      const added = security.addDj(targetDj);
      reply(added ? `Added "${targetDj}" to the DJ whitelist.` : `"${targetDj}" is already a trusted DJ.`);
      return;
    }
    if (subAction === 'remove' || subAction === 'del' || subAction === 'rm') {
      if (!targetDj) { reply('Usage: !dj remove <username>'); return; }
      const removed = security.removeDj(targetDj);
      reply(removed ? `Removed "${targetDj}" from the DJ whitelist.` : `"${targetDj}" was not found on the DJ whitelist.`);
      return;
    }
  }
};
