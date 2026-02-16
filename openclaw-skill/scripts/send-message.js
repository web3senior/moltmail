#!/usr/bin/env node

const { ethers } = require('ethers');
const { decryptKey } = require('./keys');
const { encryptMessage } = require('./encrypt');
const { ContactStore } = require('./contacts');
const { uploadToPinata, cidToBytes32 } = require('./pinata');

// Aliases for compatibility
const uploadToIPFS = uploadToPinata;
const getRawDigestHash = cidToBytes32;
const fs = require('fs').promises;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     MOLTTALK SEND MESSAGE                              ║');
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
  
  // Get message from args or prompt
  const args = process.argv.slice(2);
  let recipientName, message;
  
  if (args.length >= 2) {
    recipientName = args[0];
    message = args[1];
  } else if (args.length === 1) {
    // Just message, use default recipient
    recipientName = 'Amir';
    message = args[0];
  } else {
    console.log('Usage: node send-message.js <recipient> <message>');
    console.log('   or: node send-message.js <message> (defaults to Amir)');
    process.exit(1);
  }
  
  // Load contact
  const store = new ContactStore('./contacts.json');
  const friends = await store.getAllFriends();
  const friend = friends.find(f => f.name.toLowerCase() === recipientName.toLowerCase());
  
  if (!friend) {
    console.error(`❌ Contact "${recipientName}" not found!`);
    console.log('Available contacts:', friends.map(f => f.name).join(', '));
    process.exit(1);
  }
  
  console.log(`📨 Sending message to: ${friend.name}`);
  console.log(`   Content: "${message}"`);
  
  // Setup wallet
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY || config.walletAddress, provider);
  
  // Decrypt my ECIES private key (for logging purposes - not needed for encryption)
  const password = process.env.KEY_PASSWORD || 'AtlaMoltTalk2026!';
  console.log('\n🔐 Preparing encryption...');
  
  // Encrypt message
  const { payload, encryptedKey } = await encryptMessage(
    message,
    friend.topic,
    friend.publicKey,
    wallet.address
  );
  
  console.log('   ✅ Message encrypted');
  
  // Upload to IPFS
  console.log('\n📤 Uploading to IPFS...');
  const pinataJWT = process.env.PINATA_JWT || config.pinataJWT;
  const fullCID = await uploadToIPFS(payload, pinataJWT);
  console.log('   CID:', fullCID);
  
  // Get CID hash for on-chain verification
  const cidHash = getRawDigestHash(fullCID);
  console.log('   Hash:', cidHash);
  
  // Send on-chain (using address(0) workaround)
  console.log('\n⛓️  Sending on-chain transaction...');
  const abi = [
    "function sendMessage(address _owner, address _meetingPoint, bytes32 _topic, bytes32 _cidHash, string memory _fullCID, bytes calldata _encKey) external"
  ];
  
  const contract = new ethers.Contract(config.contractAddress, abi, wallet);
  
  const tx = await contract.sendMessage(
    '0x0000000000000000000000000000000000000000', // address(0) = use msg.sender
    friend.stealthAddress,
    friend.topic,
    cidHash,
    fullCID,
    encryptedKey
  );
  
  console.log('   Transaction:', tx.hash);
  console.log('   Waiting for confirmation...');
  
  await tx.wait();
  console.log('   ✅ Message sent!');
  
  // Save to local store
  await store.addMessage({
    topic: friend.topic,
    sender: wallet.address,
    content: message,
    fullCID,
    timestamp: Date.now(),
    isOutgoing: true
  });
  
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     MESSAGE SENT SUCCESSFULLY ✅                       ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nTo: ${friend.name}`);
  console.log(`Message: "${message}"`);
  console.log(`Transaction: ${tx.hash}`);
  console.log(`Explorer: https://explorer.lukso.network/tx/${tx.hash}`);
}

sendMessage().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
