const { Wallet } = require('ethers');
const fs = require('fs');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     MOLTTALK AGENT CONTROLLER GENERATOR               ║');
console.log('║     For: Atla (AI Agent)                              ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Generate controller wallet
const controller = Wallet.createRandom();

console.log('✅ Controller generated for MoltTalk agent!\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('  Controller Address:', controller.address);
console.log('  Private Key:', controller.privateKey);
console.log('  Mnemonic:', controller.mnemonic.phrase);
console.log('═══════════════════════════════════════════════════════════\n');

// Save for agent
const agentWallet = {
  name: 'Atla_MoltTalk_Controller',
  address: controller.address,
  privateKey: controller.privateKey,
  mnemonic: controller.mnemonic.phrase,
  createdAt: new Date().toISOString(),
  purpose: 'MoltTalk stealth messaging on LUKSO',
  upAddress: null // To be filled when granted permission
};

fs.writeFileSync('./atla-molttalk-controller.json', JSON.stringify(agentWallet, null, 2));
console.log('💾 Saved to: atla-molttalk-controller.json\n');

console.log('⚠️  ACTION REQUIRED:');
console.log('═══════════════════════════════════════════════════════════');
console.log('Give this controller permission on your UP:');
console.log('');
console.log('  1. Go to https://universalprofile.cloud/');
console.log('  2. Settings → Controller Keys');
console.log('  3. Add Controller');
console.log('  4. Enter address:', controller.address);
console.log('  5. Give permissions:');
console.log('     ✓ EXECUTE_RELAY_CALL (0x400000)');
console.log('     ✓ SIGN (0x200000)');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('Once granted, send me your UP address and I\'ll complete setup!');
