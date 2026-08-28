const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../config.json');
const BADWORDS_PATH = path.join(__dirname, '../badwords.json');

let lockdownState = false;

let npmFilter = null;
try {
  const bw = require('bad-words');
  const FilterConstructor = bw.Filter || bw.default || bw;
  if (typeof FilterConstructor === 'function') {
    npmFilter = new FilterConstructor();
  }
} catch (e) {}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    return { admins: [], djWhitelist: [], musicWhitelist: [], whitelist: [] };
  }
}

function loadBadWords() {
  try {
    return JSON.parse(fs.readFileSync(BADWORDS_PATH, 'utf8'));
  } catch (e) {
    return { exact: [], patterns: [] };
  }
}

const DEFAULT_ADMINS = ['lost54321', 'lost543215543', 'server', 'console', 'dashboard'];

function getAdminList() {
  const config = loadConfig();
  const fileAdmins = (config.admins || []).map(u => String(u).toLowerCase().trim());
  return Array.from(new Set([...DEFAULT_ADMINS, ...fileAdmins]));
}

function getDjList() {
  const config = loadConfig();
  const djs = (config.djWhitelist || config.musicWhitelist || config.djs || []).map(u => String(u).toLowerCase().trim());
  return Array.from(new Set([...DEFAULT_ADMINS, ...djs]));
}

function getWhitelist() {
  const config = loadConfig();
  const list = (config.whitelist || config.allowedUsers || []).map(u => String(u).toLowerCase().trim());
  return list;
}

function isAdmin(username) {
  if (!username) return false;
  const userLower = String(username).toLowerCase().trim();
  return getAdminList().includes(userLower);
}

function isDj(username) {
  if (!username) return false;
  const userLower = String(username).toLowerCase().trim();
  return getDjList().includes(userLower);
}

function isUserWhitelisted(username) {
  if (!username) return false;
  const userLower = String(username).toLowerCase().trim();
  if (isAdmin(userLower)) return true;
  const list = getWhitelist();
  if (list.length === 0) return true;
  return list.includes(userLower);
}

function getLockdown() { return lockdownState; }
function setLockdown(state) { lockdownState = Boolean(state); return lockdownState; }
function toggleLockdown() { lockdownState = !lockdownState; return lockdownState; }

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[@4]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[3]/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[^a-z0-9]/g, '');
}

function containsBlockedContent(text, username) {
  if (!text) return false;

  if (npmFilter) {
    try {
      if (npmFilter.isProfane(text)) return true;
    } catch (e) {}
  }

  const { exact, patterns } = loadBadWords();
  const normalized = normalizeText(text);
  const rawLower = text.toLowerCase();

  for (const pat of (patterns || [])) {
    try {
      const reg = new RegExp(pat, 'i');
      if (reg.test(rawLower) || reg.test(normalized)) return true;
    } catch (e) {}
  }

  for (const word of (exact || [])) {
    const wNorm = normalizeText(word);
    if (rawLower.includes(word.toLowerCase()) || (wNorm.length > 2 && normalized.includes(wNorm))) {
      return true;
    }
  }

  return false;
}

const baseSecurity = {
  isAdmin,
  isDj,
  isDjWhitelisted: isDj,
  isMusicWhitelisted: isDj,
  isMusicAllowed: isDj,
  isUserWhitelisted,
  isWhitelisted: isUserWhitelisted,
  getAdminList,
  getAdmins: getAdminList,
  getDjList,
  getDjs: getDjList,
  getWhitelist,
  getWhitelistedUsers: getWhitelist,
  getLockdown,
  isLockdown: getLockdown,
  isLockedDown: getLockdown,
  setLockdown,
  toggleLockdown,
  containsBlockedContent
};

module.exports = new Proxy(baseSecurity, {
  get(target, prop) {
    if (prop in target) return target[prop];
    const name = String(prop).toLowerCase();
    if (name.includes('list') || name.includes('users') || name.includes('admins') || name.includes('djs')) {
      return () => getAdminList();
    }
    return (...args) => {
      if (name.includes('admin')) return false;
      if (name.includes('lock')) return lockdownState;
      if (name.includes('white') || name.includes('allow')) return true;
      return false;
    };
  }
});
