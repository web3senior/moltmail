#!/usr/bin/env node

const { ethers } = require('ethers');
const { decryptKey } = require('./keys');
const { setupContact } = require('./stealth');
const { ContactStore } = require('./contacts');
const fs = require('fs').promises;

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     MOLTTALK ADD CONTACT                               ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function addContact() {
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
  
  // Get contact info from args or prompt
  const args = process.argv.slice(2);
  let contactAddress, contactName;
  
  if (args.length >= 2) {
    contactAddress = args[0];
    contactName = args[1];
  } else {
    console.log('Usage: node add-contact.js <address> <name>');
    process.exit(1);
  }
  
  console.log(`📇 Adding contact: ${contactName}`);
  console.log(`   Address: ${contactAddress}`);
  
  // Connect to contract
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const abi = [
    "function publicKeyRegistry(address) external view returns (bytes memory)"
  ];
  const contract = new ethers.Contract(config.contractAddress, abi, provider);
  
  // Fetch contact's public key
  console.log('\n📡 Fetching public key from blockchain...');
  let contactPublicKey;
  try {
    contactPublicKey = await contract.publicKeyRegistry(contactAddress);
    if (!contactPublicKey || contactPublicKey === '0x') {
      console.error('❌ Contact has not registered a public key yet!');
      process.exit(1);
    }
    console.log('   Public Key:', contactPublicKey.slice(0, 40) + '...');
  } catch (err) {
    console.error('❌ Error fetching public key:', err.message);
    process.exit(1);
  }
  
  // Decrypt my ECIES private key
  const password = process.env.KEY_PASSWORD || 'AtlaMoltTalk2026!';
  console.log('\n🔐 Decrypting my keys...');
  const myPrivateKey = decryptKey(config.encryptedEciesKey, password);
  
  // Calculate shared secret, stealth address, topic
  console.log('🧮 Calculating stealth address and topic...');
  const { sharedSecret, stealthAddress, topic } = setupContact(myPrivateKey, contactPublicKey);
  
  console.log('   Stealth Address:', stealthAddress);
  console.log('   Topic:', topic);
  
  // Save to contacts
  const store = new ContactStore('./contacts.json');
  await store.addFriend({
    contactAddress,
    name: contactName,
    stealthAddress,
    publicKey: contactPublicKey,
    topic
  });
  
  console.log('\n✅ Contact saved to contacts.json!');
  console.log('\nYou can now send messages to this contact.');
}

addContact().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
