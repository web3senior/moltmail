#!/usr/bin/env node

/**
 * MoltTalk Auto-Polling with Telegram Notifications
 * Polls for new messages and sends Telegram notifications
 */

const { ethers } = require('ethers');
const { decryptKey } = require('./keys');
const { decryptMessage } = require('./encrypt');
const { ContactStore } = require('./contacts');
const { fetchFromPinata } = require('./pinata');
const fs = require('fs').promises;
const https = require('https');

// Telegram Bot Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1321105370'; // Amir's chat ID

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     MOLTTALK AUTO-POLL + TELEGRAM NOTIFY               ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function sendTelegramNotification(message, isMarkdown = true) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set, skipping notification');
    return false;
  }

  return new Promise((resolve) => {
    const data = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: isMarkdown ? 'Markdown' : undefined,
      disable_web_page_preview: true
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const response = JSON.parse(body);
        if (response.ok) {
          console.log('   ✅ Telegram notification sent');
          resolve(true);
        } else {
          console.log('   ❌ Telegram error:', response.description);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.log('   ❌ Telegram request failed:', e.message);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

async function pollAndNotify() {
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

  // Setup provider - use working ThirdWeb RPC with client ID
  const rpcUrl = config.rpcUrl || 'https://42.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5';
  let provider = new ethers.JsonRpcProvider(rpcUrl);
  console.log(`📡 Using RPC: ${rpcUrl}`);

  const abi = [
    "function getTopicHistory(bytes32 _topic, uint256 _offset, uint256 _limit) public view returns (tuple(address sender, uint256 timestamp, bytes32 cidHash, string fullCID, bytes encryptedKey, bool isEdited, bool isDeleted)[] memory result, uint256 totalMessages)"
  ];

  const contract = new ethers.Contract(config.contractAddress, abi, provider);

  // Load contacts
  const store = new ContactStore('./contacts.json');
  const friends = await store.getAllFriends();

  if (friends.length === 0) {
    console.log('📭 No contacts found.');
    process.exit(0);
  }

  console.log(`📡 Checking for messages from ${friends.length} contact(s)...\n`);

  // Decrypt my ECIES private key
  const password = process.env.KEY_PASSWORD || 'AtlaMoltTalk2026!';
  const myPrivateKey = decryptKey(config.encryptedEciesKey, password);

  let totalNewMessages = 0;
  const notifications = [];

  for (const friend of friends) {
    try {
      // Get topic history
      const [messages, total] = await contract.getTopicHistory(friend.topic, 0, 20);

      if (messages.length === 0) continue;

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];

        // Skip deleted messages
        if (msg.isDeleted) continue;

        // Check if we already have this message
        const existing = await store.getMessageByCID(msg.fullCID);
        if (existing) continue;

        // New message found!
        try {
          // Fetch from IPFS
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

          // Only notify for incoming messages
          if (msg.sender.toLowerCase() !== config.walletAddress.toLowerCase()) {
            const date = new Date(Number(msg.timestamp) * 1000).toLocaleString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });

            notifications.push({
              from: friend.name,
              content: plaintext,
              time: date,
              timestamp: Number(msg.timestamp) * 1000
            });

            totalNewMessages++;
            console.log(`   📩 New message from ${friend.name}: "${plaintext}"`);
          }

        } catch (err) {
          console.log(`   ⚠️  Could not decrypt message: ${err.message}`);
        }
      }

    } catch (err) {
      console.log(`   ⚠️  Error checking ${friend.name}: ${err.message}`);
    }
  }

  // Send Telegram notification if there are new messages
  if (notifications.length > 0) {
    console.log(`\n📬 ${notifications.length} new message(s) found!`);

    let messageText = '📬 *New MoltTalk Message' + (notifications.length > 1 ? 's' : '') + '*\n\n';

    for (const notif of notifications) {
      messageText += `*From:* ${notif.from}\n`;
      messageText += `*Time:* ${notif.time}\n`;
      messageText += `*Message:* ${notif.content}\n\n`;
    }

    messageText += '_Reply via MoltTalk to respond securely_ 🤍';

    await sendTelegramNotification(messageText);
  } else {
    console.log('\n📭 No new messages.');
  }

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║     POLL COMPLETE ✅ (${totalNewMessages} new)                      ║`);
  console.log('╚════════════════════════════════════════════════════════╝');

  return totalNewMessages;
}

// Run if called directly
if (require.main === module) {
  pollAndNotify().then(count => {
    process.exit(count > 0 ? 0 : 0);
  }).catch(err => {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  });
}

module.exports = { pollAndNotify };
