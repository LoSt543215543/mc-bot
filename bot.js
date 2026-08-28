const session = require('express-session');
const bcrypt = require('bcryptjs');
const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const CONFIG = require('./config');
const setupDashboard = require('./modules/dashboard');
const ChatManager = require('./modules/chat');
const SimpleVoiceClient = require('./modules/voice');
const { setupMovement, stopAllActions } = require('./modules/movement');
const { handleCommand, getConvoMode, setConvoMode, toggleConvoMode } = require('./modules/commands');
const { queryGemini } = require('./modules/ai');
const security = require('./modules/security');

let activeBot = null;
let chat = null;
let defaultMove = null;
let voiceClient = null;
let viewerStarted = false;
let lastBotChat = '';
let lastBotChatTime = 0;
let lastTpaAcceptTime = 0;
let lastAiResponseTime = 0;

function sendSafeChat(rawMsg) {
  if (!activeBot || !rawMsg) return;
  lastBotChat = rawMsg;
  lastBotChatTime = Date.now();
  activeBot.chat(rawMsg.slice(0, 140));
}

function checkAndTriggerAutoTpa(message) {
  try {
    const adminList = (typeof security.getAdminList === "function" ? security.getAdminList() : ["lost54321", "lost543215543"]) || [];
    const lowerMsg = String(message || "").toLowerCase();
    for (const admin of adminList) {
      if (lowerMsg.includes(admin.toLowerCase()) && (lowerMsg.includes("has requested to teleport") || lowerMsg.includes("tpa") || lowerMsg.includes("teleport request"))) {
        console.log(`[Auto-TPA] Auto-accepting teleport request from admin: ${admin}`);
        if (typeof bot.chat === "function") bot.chat("/tpaccept");
        break;
      }
    }
  } catch (e) {
    console.error("[Auto-TPA Error]:", e.message);
  }
}

function parseSender(rawText, senderUuid) {
  const botName = (activeBot?.username || '').toLowerCase();

  // 1. Match via UUID from packet
  if (senderUuid && activeBot?.players) {
    const p = Object.values(activeBot.players).find(x => x.uuid === senderUuid);
    if (p && p.username && p.username.toLowerCase() !== botName) return p.username;
  }

  // 2. Strip common rank badges like [VIP], [Member], [Owner], (Member)
  const clean = rawText.replace(/[\[\(][a-zA-Z0-9_+ -]{1,16}[\]\)]/g, '').trim();

  // 3. Match username right before standard chat delimiters (including ▶, », ➔, :, •)
  const delimMatch = clean.match(/([a-zA-Z0-9_.]{3,16})\s*(?:▶|➔|»|:|->|>|•)/);
  if (delimMatch && delimMatch[1].toLowerCase() !== botName) return delimMatch[1];

  // 4. Match bracketed names <Player>
  const bracketMatch = clean.match(/<([a-zA-Z0-9_.]{3,16})>/);
  if (bracketMatch && bracketMatch[1].toLowerCase() !== botName) return bracketMatch[1];

  // 5. Match whispers Player -> You / whispers
  const whisperMatch = clean.match(/([a-zA-Z0-9_.]{3,16})\s*(?:→|->|whispers|\bto you\b)/i);
  if (whisperMatch && whisperMatch[1].toLowerCase() !== botName) return whisperMatch[1];

  // 6. Fallback word scan
  const words = clean.replace(/[^a-zA-Z0-9_.]/g, ' ').trim().split(/\s+/);
  const fallback = words.find(w => w.length >= 3 && w.length <= 16 && w.toLowerCase() !== botName);
  return fallback || 'UNKNOWN_USER';
}

const { io, startViewer } = setupDashboard(CONFIG, (user, cmd) => {
  handleCommand(activeBot, chat, voiceClient, defaultMove, sendSafeChat, user, cmd);
}, () => activeBot, () => voiceClient);

function createBotInstance() {
  console.log(`[*] Connecting to ${CONFIG.host}:${CONFIG.port} as ${CONFIG.username}...`);

  const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    auth: CONFIG.auth || 'offline',
    version: CONFIG.version || false,
    viewDistance: 'normal',
    checkTimeoutInterval: 60000
  });

  activeBot = bot;
  bot.loadPlugin(pathfinder);
  chat = new ChatManager(bot, io);
  voiceClient = new SimpleVoiceClient(bot, chat);

  bot._client.on('resource_pack_send', (data) => {
    try {
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 3 });
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 0 });
    } catch (e) {}
  });

  bot._client.on('add_resource_pack', (data) => {
    try {
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 3 });
      bot._client.write('resource_pack_receive', { uuid: data.uuid, result: 0 });
    } catch (e) {}
  });

  bot._client.on('systemChat', (packet) => {
    try {
      const content = packet.content || packet.formattedMessage;
      if (content) checkAndTriggerAutoTpa(JSON.stringify(content));
    } catch (e) {}
  });

  
  // Universal Chat & Command Hook for formatted server chat
  bot.on("messagestr", (msg) => {
    if (!msg || !msg.includes("!")) return;
    
    // Match patterns like: "Username: !command args", "[Rank] Username » !command", "Username ➟ !command"
    const cmdMatch = msg.match(/(?:(?:[[^]]+]s*)?([a-zA-Z0-9_]{3,16})s*[:»➟➡>]s*)?(![a-zA-Z0-9]+(?:s+.*)?)$/);
    if (cmdMatch) {
      const sender = cmdMatch[1] || "Server";
      const fullCmd = cmdMatch[2].trim();
      const parts = fullCmd.slice(1).split(/\s+/);
      const commandName = parts[0].toLowerCase();
      const args = parts.slice(1);
      
      if (typeof handleCommand === "function") {
        handleCommand({
          username: sender,
          command: commandName,
          args: args,
          raw: fullCmd,
          bot: bot,
          voiceClient: bot.voiceClient || bot.voice || global.voiceClient || global.voiceWorker
        });
      }
    }
  });

  bot.once('spawn', () => {
    chat.log(`Spawned as ${bot.username}! Systems online.`);
    defaultMove = setupMovement(bot, chat);

    if (!viewerStarted) {
      startViewer(bot);
      viewerStarted = true;
    }

    if (bot._client) {
      try {
        bot._client.write('settings', {
          locale: 'en_US',
          viewDistance: 8,
          chatFlags: 0,
          chatColors: true,
          skinParts: 127,
          mainHand: 1,
          enableTextFiltering: false,
          enableServerListing: true
        });
      } catch (e) {}
    }

    setInterval(() => {
      if (bot.entity) {
        io.emit('status', {
          username: bot.username,
          health: bot.health || 20,
          food: bot.food || 20,
          pos: `${Math.round(bot.entity.position.x)}, ${Math.round(bot.entity.position.y)}, ${Math.round(bot.entity.position.z)}`
        });
      }
    }, 500);
  });

  bot.on('death', () => {
    stopAllActions(bot, voiceClient);
    if (bot.entity) {
      chat.log(`[ALERT: DEATH] Bot died at: ${Math.round(bot.entity.position.x)}, ${Math.round(bot.entity.position.y)}, ${Math.round(bot.entity.position.z)}`);
    }
  });

  bot.on('kicked', reason => {
    stopAllActions(bot, voiceClient);
    chat.log(`[Server Kick]: ${JSON.stringify(reason)}`);
  });

  bot.on('end', () => {
    stopAllActions(bot, voiceClient);
    chat.log('Disconnected. Reconnecting in 10s...');
    setTimeout(createBotInstance, 10000);
  });

  bot.on('error', err => chat.log(`[Bot Error]: ${err.message}`));

  bot.on('message', async (jsonMsg, position, senderUuid) => {
    const raw = jsonMsg.toString().trim();
    if (!raw) return;

    chat.log(`[Chat]: ${raw}`);
    checkAndTriggerAutoTpa(raw);

    const sender = parseSender(raw, senderUuid);

    // Command check
    const bangIdx = raw.indexOf('!');
    if (bangIdx !== -1) {
      const commandStr = raw.slice(bangIdx).trim();
      if (Date.now() - lastBotChatTime < 1500 && raw.includes(lastBotChat)) return;
      handleCommand(bot, chat, voiceClient, defaultMove, sendSafeChat, sender || 'UNKNOWN_USER', commandStr);
      return;
    }

    // AI Convo check
    if (getConvoMode() && sender && sender.toLowerCase() !== bot.username.toLowerCase()) {
      const now = Date.now();
      if (now - lastAiResponseTime < 3500) return;

      if (raw.includes('joined the server') || raw.includes('left the server') || raw.includes('was blown up') || raw.includes('was slain')) {
        return;
      }

      const isWhisper = raw.includes('✉') || raw.includes('whispers');
      const cleanMessage = raw.replace(/^.*?[➔»:>•]\s*/, '').trim();

      if (cleanMessage.length > 1) {
        lastAiResponseTime = now;
        const aiReply = await queryGemini(cleanMessage, sender);
        if (aiReply) {
          if (isWhisper) {
            sendSafeChat(`/msg ${sender} ${aiReply}`);
          } else {
            sendSafeChat(aiReply);
          }
        }
      }
    }
  });
}

process.on('uncaughtException', (err) => {
  console.error('[System Error Caught]:', err.stack || err.message);
});

createBotInstance();