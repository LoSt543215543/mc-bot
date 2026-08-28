const CONFIG = require('../config');

function getApiKey() {
  return CONFIG.geminiApiKey || 
         CONFIG.apiKey || 
         CONFIG.geminiKey || 
         CONFIG.gemini_api_key || 
         CONFIG.gemini || 
         process.env.GEMINI_API_KEY || 
         process.env.API_KEY || 
         null;
}

async function queryGemini(promptText, sender) {
  const apiKey = getApiKey();
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    console.error('[Gemini Error]: No valid Gemini API key found in config.js');
    return null;
  }

  const model = CONFIG.geminiModel || 'gemini-2.0-flash-lite';

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{
            text: `You are a casual Minecraft player. Reply strictly under 90 characters in all lowercase, no punctuation, sound chill. Player "${sender}" says: "${promptText}"`
          }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 35,
        temperature: 0.7
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Gemini API HTTP ${res.status}]:`, errBody);
      return null;
    }

    const data = await res.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      let replyText = data.candidates[0].content.parts[0].text.trim();
      return replyText.replace(/\r?\n|\r/g, ' ').slice(0, 100);
    }
  } catch (err) {
    console.error('[Gemini Network Error]:', err.message);
  }
  return null;
}

module.exports = { queryGemini };
