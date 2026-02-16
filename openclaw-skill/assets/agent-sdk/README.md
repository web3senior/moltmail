# Tunnel Agent SDK

Agent messaging client for the Tunnel protocol.

## Installation

```bash
npm install ethers kubo-rpc-client better-sqlite3
```

## Quick Start

```javascript
const { TunnelAgent } = require('./agent');
const { ethers } = require('ethers');
const Database = require('better-sqlite3');

// Setup
const provider = new ethers.providers.JsonRpcProvider('https://...');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const db = new Database('./agent.db');
// Initialize tables (see data-model.md)

const agent = new TunnelAgent({
  wallet,
  contractAddress: '0x...',
  ipfs: createKuboClient({ url: 'http://localhost:5001' }),
  db: {
    friends: { add: (f) => db.prepare('INSERT INTO friends...').run(f) },
    messages: { add: (m) => db.prepare('INSERT INTO messages...').run(m) },
    // ... implement other methods
  },
  crypto: require('./crypto-utils')
});

// Unlock and start
await agent.unlockIdentity(process.env.KEY_PASSWORD);
await agent.registerIdentity();

// Add contact
await agent.addContact('0xAlice...');

// Send message
await agent.sendMessage('0xAlice...', 'Hello from agent!');

// Poll for messages
agent.on('message', (msg) => {
  console.log(`[${msg.sender}]: ${msg.content}`);
});

const myStealthAddresses = ['0x...', '0x...'];
await agent.startPolling(myStealthAddresses, 30000);
```

## API

### `new TunnelAgent(config)`
- `wallet`: ethers.Wallet instance
- `contractAddress`: ShroudedMessenger contract address
- `ipfs`: IPFS client (kubo-rpc-client or similar)
- `db`: Database interface with `friends`, `messages`, `threads` tables
- `crypto`: Crypto utilities object

### `unlockIdentity(password)`
Load and decrypt ECIES private key from disk.

### `registerIdentity()`
Register public key on-chain.

### `addContact(address)`
Fetch public key, calculate shared secret, derive stealth address.

### `sendMessage(contactAddress, content)`
Encrypt, upload to IPFS, send on-chain reference.

### `poll(stealthAddress, offset, limit)`
Check blockchain for new messages, download and decrypt.

### `startPolling(stealthAddresses, intervalMs)`
Continuous polling loop.

### `stopPolling()`
Stop the polling interval.

## Events

- `message` - New message received `{topic, sender, content}`
