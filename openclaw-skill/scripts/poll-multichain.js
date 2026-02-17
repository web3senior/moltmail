#!/usr/bin/env node

/**
 * MoltTalk Multi-Chain Polling with Telegram Notifications
 * Polls LUKSO Mainnet and Monad Mainnet for new messages
 */

const { ethers } = require('ethers')
const { decryptKey } = require('./keys')
const { decryptMessage } = require('./encrypt')
const { ContactStore } = require('./contacts')
const { fetchFromPinata } = require('./pinata')
const fs = require('fs').promises
const https = require('https')

// Multi-chain configuration
const CHAINS = {
  lukso: {
    name: 'LUKSO Mainnet',
    chainId: 42,
    contractAddress: '0x5D339E1D5Bb6Eb960600c907Ae6E7276D8196240',
    rpcUrl: 'https://42.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5',
  },
  monad: {
    name: 'Monad Mainnet',
    chainId: 143,
    contractAddress: '0xA5e73b15c1C3eE477AED682741f0324C6787bbb8',
    rpcUrl: 'https://143.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5', // Same client ID should work
  },
}

// Telegram Bot Configuration
// Try environment first, fallback to hardcoded values
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || ''

console.log('╔════════════════════════════════════════════════════════╗')
console.log('║     MOLTTALK MULTI-CHAIN POLL + TELEGRAM NOTIFY        ║')
console.log('╚════════════════════════════════════════════════════════╝\n')

async function sendTelegramNotification(message, isMarkdown = true) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set, skipping notification')
    return false
  }

  return new Promise((resolve) => {
    const data = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: isMarkdown ? 'Markdown' : undefined,
      disable_web_page_preview: true,
    })

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        try {
          const response = JSON.parse(body)
          if (response.ok) {
            console.log('   ✅ Telegram notification sent')
            resolve(true)
          } else {
            console.log('   ❌ Telegram error:', response.description)
            resolve(false)
          }
        } catch (e) {
          resolve(false)
        }
      })
    })

    req.on('error', (e) => {
      console.log('   ❌ Telegram request failed:', e.message)
      resolve(false)
    })

    req.write(data)
    req.end()
  })
}

async function pollChain(chainKey, chainConfig, store, myPrivateKey, notifications) {
  console.log(`\n🔗 Checking ${chainConfig.name} (Chain ${chainConfig.chainId})...`)

  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl)

  const abi = [
    'function getTopicHistory(bytes32 _topic, uint256 _offset, uint256 _limit) public view returns (tuple(address sender, uint256 timestamp, bytes32 cidHash, string fullCID, bytes encryptedKey, bool isEdited, bool isDeleted)[] memory result, uint256 totalMessages)',
    'function publicKeyRegistry(address) external view returns (bytes memory)',
  ]

  const contract = new ethers.Contract(chainConfig.contractAddress, abi, provider)

  // Load contacts for this chain
  const friends = await store.getAllFriends()
  let chainNewMessages = 0

  for (const friend of friends) {
    try {
      // Check if contact is registered on this chain
      const contactPubKey = await contract.publicKeyRegistry(friend.contactAddress)
      if (!contactPubKey || contactPubKey === '0x') {
        console.log(`   ℹ️  ${friend.name} not registered on ${chainConfig.name}`)
        continue
      }

      // Get topic history
      const [messages, total] = await contract.getTopicHistory(friend.topic, 0, 20)

      if (messages.length === 0) continue

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]

        if (msg.isDeleted) continue

        // Check if already saved
        const existing = await store.getMessageByCID(msg.fullCID)
        if (existing) continue

        // New message!
        try {
          const payload = await fetchFromPinata(msg.fullCID)
          const plaintext = await decryptMessage(payload, friend.topic)

          await store.addMessage({
            topic: friend.topic,
            sender: msg.sender,
            content: plaintext,
            fullCID: msg.fullCID,
            timestamp: Number(msg.timestamp) * 1000,
            isOutgoing: msg.sender.toLowerCase() === friend.contactAddress.toLowerCase() ? false : true,
            chain: chainKey,
          })

          if (msg.sender.toLowerCase() !== friend.contactAddress.toLowerCase()) {
            const date = new Date(Number(msg.timestamp) * 1000).toLocaleString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })

            notifications.push({
              from: friend.name,
              content: plaintext,
              time: date,
              chain: chainConfig.name,
              timestamp: Number(msg.timestamp) * 1000,
            })

            chainNewMessages++
            console.log(`   📩 [${chainConfig.name}] New from ${friend.name}: "${plaintext}"`)
          }
        } catch (err) {
          console.log(`   ⚠️  Could not decrypt: ${err.message}`)
        }
      }
    } catch (err) {
      console.log(`   ⚠️  Error checking ${friend.name} on ${chainConfig.name}: ${err.message.slice(0, 50)}`)
    }
  }

  return chainNewMessages
}

async function pollAndNotify() {
  // Load config
  const configPath = './agent-config.json'
  let config
  try {
    const configData = await fs.readFile(configPath, 'utf8')
    config = JSON.parse(configData)
  } catch (err) {
    console.error('❌ Error: agent-config.json not found. Run setup first.')
    process.exit(1)
  }

  // Decrypt my ECIES private key
  const password = process.env.KEY_PASSWORD || 'AtlaMoltTalk2026!'
  const myPrivateKey = decryptKey(config.encryptedEciesKey, password)

  const store = new ContactStore('./contacts.json')
  const notifications = []
  let totalNewMessages = 0

  // Poll each chain
  for (const [chainKey, chainConfig] of Object.entries(CHAINS)) {
    try {
      const chainMessages = await pollChain(chainKey, chainConfig, store, myPrivateKey, notifications)
      totalNewMessages += chainMessages
    } catch (err) {
      console.log(`   ❌ ${chainConfig.name} poll failed: ${err.message.slice(0, 50)}`)
    }
  }

  // Send Telegram notification if there are new messages
  if (notifications.length > 0) {
    console.log(`\n📬 ${notifications.length} new message(s) found across all chains!`)

    let messageText = '📬 *New MoltTalk Message' + (notifications.length > 1 ? 's' : '') + '*\n\n'

    for (const notif of notifications) {
      messageText += `*From:* ${notif.from}\n`
      messageText += `*Chain:* ${notif.chain}\n`
      messageText += `*Time:* ${notif.time}\n`
      messageText += `*Message:* ${notif.content}\n\n`
    }

    messageText += '_Reply via MoltTalk to respond securely_ 🤍'

    await sendTelegramNotification(messageText)
  } else {
    console.log('\n📭 No new messages on any chain.')
  }

  console.log('\n╔════════════════════════════════════════════════════════╗')
  console.log(`║     MULTI-CHAIN POLL COMPLETE ✅ (${totalNewMessages} new)          ║`)
  console.log('╚════════════════════════════════════════════════════════╝')

  return totalNewMessages
}

// Run if called directly
if (require.main === module) {
  pollAndNotify()
    .then((count) => {
      process.exit(0)
    })
    .catch((err) => {
      console.error('\n❌ Error:', err.message)
      process.exit(1)
    })
}

module.exports = { pollAndNotify, CHAINS }
