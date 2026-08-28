const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const USERS_FILE = path.join(__dirname, 'users.json');

function getUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify({}), 'utf8');
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUser(username, plainPassword, role = 'user') {
  const users = getUsers();
  const hash = bcrypt.hashSync(plainPassword, 10);
  users[username.toLowerCase()] = { username, hash, role };
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  console.log(`[+] User '${username}' successfully created/updated as [${role}].`);
}

const [,, cmd, user, pass, role] = process.argv;

if (cmd === 'add' && user && pass) {
  saveUser(user, pass, role || 'user');
} else {
  console.log('Usage: node manage_users.js add <username> <password> [admin|user]');
}
