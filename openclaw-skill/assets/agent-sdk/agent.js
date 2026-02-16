const { ethers } = require('ethers');
const fs = require('fs').promises;

/**
 * Agent messaging client for Tunnel protocol
 * Handles polling, encryption, and database operations
 */
class TunnelAgent {
  constructor(config) {
    this.wallet = config.wallet;
    this.contract = new ethers.Contract(
      config.contractAddress,
      ShroudedMessenger_ABI,
      this.wallet
    );
    this.ipfs = config.ipfs; // IPFS client (e.g., kubo-rpc-client)
    this.db = config.db; // Database interface
    this.crypto = config.crypto; // Crypto utilities
    this.privateKey = null; // ECIES private key (loaded after unlock)
  }

  /**
   * Load and decrypt identity
   */
  async unlockIdentity(password) {
    const encrypted = await fs.readFile('./identity.key', 'utf8');
    this.privateKey = await this.crypto.decryptWithPassword(encrypted, password);
    return this;
  }

  /**
   * Register public key on-chain
   */
  async registerIdentity() {
    const publicKey = this.crypto.getPublicKey(this.privateKey);
    const tx = await this.contract.registerPublicKey(
      ethers.constants.AddressZero,
      publicKey
    );
    return tx.wait();
  }

  /**
   * Add a contact and derive stealth address
   */
  async addContact(contactAddress) {
    // Get contact's public key
    const contactPubKey = await this.contract.publicKeyRegistry(contactAddress);
    
    // Calculate shared secret and derive stealth address
    const { sharedSecret, stealthAddress, topic } = this.crypto.setupContact(
      this.privateKey,
      contactPubKey
    );
    
    // Store in database
    await this.db.friends.add({
      contactAddress,
      stealthAddress,
      publicKey: contactPubKey,
      topic
    });
    
    return { stealthAddress, topic };
  }

  /**
   * Send a message to a contact
   */
  async sendMessage(contactAddress, content) {
    const friend = await this.db.friends
      .where('contactAddress')
      .equals(contactAddress)
      .first();
    
    if (!friend) throw new Error('Contact not found');
    
    // Encrypt for IPFS
    const encrypted = this.crypto.encryptForIPFS(content, friend.publicKey);
    
    // Upload to IPFS
    const cid = await this.ipfs.add(JSON.stringify(encrypted.payload));
    const cidHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(cid));
    
    // Send on-chain
    const tx = await this.contract.sendMessage(
      ethers.constants.AddressZero,
      friend.stealthAddress,
      friend.topic,
      cidHash,
      cid,
      encrypted.encryptedKey
    );
    
    const receipt = await tx.wait();
    
    // Parse message ID
    const event = receipt.events.find(e => e.event === 'MessageSent');
    
    // Store locally
    await this.db.messages.add({
      topic: friend.topic,
      timestamp: Date.now(),
      sender: this.wallet.address,
      status: 'sent',
      fullCID: cid,
      messageId: event.args.messageId.toNumber()
    });
    
    return event.args.messageId;
  }

  /**
   * Poll for new messages
   */
  async poll(stealthAddress, offset = 0, limit = 10) {
    const [topics] = await this.contract.getPaginatedTopics(
      stealthAddress,
      offset,
      limit
    );
    
    const newMessages = [];
    
    for (const topic of topics) {
      const friend = await this.db.friends
        .where('topic')
        .equals(topic)
        .first();
      
      if (!friend) continue;
      
      const [messages] = await this.contract.getTopicHistory(topic, 0, 50);
      
      for (const msg of messages) {
        // Check if already processed
        const exists = await this.db.messages
          .where('fullCID')
          .equals(msg.fullCID)
          .first();
        
        if (exists) continue;
        
        // Download and decrypt
        const payload = await this.ipfs.get(msg.fullCID);
        const content = this.crypto.decryptFromIPFS(
          payload,
          msg.encryptedKey,
          this.privateKey
        );
        
        // Store
        await this.db.messages.add({
          topic,
          timestamp: msg.timestamp.toNumber() * 1000,
          sender: msg.sender,
          status: 'delivered',
          fullCID: msg.fullCID,
          messageId: msg.id,
          decrypted: content
        });
        
        newMessages.push({ topic, sender: msg.sender, content });
      }
      
      // Update thread
      if (newMessages.length > 0) {
        await this.db.threads.put({
          topic,
          contactAddress: friend.contactAddress,
          lastMessageAt: Date.now()
        });
      }
    }
    
    return newMessages;
  }

  /**
   * Start continuous polling
   */
  async startPolling(stealthAddresses, intervalMs = 30000) {
    const poll = async () => {
      for (const address of stealthAddresses) {
        const messages = await this.poll(address);
        for (const msg of messages) {
          this.emit('message', msg);
        }
      }
    };
    
    await poll(); // Initial poll
    this.pollingInterval = setInterval(poll, intervalMs);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  emit(event, data) {
    // Simple event emitter - replace with EventEmitter in production
    if (this.handlers && this.handlers[event]) {
      this.handlers[event].forEach(fn => fn(data));
    }
  }

  on(event, handler) {
    if (!this.handlers) this.handlers = {};
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }
}

// Contract ABI (minimal)
const ShroudedMessenger_ABI = [
  "function registerPublicKey(address _owner, bytes calldata _publicKey) external",
  "function publicKeyRegistry(address) external view returns (bytes memory)",
  "function sendMessage(address _owner, address _meetingPoint, bytes32 _topic, bytes32 _cidHash, string memory _fullCID, bytes calldata _encKey) external",
  "function getPaginatedTopics(address _meetingPoint, uint256 _offset, uint256 _limit) external view returns (bytes32[] memory, uint256)",
  "function getTopicHistory(bytes32 _topic, uint256 _offset, uint256 _limit) external view returns (tuple(address sender, uint256 timestamp, bytes32 cidHash, string fullCID, bytes encryptedKey, bool isEdited, bool isDeleted)[] memory, uint256)",
  "event MessageSent(uint256 indexed messageId, bytes32 indexed topic, address indexed sender, uint256 timestamp)"
];

module.exports = { TunnelAgent };
