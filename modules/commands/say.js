const { containsBlockedContent } = require('../security');
const { playTTS, translateText, LANG_MAP } = require('../tts');

module.exports = {
  name: 'say',
  description: 'Broadcasts chat message and speaks over voice chat with optional -lang translation or -effect flags',
  adminOnly: false,
  djOnly: false,
  run: async (context) => {
    const { bot, chat, voiceClient, sendSafeChat, username, args, isDjPlaying } = context;
    if (!args || args.length === 0) return;

    let targetLang = null;
    let voiceEffect = null;
    const cleanedArgs = [];

    for (const arg of args) {
      if (arg.startsWith('-') && arg.length > 1) {
        const flag = arg.slice(1).toLowerCase();
        if (['robot', 'deep', 'high', 'chipmunk'].includes(flag)) {
          voiceEffect = flag;
          continue;
        } else if (LANG_MAP[flag] || flag.length <= 5) {
          targetLang = flag;
          continue;
        }
      }
      cleanedArgs.push(arg);
    }

    const text = cleanedArgs.join(' ').trim();
    if (!text) return;

    if (containsBlockedContent(text, username)) {
      if (chat && typeof chat.log === 'function') {
        chat.log(`[BLOCKED PROFANITY] Message from ${username}: "${text}"`);
      }
      return;
    }

    let speechText = text;
    let chatText = text;

    if (targetLang && targetLang !== 'en' && targetLang !== 'us') {
      try {
        const result = await translateText(text, targetLang);
        if (result && result.translated) {
          speechText = result.translated;
          chatText = `[${targetLang.toUpperCase()}]: ${result.translated}`;
        }
      } catch (e) {
        console.error('[Say Translate Error]:', e.message);
      }
    }

    if (typeof sendSafeChat === 'function') {
      sendSafeChat(chatText);
    } else if (bot && typeof bot.chat === 'function') {
      bot.chat(chatText);
    }

    const musicActive = typeof isDjPlaying === 'function' ? isDjPlaying() : false;
    if (!musicActive && voiceClient) {
      playTTS(speechText, voiceClient, { lang: targetLang || 'en', effect: voiceEffect });
    }
  }
};
