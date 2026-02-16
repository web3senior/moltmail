const { Wallet } = require('ethers');
const { PrivateKey } = require('eciesjs');
const CryptoJS = require('crypto-js');
const fs = require('fs');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     TUNNEL SETUP FOR LUKSO UNIVERSAL PROFILE          ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Configuration
const CONFIG = {
  chainId: 42,
  chainName: 'LUKSO',
  contractAddress: '0x5D339E1D5Bb6Eb960600c907Ae6E7276D8196240',
  rpcUrl: 'https://rpc.mainnet.lukso.network',
  pinataJWT: process.env.PINATA_JWT || 'YOUR_PINATA_JWT_HERE'
};

// UP Controller (your existing key)
const UP_CONTROLLER_KEY = process.env.UP_CONTROLLER_KEY;
const UP_ADDRESS = '0x0D5C8B7cC12eD8486E1E0147CC0c3395739F138d';

if (!UP_CONTROLLER_KEY) {
  console.error('❌ Error: UP_CONTROLLER_KEY environment variable not set');
  console.log('\nSet it with:');
  console.log('  export UP_CONTROLLER_KEY=0x...');
  process.exit(1);
}

console.log('Using Universal Profile:', UP_ADDRESS);
console.log('Chain:', CONFIG.chainName, `(ID: ${CONFIG.chainId})`);
console.log('Contract:', CONFIG.contractAddress);
console.log('');

// Step 1: Generate ECIES Keypair
console.log('Step 1: Generating ECIES keypair...');
const sk = new PrivateKey();
const eciesPrivateKey = '0x' + sk.secret.toString('hex');
const eciesPublicKey = '0x' + Buffer.from(sk.publicKey.toBytes()).toString('hex');

console.log('  ECIES Public Key:', eciesPublicKey.slice(0, 30) + '...');

// Encrypt ECIES key with password
const password = process.env.KEY_PASSWORD || 'default_password_CHANGE_ME';
const encryptedEciesKey = CryptoJS.AES.encrypt(eciesPrivateKey, password).toString();

// Step 2: Save configuration
const agentConfig = {
  chainId: CONFIG.chainId,
  chainName: CONFIG.chainName,
  contractAddress: CONFIG.contractAddress,
  rpcUrl: CONFIG.rpcUrl,
  upAddress: UP_ADDRESS,
  eciesPublicKey: eciesPublicKey,
  encryptedEciesKey: encryptedEciesKey,
  pinataJWT: CONFIG.pinataJWT,
  createdAt: new Date().toISOString()
};

fs.writeFileSync('./agent-config.json', JSON.stringify(agentConfig, null, 2));
console.log('  ✓ Saved to agent-config.json');

// Step 3: Create registration script
const registerScript = `
const { ethers } = require('ethers');

async function registerPublicKey() {
  const provider = new ethers.JsonRpcProvider('${CONFIG.rpcUrl}');
  const controller = new ethers.Wallet('${UP_CONTROLLER_KEY}', provider);
  
  console.log('Controller address:', controller.address);
  
  const abi = [
    "function registerPublicKey(address _owner, bytes calldata _publicKey) external",
    "function publicKeyRegistry(address) external view returns (bytes memory)"
  ];
  
  const contract = new ethers.Contract('${CONFIG.contractAddress}', abi, controller);
  
  // Check if already registered
  const existing = await contract.publicKeyRegistry('${UP_ADDRESS}');
  if (existing && existing !== '0x') {
    console.log('✓ Public key already registered');
    return;
  }
  
  console.log('Registering public key on LUKSO...');
  
  const tx = await contract.registerPublicKey(
    '${UP_ADDRESS}',  // Register for UP
    '${eciesPublicKey}' // ECIES public key
  );
  
  console.log('Transaction sent:', tx.hash);
  await tx.wait();
  console.log('✓ Public key registered!');
}

registerPublicKey().catch(console.error);
`;

fs.writeFileSync('./register-up.js', registerScript);
console.log('  ✓ Created register-up.js');

// Step 4: Create agent script
const agentScript = `
const { ethers } = require('ethers');
const { PrivateKey } = require('eciesjs');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const FormData = require('form-data');
const { CID } = require('multiformats/cid');

// Load config
const config = require('./agent-config.json');

// Decrypt ECIES key
const password = process.env.KEY_PASSWORD || 'default_password_CHANGE_ME';
const bytes = CryptoJS.AES.decrypt(config.encryptedEciesKey, password);
const eciesPrivateKey = bytes.toString(CryptoJS.enc.Utf8);
const eciesKey = new PrivateKey(Buffer.from(eciesPrivateKey.replace('0x', ''), 'hex'));

// Setup provider and controller
const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const controller = new ethers.Wallet(process.env.UP_CONTROLLER_KEY, provider);

const abi = [
  "function registerPublicKey(address _owner, bytes calldata _publicKey) external",
  "function publicKeyRegistry(address) external view returns (bytes memory)",
  "function sendMessage(address _owner, address _meetingPoint, bytes32 _topic, bytes32 _cidHash, string memory _fullCID, bytes calldata _encKey) external",
  "function getPaginatedTopics(address _meetingPoint, uint256 _offset, uint256 _limit) external view returns (bytes32[] memory, uint256)",
  "function getTopicHistory(bytes32 _topic, uint256 _offset, uint256 _limit) external view returns (tuple(address sender, uint256 timestamp, bytes32 cidHash, string fullCID, bytes encryptedKey, bool isEdited, bool isDeleted)[] memory, uint256)",
  "event MessageSent(uint256 indexed messageId, bytes32 indexed topic, address indexed sender, uint256 timestamp)"
];

const contract = new ethers.Contract(config.contractAddress, abi, controller);

// ... (full agent implementation here)

console.log('Tunnel Agent ready for LUKSO UP:', config.upAddress);
`;

fs.writeFileSync('./tunnel-agent.js', agentScript);
console.log('  ✓ Created tunnel-agent.js\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('SETUP COMPLETE!');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Next steps:');
console.log('  1. Set environment variables:');
console.log('     export UP_CONTROLLER_KEY=0x...');
console.log('     export KEY_PASSWORD=your_password');
console.log('     export PINATA_JWT=eyJhbG...');
console.log('');
console.log('  2. Register your public key:');
console.log('     node register-up.js');
console.log('');
console.log('  3. Start the agent:');
console.log('     node tunnel-agent.js');
console.log('');
console.log('═══════════════════════════════════════════════════════════');
