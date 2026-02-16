#!/usr/bin/env node

const { ethers } = require('ethers');
const { decryptKey, getPrivateKey } = require('./keys');
const { decryptMessage } = require('./encrypt');
const { ContactStore } = require('./contacts');
const { fetchFromPinata } = require('./pinata');
const fs = require('fs').promises;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     MOLTTALK POLL MESSAGES                             ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function pollMessages() {
  // Load config
  const configPath = './agent-config.json';
  let config;
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (err) {
    console.error('❌ Error: agent-config.json not found. Run setup first.');
    process.exit(1);
  }
  
  // Setup provider - use configured RPC (should be ThirdWeb with client ID)
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  console.log(`📡 Using RPC: ${config.rpcUrl}`);
  
  const abi = [
    "function getTopicHistory(bytes32 _topic, uint256 _offset, uint256 _limit) public view returns (tuple(address sender, uint256 timestamp, bytes32 cidHash, string fullCID, bytes encryptedKey, bool isEdited, bool isDeleted)[] memory result, uint256 totalMessages)",
    "function getPaginatedTopics(address _meetingPoint, uint256 _offset, uint256 _limit) external view returns (bytes32[] memory result, uint256 total)",
    "function messageArchive(uint256) external view returns (address sender, uint256 timestamp, bytes32 cidHash, string memory fullCID, bytes memory encryptedKey, bool isEdited, bool isDeleted)"
  ];
  
  const contract = new ethers.Contract(config.contractAddress, abi, provider);
  
  // Load contacts
  const store = new ContactStore('./contacts.json');
  const friends = await store.getAllFriends();
  
  if (friends.length === 0) {
    console.log('📭 No contacts found. Add a contact first with add-contact.js');
    process.exit(0);
  }
  
  console.log(`📡 Checking for messages from ${friends.length} contact(s)...\n`);
  
  // Decrypt my ECIES private key
  const password = process.env.KEY_PASSWORD || 'AtlaMoltTalk2026!';
  const myPrivateKey = decryptKey(config.encryptedEciesKey, password);
  
  let totalMessages = 0;
  
  for (const friend of friends) {
    console.log(`🔍 Checking messages from: ${friend.name}`);
    console.log(`   Topic: ${friend.topic.slice(0, 20)}...`);
    
    try {
      // Get topic history
      const [messages, total] = await contract.getTopicHistory(friend.topic, 0, 10);
      
      if (messages.length === 0) {
        console.log('   📭 No messages\n');
        continue;
      }
      
      console.log(`   📬 ${messages.length} message(s) found\n`);
      
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const msgIndex = messages.length - i;
        
        // Skip deleted messages
        if (msg.isDeleted) {
          console.log(`   [${msgIndex}] ❌ Message deleted`);
          continue;
        }
        
        // Check if we already have this message
        const existing = await store.getMessageByCID(msg.fullCID);
        if (existing) {
          console.log(`   [${msgIndex}] ✓ Already saved: "${existing.content.slice(0, 30)}..."`);
          continue;
        }
        
        try {
          // Fetch from IPFS
          console.log(`   [${msgIndex}] 📥 Fetching from IPFS: ${msg.fullCID.slice(0, 20)}...`);
          const payload = await fetchFromPinata(msg.fullCID);
          
          // Decrypt message
          const plaintext = await decryptMessage(payload, friend.topic);
          
          // Save to store
          await store.addMessage({
            topic: friend.topic,
            sender: msg.sender,
            content: plaintext,
            fullCID: msg.fullCID,
            timestamp: Number(msg.timestamp) * 1000,
            isOutgoing: msg.sender.toLowerCase() === config.walletAddress.toLowerCase()
          });
          
          const direction = msg.sender.toLowerCase() === config.walletAddress.toLowerCase() ? '←' : '→';
          console.log(`   [${msgIndex}] ${direction} "${plaintext}"`);
          totalMessages++;
          
        } catch (err) {
          console.log(`   [${msgIndex}] ⚠️  Could not decrypt: ${err.message}`);
        }
      }
      
      console.log('');
      
    } catch (err) {
      console.log(`   ⚠️  Error: ${err.message}\n`);
    }
  }
  
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log(`║     POLL COMPLETE ✅ (${totalMessages} new messages)                 ║`);
  console.log('╚════════════════════════════════════════════════════════╝');
  
  if (totalMessages > 0) {
    console.log('\nNew messages saved to contacts.json');
  } else {
    console.log('\nNo new messages found.');
  }
}

pollMessages().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
