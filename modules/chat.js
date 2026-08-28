class ChatManager {
  constructor(bot, io) {
    this.bot = bot;
    this.io = io;
    this.messageQueue = [];
    this.isSending = false;
  }

  log(msg) {
    console.log(`[Bot]: ${msg}`);
    if (this.io) {
      this.io.emit('log', `[${new Date().toLocaleTimeString()}] ${msg}`);
    }
  }

  processQueue() {
    if (this.isSending || this.messageQueue.length === 0) return;
    this.isSending = true;

    const { targetUser, message } = this.messageQueue.shift();

    if (!targetUser || targetUser.trim() === '') {
      this.log(message);
      this.isSending = false;
      setTimeout(() => this.processQueue(), 350);
      return;
    }

    try {
      this.bot.chat(`/tell ${targetUser} ${message}`);
      this.log(`[Whisper -> ${targetUser}]: ${message}`);
    } catch (err) {
      this.log(`Chat error: ${err.message}`);
    }

    setTimeout(() => {
      this.isSending = false;
      this.processQueue();
    }, 400);
  }

  whisper(targetUser, message) {
    this.messageQueue.push({ targetUser, message });
    this.processQueue();
  }
}

module.exports = ChatManager;
