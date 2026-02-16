const fs = require('fs').promises;
const path = require('path');

/**
 * Simple JSON file storage for Tunnel contacts
 * @param {string} filepath - Path to JSON file
 */
class ContactStore {
  constructor(filepath = './contacts.json') {
    this.filepath = path.resolve(filepath);
    this.data = { friends: [], messages: [], threads: [] };
    this.initialized = false;
  }

  /**
   * Load data from file
   */
  async init() {
    try {
      const content = await fs.readFile(this.filepath, 'utf8');
      this.data = JSON.parse(content);
    } catch (err) {
      // File doesn't exist, start fresh
      this.data = { friends: [], messages: [], threads: [] };
      await this.save();
    }
    this.initialized = true;
  }

  /**
   * Save data to file
   */
  async save() {
    await fs.writeFile(
      this.filepath,
      JSON.stringify(this.data, null, 2)
    );
  }

  // ===== Friends / Contacts =====

  async addFriend(friend) {
    if (!this.initialized) await this.init();
    
    // Check if exists
    const exists = this.data.friends.find(
      f => f.contactAddress.toLowerCase() === friend.contactAddress.toLowerCase()
    );
    if (exists) return exists;
    
    friend.id = this.data.friends.length + 1;
    friend.addedAt = Date.now();
    this.data.friends.push(friend);
    await this.save();
    return friend;
  }

  async getFriend(contactAddress) {
    if (!this.initialized) await this.init();
    return this.data.friends.find(
      f => f.contactAddress.toLowerCase() === contactAddress.toLowerCase()
    );
  }

  async getFriendByTopic(topic) {
    if (!this.initialized) await this.init();
    return this.data.friends.find(
      f => f.topic.toLowerCase() === topic.toLowerCase()
    );
  }

  async getAllFriends() {
    if (!this.initialized) await this.init();
    return this.data.friends;
  }

  // ===== Messages =====

  async addMessage(message) {
    if (!this.initialized) await this.init();
    
    message.id = this.data.messages.length + 1;
    this.data.messages.push(message);
    await this.save();
    return message;
  }

  async getMessagesByTopic(topic, limit = 50) {
    if (!this.initialized) await this.init();
    return this.data.messages
      .filter(m => m.topic.toLowerCase() === topic.toLowerCase())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async getMessageByCID(cid) {
    if (!this.initialized) await this.init();
    return this.data.messages.find(m => m.fullCID === cid);
  }

  // ===== Threads =====

  async updateThread(thread) {
    if (!this.initialized) await this.init();
    
    const idx = this.data.threads.findIndex(
      t => t.topic.toLowerCase() === thread.topic.toLowerCase()
    );
    
    if (idx >= 0) {
      this.data.threads[idx] = { ...this.data.threads[idx], ...thread };
    } else {
      this.data.threads.push(thread);
    }
    
    await this.save();
  }

  async getThreads() {
    if (!this.initialized) await this.init();
    return this.data.threads.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }

  async getThread(topic) {
    if (!this.initialized) await this.init();
    return this.data.threads.find(
      t => t.topic.toLowerCase() === topic.toLowerCase()
    );
  }
}

// CLI usage
if (require.main === module) {
  const store = new ContactStore('./contacts.json');
  
  (async () => {
    // Example usage
    await store.addFriend({
      contactAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      stealthAddress: '0x8ba1f109551bD432803012645Hac136c82C3e8C',
      publicKey: '0x04a5d6e7f8...',
      topic: '0x9abc123...'
    });
    
    console.log('Friends:', await store.getAllFriends());
  })();
}

module.exports = { ContactStore };
