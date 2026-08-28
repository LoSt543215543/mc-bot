const fs = require('fs');
const path = require('path');
const security = require('../security');
const { isTtsActive } = require('../tts');
const dj = require('../dj');

let convoModeState = false;
function getConvoMode() { return convoModeState; }
function setConvoMode(val) { convoModeState = Boolean(val); return convoModeState; }
function toggleConvoMode() { convoModeState = !convoModeState; return convoModeState; }

const commands = new Map();
const lastCommandTimes = new Map();

// Load all command files
const cmdFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'index.js');
for (const file of cmdFiles) {
  try {
    const rawModule = require(path.join(__dirname, file));
    const baseName = path.basename(file, '.js').toLowerCase();

    let runner = null;
    let adminOnly = false;
    let djOnly = false;
    let aliases = [];

    if (typeof rawModule === 'function') {
      runner = rawModule;
    } else if (typeof rawModule === 'object' && rawModule !== null) {
      runner = rawModule.run || rawModule.execute || rawModule.handler || rawModule.action || (typeof rawModule.default === 'function' ? rawModule.default : null);
      adminOnly = Boolean(rawModule.adminOnly);
      djOnly = Boolean(rawModule.djOnly);
      if (Array.isArray(rawModule.aliases)) aliases = rawModule.aliases;
    }

    if (typeof runner === 'function') {
      const cmdObj = { name: baseName, run: runner, adminOnly, djOnly };
      commands.set(baseName, cmdObj);
      for (const a of aliases) {
        commands.set(String(a).toLowerCase(), cmdObj);
      }
    }
  } catch (err) {
    console.error(`[Commands] Failed to load ${file}:`, err.message);
  }
}

console.log(`[Commands] Loaded ${commands.size} command handlers.`);

function parseInvocationArguments(callArgs) {
  let bot = null;
  let chat = null;
  let voiceClient = null;
  let defaultMove = null;
  let sendSafeChat = null;
  let username = 'LoSt54321';
  let rawText = '';

  if (callArgs.length === 1 && typeof callArgs[0] === 'object' && callArgs[0] !== null) {
    const ctx = callArgs[0];
    bot = ctx.bot || global.bot;
    chat = ctx.chat;
    voiceClient = ctx.voiceClient || bot?.voiceClient || bot?.voice || global.voiceClient || global.voiceWorker;
    defaultMove = ctx.defaultMove;
    sendSafeChat = ctx.sendSafeChat || ctx.reply;
    username = ctx.username || ctx.sender || 'LoSt54321';
    rawText = ctx.raw || (ctx.command ? ('!' + ctx.command + (ctx.args ? ' ' + ctx.args.join(' ') : '')) : '');
  } else if (callArgs.length >= 2) {
    if (typeof callArgs[0] === 'string' && typeof callArgs[1] === 'string') {
      username = callArgs[0];
      rawText = callArgs[1];
      bot = global.bot;
    } else if (typeof callArgs[0] === 'object' && typeof callArgs[1] === 'string' && typeof callArgs[2] === 'string') {
      bot = callArgs[0];
      username = callArgs[1];
      rawText = callArgs[2];
    } else {
      bot = callArgs[0];
      chat = callArgs[1];
      voiceClient = callArgs[2];
      defaultMove = callArgs[3];
      sendSafeChat = callArgs[4];
      username = callArgs[5] || 'LoSt54321';
      rawText = callArgs[6] || '';
    }
  }

  if (!bot && global.bot) bot = global.bot;
  voiceClient = voiceClient || bot?.voiceClient || bot?.voice || global.voiceClient || global.voiceWorker;

  const cleanRaw = String(rawText || '').trim();
  const bangIdx = cleanRaw.indexOf('!');
  const cmdStr = bangIdx !== -1 ? cleanRaw.slice(bangIdx + 1) : cleanRaw;
  const parts = cmdStr.split(/\s+/).filter(Boolean);
  const commandName = (parts[0] || '').toLowerCase();
  const args = parts.slice(1);

  return { bot, chat, voiceClient, defaultMove, sendSafeChat, username: String(username).trim(), commandName, args, rawText: cleanRaw };
}

async function handleCommand(...callArgs) {
  const parsed = parseInvocationArguments(callArgs);
  const { bot, chat, voiceClient, defaultMove, username, commandName, args, rawText } = parsed;

  if (!commandName) return;

  if (username.toLowerCase() === 'server' || username.toLowerCase() === (bot?.username || '').toLowerCase()) {
    return;
  }

  const now = Date.now();
  const debounceKey = `${username.toLowerCase()}:${rawText.toLowerCase()}`;
  if (lastCommandTimes.has(debounceKey) && now - lastCommandTimes.get(debounceKey) < 400) {
    return;
  }
  lastCommandTimes.set(debounceKey, now);

  const cmd = commands.get(commandName);
  if (!cmd) return;

  console.log(`[*] Executing command from ${username}: !${commandName} ${args.join(' ')}`);

  // Direct Message Handler: whispers the player directly instead of broadcasting publicly
  const reply = (msg) => {
    if (!msg) return;
    const cleanMsg = String(msg).trim();
    if (!cleanMsg) return;

    if (bot && username && !['server', 'console', 'dashboard', 'lost54321'].includes(username.toLowerCase())) {
      if (typeof bot.whisper === 'function') {
        bot.whisper(username, cleanMsg);
      } else if (typeof bot.chat === 'function') {
        bot.chat(`/tell ${username} ${cleanMsg}`);
      }
    } else {
      console.log(`[DM -> ${username}]: ${cleanMsg}`);
    }
  };

  // Public broadcast fallback for commands that intentionally post to public chat (like !say)
  const broadcast = (msg) => {
    if (bot && typeof bot.chat === 'function') bot.chat(msg);
  };

  if (cmd.adminOnly && !security.isAdmin(username)) {
    reply(`[Bot]: Permission denied (Admin only).`);
    return;
  }

  if (cmd.djOnly && !security.isDj(username)) {
    reply(`[Bot]: Permission denied: DJ whitelist only.`);
    return;
  }

  const isDjPlaying = () => Boolean(dj.isPlaying);

  const context = {
    bot,
    chat,
    voiceClient,
    defaultMove,
    sendSafeChat: reply,
    reply: reply,
    broadcast: broadcast,
    username,
    args: Array.isArray(args) ? args : [],
    command: commandName,
    raw: rawText,
    security,
    getConvoMode,
    setConvoMode,
    toggleConvoMode,
    isDjPlaying
  };

  try {
    if (cmd.run.length <= 1) {
      await cmd.run(context);
    } else {
      await cmd.run(bot, chat || args, voiceClient || username, reply, reply, username, rawText, args, context);
    }
  } catch (err) {
    try {
      if (cmd.run.length <= 1) {
        await cmd.run(bot, args, username, reply, context);
      } else {
        await cmd.run(context);
      }
    } catch (fallbackErr) {
      console.error(`[Commands] Error executing "!${commandName}":`, fallbackErr.stack || fallbackErr.message);
    }
  }
}

module.exports = {
  handleCommand,
  getConvoMode,
  setConvoMode,
  toggleConvoMode,
  commands
};
