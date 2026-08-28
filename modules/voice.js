const { spawn } = require('child_process');
const path = require('path');
let OpusScript;
try {
  OpusScript = require('opusscript');
} catch (e) {
  OpusScript = null;
}

const SVC_COMPAT_VERSION = 20;
const FRAME_SIZE = 960 * 2; // 20ms of 48000Hz mono 16-bit PCM = 1920 bytes

function writeVarInt(value) {
  const bytes = [];
  let v = value;
  while ((v & -128) !== 0) {
    bytes.push((v & 127) | 128);
    v >>>= 7;
  }
  bytes.push(v);
  return Buffer.from(bytes);
}

function writeString(str) {
  const strBuf = Buffer.from(str || '', 'utf8');
  const lenBuf = writeVarInt(strBuf.length);
  return Buffer.concat([lenBuf, strBuf]);
}

class SimpleVoiceClient {
  constructor(bot, chat) {
    this.bot = bot;
    this.chat = chat || console;
    this.javaProcess = null;
    this.worker = null;
    this.encoder = OpusScript ? new OpusScript(48000, 1, OpusScript.Application.AUDIO) : null;
    this.isPlaying = false;
    this.isStreaming = false;
    this.isReady = false;
    this.isMuted = false;
    this.status = 'INITIALIZING';
    this.cachedSecretPayload = null;
    this.playerUuidRaw = null;
    this.secretHandled = false;
    this.currentSong = null;
    this.queue = [];

    this.pcmBuffer = Buffer.alloc(0);
    this.audioQueue = [];
    this.pacerInterval = null;

    if (this.bot) this.bot.voiceClient = this;
    global.voiceClient = this;

    this.spawnJavaWorker();
    this.initPluginListeners();
    this.startPacer();
  }

  spawnJavaWorker() {
    const jarPath = path.resolve(__dirname, '../voice-worker/target/svc-worker-1.0.0.jar');
    this.javaProcess = spawn('java', ['-jar', jarPath]);
    this.worker = this.javaProcess;

    this.javaProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (this.chat && typeof this.chat.log === 'function') {
        this.chat.log(msg);
      } else {
        console.log(`[Bot]: ${msg}`);
      }

      if (msg.includes('SUCCESS_AUTH')) {
        this.status = 'AUTHENTICATED';
      }
      if (msg.includes('SUCCESS_VALIDATED')) {
        this.status = 'READY';
        this.isReady = true;
        console.log('[Bot]: [SVC] Voice chat is READY to play audio.');
      }
    });

    this.javaProcess.stderr.on('data', (data) => {
      console.error(`[SVC-Java ERR] ${data.toString().trim()}`);
    });

    this.javaProcess.on('exit', (code) => {
      console.warn(`[SVC-Java] Worker exited with code ${code}`);
      this.isReady = false;
      this.status = 'WORKER_DEAD';
    });
  }

  initPluginListeners() {
    let retryInterval = null;

    const triggerHandshake = () => {
      this.registerChannels();
      this.requestSecret();

      if (retryInterval) clearInterval(retryInterval);
      retryInterval = setInterval(() => {
        if (this.secretHandled || this.isReady) {
          clearInterval(retryInterval);
          return;
        }
        this.requestSecret();
      }, 2500);
    };

    if (this.bot.entity) {
      triggerHandshake();
    } else {
      this.bot.once('spawn', triggerHandshake);
    }

    this.bot._client.on('custom_payload', (packet) => {
      if (!packet) return;
      const channel = packet.channel || '';
      if (channel === 'voicechat:secret' || channel === 'simple_voice_chat:secret' || channel.includes('secret')) {
        if (retryInterval) clearInterval(retryInterval);
        this.handleSecretPacket(packet.data);
      }
    });

    this.bot.on('end', () => {
      if (retryInterval) clearInterval(retryInterval);
      this.secretHandled = false;
      this.cleanup();
    });

    this.bot.on('kicked', () => {
      if (retryInterval) clearInterval(retryInterval);
      this.secretHandled = false;
      this.cleanup();
    });
  }

  registerChannels() {
    try {
      if (!this.bot._client) return;
      const channels = Buffer.from(
        'voicechat:secret\0voicechat:request_secret\0voicechat:player_state\0voicechat:update_state\0voicechat:player_states\0',
        'utf8'
      );
      this.bot._client.write('custom_payload', {
        channel: 'minecraft:register',
        data: channels
      });
      if (this.chat && typeof this.chat.log === 'function') {
        this.chat.log('[SVC] Registered plugin channels.');
      }
    } catch (err) {
      console.error(`[SVC Error] Registration failed: ${err.message}`);
    }
  }

  requestSecret() {
    try {
      if (!this.bot._client || this.secretHandled) return;
      this.status = 'REQUESTING_SECRET';
      const reqBuffer = Buffer.alloc(4);
      reqBuffer.writeInt32BE(SVC_COMPAT_VERSION, 0);

      this.bot._client.write('custom_payload', {
        channel: 'voicechat:request_secret',
        data: reqBuffer
      });
      if (this.chat && typeof this.chat.log === 'function') {
        this.chat.log(`[SVC] Requesting secret (v${SVC_COMPAT_VERSION})...`);
      }
    } catch (e) {}
  }

  sendPlayerStatePacket(playerUuidRaw) {
    try {
      const uuid = playerUuidRaw || this.playerUuidRaw || Buffer.alloc(16);
      const disabled = Buffer.from([this.isMuted ? 0x01 : 0x00]);
      const disconnected = Buffer.from([0x00]);
      const name = writeString(this.bot?.username || 'LoSt54321554');
      const hasGroup = Buffer.from([0x00]);

      const payload = Buffer.concat([disabled, disconnected, uuid, name, hasGroup]);

      if (this.bot && this.bot._client) {
        this.bot._client.write('custom_payload', {
          channel: 'voicechat:player_state',
          data: payload
        });

        this.bot._client.write('custom_payload', {
          channel: 'voicechat:update_state',
          data: payload
        });

        if (this.chat && typeof this.chat.log === 'function') {
          this.chat.log('[SVC] Sent PlayerState TCP packet.');
        }
      }
    } catch (err) {
      console.error(`[SVC Error] Failed to send player state: ${err.message}`);
    }
  }

  sendPlayerState(disabled = false, muted = false) {
    this.isMuted = Boolean(muted);
    this.sendPlayerStatePacket(this.playerUuidRaw);
  }

  setMuted(muted) {
    this.isMuted = Boolean(muted);
    this.sendPlayerStatePacket(this.playerUuidRaw);
    return this.isMuted;
  }

  handleSecretPacket(buffer) {
    if (!buffer || buffer.length < 36 || this.secretHandled) return;
    this.secretHandled = true;

    try {
      const secretBytesHex = buffer.slice(0, 16).toString('hex');
      const port = buffer.readInt32BE(16);
      this.playerUuidRaw = buffer.slice(20, 36);
      const uuidBytesHex = this.playerUuidRaw.toString('hex');

      let host = this.bot._client?.socket?.remoteAddress || '127.0.0.1';
      const rawStr = buffer.toString('utf8');
      const hostMatch = rawStr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)/);
      if (hostMatch) {
        host = hostMatch[1];
      }
      if (host && host.startsWith('::ffff:')) {
        host = host.replace('::ffff:', '');
      }

      if (this.chat && typeof this.chat.log === 'function') {
        this.chat.log(`[SVC] Secret received! Voice Endpoint: ${host}:${port}`);
      } else {
        console.log(`[Bot]: [SVC] Secret received! Voice Endpoint: ${host}:${port}`);
      }

      this.status = 'CONNECTING_UDP';
      this.sendPlayerStatePacket(this.playerUuidRaw);

      this.cachedSecretPayload = {
        action: 'connect_hex',
        host: host,
        port: port,
        secretHex: secretBytesHex,
        playerUuidHex: uuidBytesHex
      };

      if (this.javaProcess && this.javaProcess.stdin && this.javaProcess.stdin.writable) {
        this.javaProcess.stdin.write(JSON.stringify(this.cachedSecretPayload) + '\n');
      }
    } catch (err) {
      console.error(`[SVC Error] Failed to parse secret packet: ${err.message}`);
    }
  }

  startPacer() {
    if (this.pacerInterval) return;

    this.pacerInterval = setInterval(() => {
      if (this.audioQueue.length === 0) return;

      const opusBase64 = this.audioQueue.shift();
      if (!this.isMuted && this.javaProcess && this.javaProcess.stdin && this.javaProcess.stdin.writable) {
        try {
          this.javaProcess.stdin.write(JSON.stringify({
            action: 'mic',
            opus: opusBase64
          }) + '\n');
        } catch (e) {}
      }
    }, 20);
  }

  pushLiveAudio(chunk) {
    if (this.isMuted || !chunk) return;

    if (!this.encoder && OpusScript) {
      this.encoder = new OpusScript(48000, 1, OpusScript.Application.AUDIO);
    }

    this.pcmBuffer = Buffer.concat([this.pcmBuffer, Buffer.from(chunk)]);

    while (this.pcmBuffer.length >= FRAME_SIZE) {
      // Allocate fresh zero-offset memory block for Opus WASM encoder
      const frame = Buffer.allocUnsafe(FRAME_SIZE);
      this.pcmBuffer.copy(frame, 0, 0, FRAME_SIZE);
      this.pcmBuffer = this.pcmBuffer.slice(FRAME_SIZE);

      try {
        if (this.encoder) {
          const opusBuf = this.encoder.encode(frame, 960);
          if (opusBuf && opusBuf.length > 0) {
            this.audioQueue.push(opusBuf.toString('base64'));
          }
        }
      } catch (e) {
        console.error('[SVC Opus Encode Error]:', e.message);
      }
    }
  }

  flushLiveAudio() {
    this.pcmBuffer = Buffer.alloc(0);
    this.audioQueue = [];
  }

  stopPlayback() {
    this.flushLiveAudio();
    this.isPlaying = false;
    this.isStreaming = false;
    this.currentSong = null;
  }

  stop() {
    this.stopPlayback();
  }

  cleanup() {
    this.stopPlayback();
    if (this.pacerInterval) {
      clearInterval(this.pacerInterval);
      this.pacerInterval = null;
    }
    if (this.javaProcess) {
      try { this.javaProcess.kill('SIGKILL'); } catch (e) {}
      this.javaProcess = null;
      this.worker = null;
    }
  }
}

module.exports = SimpleVoiceClient;
