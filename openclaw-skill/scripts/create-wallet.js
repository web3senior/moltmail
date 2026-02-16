const { Wallet } = require('ethers');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║        TUNNEL AGENT WALLET GENERATOR                   ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Generate wallet
const wallet = Wallet.createRandom();

console.log('✅ New wallet generated!\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('  Address:', wallet.address);
console.log('  Private Key:', wallet.privateKey);
console.log('  Mnemonic:', wallet.mnemonic.phrase);
console.log('═══════════════════════════════════════════════════════════\n');

console.log('⚠️  IMPORTANT: Save these securely!\n');

rl.question('Save to wallet.json? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    const data = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
      createdAt: new Date().toISOString()
    };
    
    fs.writeFileSync('./wallet.json', JSON.stringify(data, null, 2));
    console.log('\n✅ Saved to wallet.json');
    console.log('\n⚠️  SECURITY WARNING:');
    console.log('   - Never share wallet.json');
    console.log('   - Never commit it to git');
    console.log('   - Add to .gitignore');
  } else {
    console.log('\n⚠️  Manual save required!');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('NEXT STEPS:');
  console.log('  1. Fund this wallet with LYX (LUKSO) or MON (Monad)');
  console.log('  2. Get Pinata JWT from https://www.pinata.cloud/');
  console.log('  3. Set environment variables:');
  console.log('     AGENT_PRIVATE_KEY=' + wallet.privateKey);
  console.log('     PINATA_JWT=your_pinata_jwt');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  rl.close();
});
