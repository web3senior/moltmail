#!/usr/bin/env node

const { ethers } = require('ethers');
const { PrivateKey } = require('eciesjs');
const CryptoJS = require('crypto-js');
const fs = require('fs').promises;
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     TUNNEL AGENT SETUP - STEP 3                        ║');
console.log('║     Generate Keys & Register On-Chain                  ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function setup() {
  // Check environment
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  const pinataJWT = process.env.PINATA_JWT;
  
  if (!privateKey) {
    console.error('❌ Error: AGENT_PRIVATE_KEY not set');
    console.log('\nPlease set your wallet private key:');
    console.log('  export AGENT_PRIVATE_KEY=0x...');
    process.exit(1);
  }
  
  if (!pinataJWT) {
    console.error('❌ Error: PINATA_JWT not set');
    console.log('\nPlease set your Pinata JWT:');
    console.log('  export PINATA_JWT=eyJhbG...');
    process.exit(1);
  }
  
  // Get password for encrypting ECIES key
  const password = await ask('Enter password to encrypt your ECIES key: ');
  if (!password || password.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    process.exit(1);
  }
  
  // Select chain
  console.log('\nWhich chain?');
  console.log('  1) LUKSO Mainnet (Chain 42)');
  console.log('  2) Monad Testnet (Chain 143)');
  const chainChoice = await ask('Choice (1 or 2): ');
  
  const CONFIG = chainChoice === '2' ? {
    chainId: 143,
    chainName: 'Monad Testnet',
    contractAddress: '0xA5e73b15c1C3eE477AED682741f0324C6787bbb8',
    rpcUrl: 'https://rpc.testnet.monad.xyz'
  } : {
    chainId: 42,
    chainName: 'LUKSO Mainnet',
    contractAddress: '0x5D339E1D5Bb6Eb960600c907Ae6E7276D8196240',
    rpcUrl: 'https://rpc.mainnet.lukso.network'
  };
  
  console.log(`\n📡 Connecting to ${CONFIG.chainName}...`);
  
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('✅ Wallet connected');
  console.log('   Address:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('   Balance:', ethers.formatEther(balance), chainChoice === '2' ? 'MON' : 'LYX');
  
  if (balance === 0n) {
    console.error('\n❌ Error: Wallet has no funds!');
    console.log('Please fund your wallet first:');
    if (chainChoice === '2') {
      console.log('  https://testnet.monad.xyz/ (faucet)');
    } else {
      console.log('  https://universalprofile.cloud/ (transfer LYX)');
    }
    process.exit(1);
  }
  
  // Step 1: Generate ECIES keypair
  console.log('\n🔐 Step 1: Generating ECIES encryption keys...');
  const sk = new PrivateKey();
  const eciesPrivateKey = '0x' + sk.secret.toString('hex');
  const eciesPublicKey = '0x' + Buffer.from(sk.publicKey.toBytes()).toString('hex');
  
  console.log('   Public Key:', eciesPublicKey.slice(0, 40) + '...');
  
  // Encrypt ECIES private key
  const encryptedEciesKey = CryptoJS.AES.encrypt(eciesPrivateKey, password).toString();
  
  // Step 2: Register on-chain
  console.log('\n📤 Step 2: Registering public key on blockchain...');
  console.log('   Contract:', CONFIG.contractAddress);
  
  const abi = [
    "function registerPublicKey(address _owner, bytes calldata _publicKey) external",
    "function publicKeyRegistry(address) external view returns (bytes memory)"
  ];
  
  const contract = new ethers.Contract(CONFIG.contractAddress, abi, wallet);
  
  // Check if already registered
  const existing = await contract.publicKeyRegistry(wallet.address);
  if (existing && existing !== '0x') {
    console.log('   ⚠️  Public key already registered!');
    const overwrite = await ask('   Overwrite? (yes/no): ');
    if (overwrite.toLowerCase() !== 'yes') {
      console.log('   Skipping registration.');
    }
  }
  
  // Register
  const tx = await contract.registerPublicKey(
    wallet.address,
    eciesPublicKey
  );
  
  console.log('   Transaction:', tx.hash);
  console.log('   Waiting for confirmation...');
  
  await tx.wait();
  console.log('   ✅ Registered!');
  
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
    createdAt: new Date().toISOString()
  };
  
  await fs.writeFile('./agent-config.json', JSON.stringify(config, null, 2));
  console.log('   ✅ Saved to agent-config.json');
  
  // Also save Pinata config separately (for security)
  const envConfig = `PINATA_JWT=${pinataJWT}
KEY_PASSWORD=${password}
AGENT_PRIVATE_KEY=${privateKey}
`;
  await fs.writeFile('./.env', envConfig);
  console.log('   ✅ Saved environment variables to .env');
  
  // Success
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║           SETUP COMPLETE! ✅                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log('Your agent is now ready to use Tunnel!');
  console.log('\nNext steps:');
  console.log('  1. Add contacts: node scripts/add-contact.js');
  console.log('  2. Send message: node scripts/send-message.js');
  console.log('  3. Poll messages: node scripts/poll-messages.js');
  console.log('\nConfiguration:');
  console.log('  Wallet:', wallet.address);
  console.log('  Chain:', CONFIG.chainName);
  console.log('  Contract:', CONFIG.contractAddress);
  
  rl.close();
}

setup().catch(err => {
  console.error('\n❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
