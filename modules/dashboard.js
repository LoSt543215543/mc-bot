const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const httpProxy = require('http-proxy');
const session = require('express-session');
const bcrypt = require('bcryptjs');

let prismarineViewer = null;
try {
  prismarineViewer = require('prismarine-viewer').mineflayer;
} catch (e) {}

const USERS_FILE = path.join(__dirname, '../users.json');

function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function setupDashboard(CONFIG, handleCommand, getActiveBot, getVoiceClient) {
  const app = express();

  app.set('trust proxy', 1);

  const sessionMiddleware = session({
    secret: 'loglabs-secret-auth-session-key-99',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7,
      httpOnly: true,
      sameSite: 'lax',
      secure: false
    }
  });

  app.use(sessionMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 1. Auth Endpoints
  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/login.html'));
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required.' });
    }
    const users = getUsers();
    const account = users[username.toLowerCase()];
    if (account && bcrypt.compareSync(password, account.hash)) {
      req.session.user = { username: account.username, role: account.role || 'user' };
      return req.session.save((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Session error' });
        res.json({ success: true, redirect: '/' });
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/me', (req, res) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user: req.session.user });
  });

  // 2. Auth Guard
  app.use((req, res, next) => {
    if (
      req.path.startsWith('/login') ||
      req.path.startsWith('/api/login') ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    if (req.session && req.session.user) {
      return next();
    }
    res.redirect('/login');
  });

  // 3. Command API
  app.post('/api/cmd', (req, res) => {
    const cmd = req.body.cmd || req.query.cmd;
    if (!cmd) return res.status(400).json({ error: 'No command provided' });
    const sender = req.session && req.session.user ? req.session.user.username : 'Guest';
    handleCommand(sender, cmd);
    res.json({ success: true, executed: cmd });
  });

  // 4. Static Files
  app.use(express.static(path.join(__dirname, '../public')));

  const keyPath = path.join(__dirname, '../server.key');
  const certPath = path.join(__dirname, '../server.crt');
  const hasSSL = fs.existsSync(keyPath) && fs.existsSync(certPath);

  let server;
  if (hasSSL) {
    server = https.createServer({
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    }, app);
  } else {
    server = http.createServer(app);
  }

  // Bind Socket.IO directly to Express session middleware at engine level
  const io = new Server(server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.engine.use(sessionMiddleware);

  io.on('connection', (socket) => {
    const sessionData = socket.request.session;
    const currentUsername = sessionData?.user?.username || 'Guest';
    console.log(`[+] Web client connected: ${currentUsername}`);

    socket.on('command', (cmd) => {
      const activeUser = socket.request.session?.user?.username || currentUsername;
      console.log(`[*] Executing command from ${activeUser}: ${cmd}`);
      handleCommand(activeUser, cmd);
    });

    socket.on('control', ({ state, value }) => {
      const bot = getActiveBot ? getActiveBot() : null;
      if (bot && typeof bot.setControlState === 'function') {
        bot.setControlState(state, Boolean(value));
      }
    });

    socket.on('radio_pcm', (arrayBuffer) => {
      const vc = getVoiceClient ? getVoiceClient() : null;
      if (vc) vc.pushLiveAudio(Buffer.from(arrayBuffer));
    });

    socket.on('radio_stop', () => {
      const vc = getVoiceClient ? getVoiceClient() : null;
      if (vc) vc.flushLiveAudio();
    });

    socket.on('disconnect', () => {
      console.log(`[-] Web client disconnected: ${currentUsername}`);
    });
  });

  const port = CONFIG.dashboardPort || 3000;
  server.listen(port, () => {
    console.log(`[*] Command Center listening on https://localhost:${port}`);
  });

  // Prismarine HTTPS Wrapper
  function startViewer(bot) {
    if (!prismarineViewer) return;
    try {
      prismarineViewer(bot, { port: 3002, firstPerson: false });

      if (hasSSL) {
        const proxy = httpProxy.createProxyServer({ target: 'http://127.0.0.1:3002', ws: true });
        proxy.on('error', (err) => console.error('[Viewer Proxy Error]:', err.message));

        const viewerHttpsServer = https.createServer({
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        }, (req, res) => proxy.web(req, res));

        viewerHttpsServer.on('upgrade', (req, socket, head) => proxy.ws(req, socket, head));
        viewerHttpsServer.listen(3001, () => {
          console.log('[*] Prismarine HTTPS Proxy active on https://localhost:3001');
        });
      }
    } catch (err) {
      console.log(`[Viewer Error]: ${err.message}`);
    }
  }

  return { io, startViewer };
}

module.exports = setupDashboard;
