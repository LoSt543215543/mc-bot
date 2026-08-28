const { translateText, playTTS, LANG_MAP } = require('../tts');
const { containsBlockedContent } = require('../security');

module.exports = {
  name: 'translate',
  aliases: ['tr', 'trans'],
  description: 'Translates text into any language, broadcasts to chat, and speaks over voice chat',
  adminOnly: false,
  djOnly: false,
  run: async (context) => {
    const { bot, voiceClient, sendSafeChat, username, args, isDjPlaying } = context;
    if (!args || args.length === 0) {
      if (sendSafeChat) sendSafeChat(`Usage: !tr <lang> <text> (e.g. !tr es Hello friend)`);
      return;
    }

    let targetLang = args[0].toLowerCase().replace(/^[-:]+/, '');
    let textStartIndex = 1;

    if (!LANG_MAP[targetLang] && targetLang.length > 3) {
      // Default to English if first word is not a language code
      targetLang = 'en';
      textStartIndex = 0;
    }

    const rawText = args.slice(textStartIndex).join(' ').trim();
    if (!rawText) return;

    if (containsBlockedContent(rawText, username)) {
      console.log(`[Translate] Filter blocked message from ${username}`);
      return;
    }

    const { translated, sourceLang } = await translateText(rawText, targetLang);
    console.log(`[Translate] [${sourceLang} -> ${targetLang}] "${rawText}" => "${translated}"`);

    // Broadcast translated output to in-game chat
    if (typeof sendSafeChat === 'function') {
      sendSafeChat(`[${targetLang.toUpperCase()}]: ${translated}`);
    } else if (bot && typeof bot.chat === 'function') {
      bot.chat(`[${targetLang.toUpperCase()}]: ${translated}`);
    }

    // Speak translated audio over proximity voice chat
    const musicActive = typeof isDjPlaying === 'function' ? isDjPlaying() : false;
    if (!musicActive && voiceClient) {
      playTTS(translated, voiceClient, { lang: targetLang });
    }
  }
};
