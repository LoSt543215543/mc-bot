const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
// Session Setup
app.use(session({
  secret: 'loglabs-super-secret-session-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));

const USERS_FILE = path.join(__dirname, 'users.json');
function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

// Auth Blocker
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}

// Login Routes
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const account = users[username ? username.toLowerCase() : ''];

  if (account && bcrypt.compareSync(password, account.hash)) {
    req.session.user = { username: account.username, role: account.role };
    return res.json({ success: true, redirect: '/' });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});
