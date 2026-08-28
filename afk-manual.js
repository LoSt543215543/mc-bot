const mineflayer = require('mineflayer');
const { mineflayer: viewer } = require('prismarine-viewer');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const CONFIG = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const bot = mineflayer.createBot({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  auth: CONFIG.auth,
  version: CONFIG.version || false // Auto-detects server version if omitted
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Manual Alt Controller</title>
      <style>
        body { margin:0; background:#111; color:#fff; font-family:sans-serif; text-align:center; overflow:hidden; }
        iframe { width:100vw; height:80vh; border:none; }
        #hud { padding: 10px; background:#222; }
      </style>
    </head>
    <body>
      <div id="hud">
        <h2>Manual Control: Click here & Use <b>W, A, S, D, Space (Jump), Shift (Sneak)</b> | Mouse to Look</h2>
        <p id="pos">Position: Loading...</p>
      </div>
      <iframe src="http://${req.hostname}:${CONFIG.viewerPort}"></iframe>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        const keys = { w: 'forward', s: 'back', a: 'left', d: 'right', ' ': 'jump', shift: 'sneak' };
        window.addEventListener('keydown', e => {
          const k = e.key.toLowerCase();
          if (keys[k]) socket.emit('control', { key: keys[k], state: true });
        });
        window.addEventListener('keyup', e => {
          const k = e.key.toLowerCase();
          if (keys[k]) socket.emit('control', { key: keys[k], state: false });
        });
        socket.on('pos', p => { document.getElementById('pos').textContent = p; });
      </script>
    </body>
    </html>
  `);
});

io.on('connection', socket => {
  socket.on('control', data => {
    if (bot.entity) bot.setControlState(data.key, data.state);
  });
});

bot.once('spawn', () => {
  console.log(`[+] Logged in as ${bot.username}. AFK Active.`);
  try { viewer(bot, { port: CONFIG.viewerPort, firstPerson: true }); } catch (e) {}
  
  setInterval(() => {
    if (bot.entity) {
      io.emit('pos', `X: ${bot.entity.position.x.toFixed(1)}, Y: ${bot.entity.position.y.toFixed(1)}, Z: ${bot.entity.position.z.toFixed(1)}`);
    }
  }, 250);
});

bot.on('error', err => console.log(`[!] Error: ${err.message}`));
bot.on('kicked', reason => console.log(`[!] Kicked: ${JSON.stringify(reason)}`));

server.listen(CONFIG.webPort, '0.0.0.0', () => {
  console.log(`Manual Controller UI: http://localhost:${CONFIG.webPort}`);
});
