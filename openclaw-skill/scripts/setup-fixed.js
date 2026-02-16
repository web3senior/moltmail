#!/usr/bin/env node

const { ethers } = require('ethers');
const { PrivateKey } = require('eciesjs');
const CryptoJS = require('crypto-js');
const fs = require('fs').promises;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     MOLTTALK AGENT SETUP - FIXED VERSION               ║');
console.log('║     Using address(0) workaround for registration       ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function setup() {
  // Check environment
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  const pinataJWT = process.env.PINATA_JWT;
  
  if (!privateKey) {
    console.error('❌ Error: AGENT_PRIVATE_KEY not set');
    process.exit(1);
  }
  
  if (!pinataJWT) {
    console.error('❌ Error: PINATA_JWT not set');
    process.exit(1);
  }
  
  const CONFIG = {
    chainId: 42,
    chainName: 'LUKSO Mainnet',
    contractAddress: '0x5D339E1D5Bb6Eb960600c907Ae6E7276D8196240',
    rpcUrl: 'https://rpc.mainnet.lukso.network'
  };
  
  console.log(`📡 Connecting to ${CONFIG.chainName}...`);
  
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('✅ Wallet connected');
  console.log('   Address:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('   Balance:', ethers.formatEther(balance), 'LYX');
  
  if (balance === 0n) {
    console.error('\n❌ Error: Wallet has no funds!');
    process.exit(1);
  }
  
  // Step 1: Generate ECIES keypair with uncompressed public key
  console.log('\n🔐 Step 1: Generating ECIES encryption keys...');
  const sk = new PrivateKey();
  const eciesPrivateKey = '0x' + sk.secret.toString('hex');
  
  // Get uncompressed public key (65 bytes: 0x04 + x + y)
  const pubKeyBytes = sk.publicKey.toBytes(false); // false = uncompressed
  const eciesPublicKey = '0x' + Buffer.from(pubKeyBytes).toString('hex');
  
  console.log('   Public Key:', eciesPublicKey.slice(0, 40) + '...');
  console.log('   Key length:', (eciesPublicKey.length - 2) / 2, 'bytes');
  
  // Encrypt ECIES private key
  const password = 'AtlaMoltTalk2026!';
  const encryptedEciesKey = CryptoJS.AES.encrypt(eciesPrivateKey, password).toString();
  
  // Step 2: Register on-chain with address(0) workaround
  console.log('\n📤 Step 2: Registering public key on blockchain...');
  console.log('   Contract:', CONFIG.contractAddress);
  console.log('   Using address(0) as _owner (msg.sender fallback)');
  
  const abi = [
    "function registerPublicKey(address _owner, bytes calldata _publicKey) external",
    "function publicKeyRegistry(address) external view returns (bytes memory)"
  ];
  
  const contract = new ethers.Contract(CONFIG.contractAddress, abi, wallet);
  
  // Use address(0) as owner - contract uses msg.sender instead
  const tx = await contract.registerPublicKey(
    '0x0000000000000000000000000000000000000000', // address(0) = use msg.sender
    eciesPublicKey
  );
  
  console.log('   Transaction:', tx.hash);
  console.log('   Waiting for confirmation...');
  
  await tx.wait();
  console.log('   ✅ Registered successfully!');
  
  // Save configuration
  console.log('\n💾 Step 3: Saving configuration...');
  
  const config = {
    chainId: CONFIG.chainId,
    chainName: CONFIG.chainName,
    contractAddress: CONFIG.contractAddress,
    rpcUrl: CONFIG.rpcUrl,
    walletAddress: wallet.address,
    eciesPublicKey: eciesPublicKey,
    encryptedEciesKey: encryptedEciesKey,
    pinataJWT: pinataJWT,
    createdAt: new Date().toISOString()
  };
  
  await fs.writeFile('./agent-config.json', JSON.stringify(config, null, 2));
  console.log('   ✅ Saved to agent-config.json');
  
  // Also save environment variables
  const envContent = `AGENT_PRIVATE_KEY=${privateKey}
PINATA_JWT=${pinataJWT}
KEY_PASSWORD=${password}
`;
  await fs.writeFile('./.env', envContent);
  console.log('   ✅ Saved environment variables to .env');
  
  // Success
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║           SETUP COMPLETE! ✅                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log('Your MoltTalk agent is ready!');
  console.log('\nConfiguration:');
  console.log('  Wallet:', wallet.address);
  console.log('  Chain:', CONFIG.chainName);
  console.log('  Contract:', CONFIG.contractAddress);
  console.log('\nNext steps:');
  console.log('  1. Add contacts: node scripts/add-contact.js');
  console.log('  2. Send message: node scripts/send-message.js');
  console.log('  3. Poll messages: node scripts/poll-messages.js');
}

setup().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
