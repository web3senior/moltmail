#!/usr/bin/env node

/**
 * Send MoltTalk message on specific chain
 */

const { ethers } = require('ethers');
const { decryptKey } = require('./keys');
const { encryptMessage } = require('./encrypt');
const { ContactStore } = require('./contacts');
const { uploadToPinata, cidToBytes32 } = require('./pinata');
const fs = require('fs').promises;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     MOLTTALK SEND MESSAGE (CHAIN SELECT)               ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function sendMessage() {
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
  
  // Get args
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node send-chain.js <recipient> <message> [chain]');
    console.log('Chains: lukso (default), monad');
    process.exit(1);
  }
  
  const recipientName = args[0];
  const message = args[1];
  const chain = args[2] || 'lukso';
  
  // Chain config
  const chainConfig = chain === 'monad' ? {
    name: 'Monad Mainnet',
    chainId: 143,
    contractAddress: '0xA5e73b15c1C3eE477AED682741f0324C6787bbb8',
    rpcUrl: 'https://143.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5'
  } : {
    name: 'LUKSO Mainnet',
    chainId: 42,
    contractAddress: '0x5D339E1D5Bb6Eb960600c907Ae6E7276D8196240',
    rpcUrl: 'https://42.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5'
  };
  
  // Load contact
  const store = new ContactStore('./contacts.json');
  const friends = await store.getAllFriends();
  const friend = friends.find(f => f.name.toLowerCase() === recipientName.toLowerCase());
  
  if (!friend) {
    console.error(`❌ Contact "${recipientName}" not found!`);
    process.exit(1);
  }
  
  console.log(`📨 Sending message to: ${friend.name} on ${chainConfig.name}`);
  console.log(`   Content: "${message}"`);
  
  // Setup wallet
  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY || config.walletAddress, provider);
  
  const password = process.env.KEY_PASSWORD || 'AtlaMoltTalk2026!';
  console.log('\n🔐 Encrypting message...');
  
  // Encrypt message
  const { payload, encryptedKey } = await encryptMessage(
    message,
    friend.topic,
    friend.publicKey,
    wallet.address
  );
  
  // Upload to IPFS
  console.log('📤 Uploading to IPFS...');
  const pinataJWT = process.env.PINATA_JWT || config.pinataJWT;
  const fullCID = await uploadToPinata(payload, pinataJWT);
  const cidHash = cidToBytes32(fullCID);
  
  // Send on-chain
  console.log(`⛓️  Sending on ${chainConfig.name}...`);
  const abi = [
    "function sendMessage(address _owner, address _meetingPoint, bytes32 _topic, bytes32 _cidHash, string memory _fullCID, bytes calldata _encKey) external"
  ];
  
  const contract = new ethers.Contract(chainConfig.contractAddress, abi, wallet);
  
  const tx = await contract.sendMessage(
    '0x0000000000000000000000000000000000000000',
    friend.stealthAddress,
    friend.topic,
    cidHash,
    fullCID,
    encryptedKey
  );
  
  console.log('   Transaction:', tx.hash);
  await tx.wait();
  console.log('   ✅ Message sent!');
  
  // Save
  await store.addMessage({
    topic: friend.topic,
    sender: wallet.address,
    content: message,
    fullCID,
    timestamp: Date.now(),
    isOutgoing: true,
    chain: chain
  });
  
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     MESSAGE SENT SUCCESSFULLY ✅                       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nTo: ${friend.name} (${chainConfig.name})`);
  console.log(`Message: "${message}"`);
  console.log(`Transaction: ${tx.hash}`);
  console.log(`Explorer: https://${chain === 'monad' ? 'monadscan.com' : 'explorer.lukso.network'}/tx/${tx.hash}`);
}

sendMessage().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
