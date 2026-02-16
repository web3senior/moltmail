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
console.log('║     TUNNEL SETUP - LUKSO UNIVERSAL PROFILE             ║');
console.log('║     Using Controller + Relayer (Gasless)               ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function setup() {
  // Configuration for LUKSO
  const CONFIG = {
    chainId: 42,
    chainName: 'LUKSO Mainnet',
    contractAddress: '0x5D339E1D5Bb6Eb960600c907Ae6E7276D8196240',
    rpcUrl: 'https://rpc.mainnet.lukso.network',
    relayerUrl: 'https://relayer.mainnet.lukso.network/api' // Native LUKSO relayer (LSP25)
  };
  
  // Get UP Controller key
  const controllerKey = process.env.UP_CONTROLLER_KEY;
  if (!controllerKey) {
    console.error('❌ Error: UP_CONTROLLER_KEY not set');
    console.log('\nPlease set your UP controller private key:');
    console.log('  export UP_CONTROLLER_KEY=0x...');
    console.log('\nTo get your controller key from LUKSO UP:');
    console.log('  1. Go to https://universalprofile.cloud/');
    console.log('  2. Settings → Controller Keys');
    console.log('  3. Export the controller private key');
    process.exit(1);
  }
  
  // Get Pinata JWT
  const pinataJWT = process.env.PINATA_JWT;
  if (!pinataJWT) {
    console.error('❌ Error: PINATA_JWT not set');
    console.log('\nPlease set your Pinata JWT:');
    console.log('  export PINATA_JWT=eyJhbG...');
    console.log('\nGet free API key from: https://www.pinata.cloud/');
    process.exit(1);
  }
  
  // Setup provider and controller
  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  const controller = new ethers.Wallet(controllerKey, provider);
  
  console.log('✅ Controller connected');
  console.log('   Controller Address:', controller.address);
  
  // Get UP address (the actual profile)
  const upAddress = process.env.UP_ADDRESS || await ask('Enter your Universal Profile address: ');
  console.log('   Universal Profile:', upAddress);
  
  // Check if controller is authorized
  console.log('\n📡 Checking controller authorization...');
  
  // Get password for encrypting ECIES key
  const password = await ask('\nEnter password to encrypt your ECIES key: ');
  if (!password || password.length < 8) {
    console.error('❌ Password must be at least 8 characters');
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
  
  // Step 2: Register on-chain (via relayer or direct)
  console.log('\n📤 Step 2: Registering public key on LUKSO...');
  console.log('   Contract:', CONFIG.contractAddress);
  console.log('   Using relayer for gasless transaction');
  
  const abi = [
    "function registerPublicKey(address _owner, bytes calldata _publicKey) external",
    "function publicKeyRegistry(address) external view returns (bytes memory)"
  ];
  
  const contract = new ethers.Contract(CONFIG.contractAddress, abi, controller);
  
  // Check if already registered
  try {
    const existing = await contract.publicKeyRegistry(upAddress);
    if (existing && existing !== '0x' && existing.length > 2) {
      console.log('   ⚠️  Public key already registered for this UP!');
      const overwrite = await ask('   Overwrite with new key? (yes/no): ');
      if (overwrite.toLowerCase() !== 'yes') {
        console.log('   Skipping registration, using existing key.');
        // Still save the new key locally in case they want it
      }
    }
  } catch (e) {
    // Continue to registration
  }
  
  // Register via relayer or direct
  const useRelayer = await ask('   Use relayer for gasless tx? (yes/no): ');
  
  if (useRelayer.toLowerCase() === 'yes') {
    console.log('   Sending to relayer...');
    
    // Prepare meta-transaction
    const forwarderAbi = [
      "function execute(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, uint48 deadline, bytes data) calldata req, bytes calldata signature) external payable returns (bool, bytes memory)",
      "function nonces(address) external view returns (uint256)"
    ];
    
    // Create function data
    const data = contract.interface.encodeFunctionData('registerPublicKey', [
      upAddress,
      eciesPublicKey
    ]);
    
    // Get nonce from forwarder
    const forwarder = new ethers.Contract(CONFIG.forwarderAddress || CONFIG.contractAddress, forwarderAbi, provider);
    const nonce = await forwarder.nonces(controller.address);
    
    // Create ForwardRequest
    const domain = {
      name: 'TunnelForwarder',
      version: '1',
      chainId: CONFIG.chainId,
      verifyingContract: CONFIG.forwarderAddress || CONFIG.contractAddress
    };
    
    const types = {
      ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint48' },
        { name: 'data', type: 'bytes' }
      ]
    };
    
    const request = {
      from: controller.address,
      to: CONFIG.contractAddress,
      value: 0n,
      gas: 100000n,
      nonce: nonce,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      data: data
    };
    
    // Sign with controller
    const signature = await controller.signTypedData(domain, types, request);
    
    // Send to relayer
    const response = await fetch(CONFIG.relayerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request,
        signature,
        rpcUrl: CONFIG.rpcUrl,
        forwarderAddress: CONFIG.forwarderAddress || CONFIG.contractAddress
      })
    });
    
    if (!response.ok) {
      throw new Error(`Relayer error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('   ✅ Transaction sent via relayer');
    console.log('   Hash:', result.txHash);
    
  } else {
    // Direct transaction (controller pays gas)
    console.log('   Sending direct transaction (controller pays gas)...');
    const tx = await contract.registerPublicKey(upAddress, eciesPublicKey);
    console.log('   Transaction:', tx.hash);
    await tx.wait();
    console.log('   ✅ Confirmed!');
  }
  
  // Step 3: Save configuration
  console.log('\n💾 Step 3: Saving configuration...');
  
  const agentConfig = {
    chainId: CONFIG.chainId,
    chainName: CONFIG.chainName,
    contractAddress: CONFIG.contractAddress,
    rpcUrl: CONFIG.rpcUrl,
    relayerUrl: CONFIG.relayerUrl,
    upAddress: upAddress,
    controllerAddress: controller.address,
    eciesPublicKey: eciesPublicKey,
    encryptedEciesKey: encryptedEciesKey,
    pinataJWT: pinataJWT,
    createdAt: new Date().toISOString()
  };
  
  await fs.writeFile('./agent-config.json', JSON.stringify(agentConfig, null, 2));
  console.log('   ✅ Saved to agent-config.json');
  
  // Also save environment variables
  const envContent = `UP_CONTROLLER_KEY=${controllerKey}
UP_ADDRESS=${upAddress}
PINATA_JWT=${pinataJWT}
KEY_PASSWORD=${password}
RELAYER_URL=${CONFIG.relayerUrl}
`;
  await fs.writeFile('./.env', envContent);
  console.log('   ✅ Saved environment variables to .env');
  
  // Success
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║           SETUP COMPLETE! ✅                           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log('Your Tunnel agent is ready for LUKSO!');
  console.log('\nConfiguration:');
  console.log('  Universal Profile:', upAddress);
  console.log('  Controller:', controller.address);
  console.log('  Chain:', CONFIG.chainName);
  console.log('  Contract:', CONFIG.contractAddress);
  console.log('  Relayer:', CONFIG.relayerUrl);
  console.log('\nNext steps:');
  console.log('  1. Add a contact: node scripts/add-contact.js');
  console.log('  2. Send message: node scripts/send-message.js');
  console.log('  3. Poll messages: node scripts/poll-messages.js');
  
  rl.close();
}

setup().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  rl.close();
  process.exit(1);
});
