const https = require('https');
const { spawn } = require('child_process');

let isTtsSpeaking = false;

const LANG_MAP = {
  'us': 'en-US', 'en': 'en-US',
  'uk': 'en-GB', 'gb': 'en-GB',
  'au': 'en-AU', 'ca': 'en-CA', 'in': 'en-IN',
  'es': 'es', 'spanish': 'es', 'mx': 'es-MX',
  'fr': 'fr', 'french': 'fr',
  'de': 'de', 'german': 'de',
  'it': 'it', 'italian': 'it',
  'ja': 'ja', 'japanese': 'ja', 'jp': 'ja',
  'ko': 'ko', 'korean': 'ko', 'kr': 'ko',
  'zh': 'zh-CN', 'chinese': 'zh-CN', 'cn': 'zh-CN',
  'ru': 'ru', 'russian': 'ru',
  'pt': 'pt-BR', 'portuguese': 'pt-BR',
  'nl': 'nl', 'dutch': 'nl',
  'sv': 'sv', 'swedish': 'sv',
  'pl': 'pl', 'polish': 'pl',
  'tr': 'tr', 'turkish': 'tr',
  'hi': 'hi', 'hindi': 'hi',
  'la': 'la', 'latin': 'la',
  'ar': 'ar', 'arabic': 'ar',
  'el': 'el', 'greek': 'el',
  'vi': 'vi', 'vietnamese': 'vi'
};

function translateText(text, targetLang = 'en') {
  return new Promise((resolve) => {
    const lang = LANG_MAP[targetLang.toLowerCase()] || targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(text)}`;

    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          let translated = '';
          if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
            translated = parsed[0].map(segment => segment[0]).join('');
          }
          const detectedSource = parsed[2] || 'auto';
          resolve({ translated: translated || text, sourceLang: detectedSource, targetLang: lang });
        } catch (e) {
          resolve({ translated: text, sourceLang: 'auto', targetLang: lang });
        }
      });
    }).on('error', () => {
      resolve({ translated: text, sourceLang: 'auto', targetLang: lang });
    });
  });
}

function playTTS(text, voiceClient, options = {}) {
  if (!voiceClient || !text) return;

  const cleanText = text
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/gu, '')
    .replace(/[^\p{L}\p{N}\p{P}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  isTtsSpeaking = true;

  const langKey = (options.lang || 'en').toLowerCase().replace(/^-/, '');
  const targetLang = LANG_MAP[langKey] || options.lang || 'en';

  const audioFilters = [];
  if (options.effect === 'robot') {
    audioFilters.push('aecho=0.8:0.88:6:0.4');
  } else if (options.effect === 'deep') {
    audioFilters.push('asetrate=48000*0.82,aresample=48000,atempo=1.22');
  } else if (options.effect === 'high' || options.effect === 'chipmunk') {
    audioFilters.push('asetrate=48000*1.28,aresample=48000,atempo=0.78');
  }

  const ffmpegArgs = ['-i', 'pipe:0'];
  if (audioFilters.length > 0) {
    ffmpegArgs.push('-af', audioFilters.join(','));
  }
  ffmpegArgs.push('-f', 's16le', '-ar', '48000', '-ac', '1', 'pipe:1');

  const encoded = encodeURIComponent(cleanText.slice(0, 300));
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${encodeURIComponent(targetLang)}&client=tw-ob`;

  const req = https.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  }, (res) => {
    if (res.statusCode !== 200) {
      isTtsSpeaking = false;
      return;
    }

    const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: ['pipe', 'pipe', 'ignore'] });
    res.pipe(ffmpeg.stdin);

    ffmpeg.stdout.on('data', (chunk) => {
      if (typeof voiceClient.pushLiveAudio === 'function') voiceClient.pushLiveAudio(chunk);
    });

    const finish = () => {
      isTtsSpeaking = false;
      if (typeof voiceClient.flushLiveAudio === 'function') voiceClient.flushLiveAudio();
    };

    ffmpeg.on('close', finish);
    ffmpeg.on('error', finish);
  });

  req.on('error', () => {
    isTtsSpeaking = false;
  });
}

function isTtsActive() {
  return isTtsSpeaking;
}

module.exports = { playTTS, translateText, isTtsActive, LANG_MAP };
