module.exports = {
  name: 'convo',
  aliases: ['ai', 'chatmode', 'talk'],
  description: 'Toggles AI conversation mode on or off',
  adminOnly: false,
  djOnly: false,
  run: async (context = {}) => {
    const { sendSafeChat, args = [], getConvoMode, setConvoMode, toggleConvoMode } = context;

    let newState = false;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'on' || sub === 'enable' || sub === '1' || sub === 'start') {
      if (typeof setConvoMode === 'function') setConvoMode(true);
      newState = true;
    } else if (sub === 'off' || sub === 'disable' || sub === '0' || sub === 'stop') {
      if (typeof setConvoMode === 'function') setConvoMode(false);
      newState = false;
    } else if (typeof toggleConvoMode === 'function') {
      newState = toggleConvoMode();
    } else if (typeof getConvoMode === 'function' && typeof setConvoMode === 'function') {
      newState = setConvoMode(!getConvoMode());
    }

    const msg = `[Bot]: AI Conversation mode is now ${newState ? 'ENABLED' : 'DISABLED'}.`;
    console.log(`[Command:convo] ${msg}`);

    if (typeof sendSafeChat === 'function') {
      sendSafeChat(msg);
    }
  }
};
