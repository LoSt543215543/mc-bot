const { spawn, exec } = require('child_process');

class DJManager {
  constructor() {
    this.queue = [];
    this.currentTrack = null;
    this.isPlaying = false;
    this.ytdlProcess = null;
    this.ffmpegProcess = null;
    this.voiceClient = null;
    this.totalBytesSent = 0;
  }

  setContext(voiceClient) {
    if (voiceClient) this.voiceClient = voiceClient;
  }

  async addSong(query, requester, voiceClient, sendDm) {
    this.setContext(voiceClient);

    let target = query.trim();
    if (target.includes('watch?v=') && target.includes('&list=')) {
      target = target.split('&list=')[0];
    }

    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `ytsearch1:${target}`;
    }

    if (typeof sendDm === 'function') {
      sendDm(`[DJ]: Searching & loading "${query.slice(0, 45)}"...`);
    }

    const track = { query: target, title: query, requester, sendDm };
    this.queue.push(track);

    if (this.isPlaying) {
      if (typeof sendDm === 'function') {
        sendDm(`[DJ]: Queued #${this.queue.length} -> "${track.title}"`);
      }
    } else {
      this.playNext();
    }
  }

  fetchTitle(query) {
    return new Promise((resolve) => {
      const sanitized = query.replace(/"/g, '\\"');
      exec(`yt-dlp --print title --no-playlist --no-warnings "${sanitized}"`, { timeout: 8000 }, (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          resolve(stdout.trim().split('\n')[0]);
        } else {
          resolve(query);
        }
      });
    });
  }

  async playNext() {
    if (this.queue.length === 0) {
      this.stop();
      return;
    }

    const track = this.queue.shift();
    this.currentTrack = track;
    this.isPlaying = true;

    try {
      console.log(`[DJ] Resolving title for: ${track.query}`);
      track.title = await this.fetchTitle(track.query);

      if (this.voiceClient) {
        this.voiceClient.isPlaying = true;
        this.voiceClient.isStreaming = true;
        this.voiceClient.currentSong = track;
      }

      if (typeof track.sendDm === 'function') {
        track.sendDm(`[DJ]: Now playing -> "${track.title}"`);
      }

      this.startStreaming(track);
    } catch (err) {
      console.error('[DJ Error]:', err.message);
      if (typeof track.sendDm === 'function') {
        track.sendDm(`[DJ Error]: Failed to start track: ${err.message}`);
      }
      this.playNext();
    }
  }

  startStreaming(track) {
    this.stopProcesses();
    this.isPlaying = true;
    this.totalBytesSent = 0;

    console.log(`[DJ] Launching real-time yt-dlp | ffmpeg pipeline for: ${track.title}`);

    try {
      // 1. Fetch raw audio stream
      this.ytdlProcess = spawn('yt-dlp', [
        '-o', '-',
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '-f', 'bestaudio/ba/b',
        '--extractor-args', 'youtube:player_client=android,ios,web',
        track.query
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      // 2. -re reads input at native 1x playback speed
      this.ffmpegProcess = spawn('ffmpeg', [
        '-re',
        '-i', 'pipe:0',
        '-vn',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '1',
        '-af', 'volume=1.2',
        'pipe:1'
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      this.ytdlProcess.stdout.pipe(this.ffmpegProcess.stdin);

      this.ytdlProcess.stderr.on('data', (d) => {
        const err = d.toString().trim();
        if (err.includes('ERROR:')) console.error(`[yt-dlp ERR] ${err}`);
      });

      this.ffmpegProcess.stderr.on('data', () => {});

      // 3. Pipe real-time 48kHz PCM chunks to voice client
      this.ffmpegProcess.stdout.on('data', (chunk) => {
        if (this.isPlaying && this.voiceClient) {
          if (this.voiceClient.isMuted) return;

          this.totalBytesSent += chunk.length;
          if (typeof this.voiceClient.pushLiveAudio === 'function') {
            this.voiceClient.pushLiveAudio(chunk);
          }
        }
      });

      const handleEnd = () => {
        console.log(`[DJ] Finished streaming track (${this.totalBytesSent} bytes sent).`);
        const drainCheck = setInterval(() => {
          const remainingQueue = this.voiceClient?.audioQueue?.length || 0;
          if (remainingQueue === 0 || !this.isPlaying) {
            clearInterval(drainCheck);
            if (this.isPlaying) {
              this.stopProcesses();
              setTimeout(() => {
                if (this.isPlaying) this.playNext();
              }, 300);
            }
          }
        }, 500);
      };

      this.ffmpegProcess.on('close', handleEnd);
      this.ytdlProcess.on('error', (err) => {
        console.error('[DJ yt-dlp Spawn Error]:', err.message);
        handleEnd();
      });

    } catch (e) {
      console.error('[DJ Stream Exception]:', e);
      this.playNext();
    }
  }

  stopProcesses() {
    if (this.ytdlProcess) {
      try {
        this.ytdlProcess.stdout.removeAllListeners('data');
        this.ytdlProcess.kill('SIGKILL');
      } catch (e) {}
      this.ytdlProcess = null;
    }
    if (this.ffmpegProcess) {
      try {
        this.ffmpegProcess.stdout.removeAllListeners('data');
        this.ffmpegProcess.stdin?.destroy();
        this.ffmpegProcess.stdout?.destroy();
        this.ffmpegProcess.kill('SIGKILL');
      } catch (e) {}
      this.ffmpegProcess = null;
    }
  }

  stop() {
    this.isPlaying = false;
    this.queue = [];
    this.currentTrack = null;
    this.stopProcesses();

    if (this.voiceClient) {
      this.voiceClient.isPlaying = false;
      this.voiceClient.isStreaming = false;
      this.voiceClient.currentSong = null;
      if (Array.isArray(this.voiceClient.queue)) {
        this.voiceClient.queue = [];
      }

      if (typeof this.voiceClient.flushLiveAudio === 'function') {
        try { this.voiceClient.flushLiveAudio(); } catch (e) {}
      }
    }
  }

  skip() {
    this.stopProcesses();
    this.playNext();
  }
}

module.exports = new DJManager();
