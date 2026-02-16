const { SigningKey, ethers } = require('ethers');

/**
 * Calculate shared secret using ECDH
 * @param {string} myPrivateKey - Your private key (0x-prefixed hex)
 * @param {string} contactPublicKey - Contact's public key (0x-prefixed hex, 65 bytes)
 * @returns {string} Shared secret (0x-prefixed hex)
 */
function calculateSharedSecret(myPrivateKey, contactPublicKey) {
  const signingKey = new SigningKey(myPrivateKey);
  return signingKey.computeSharedSecret(contactPublicKey);
}

/**
 * Derive stealth address from shared secret
 * @param {string} sharedSecret - Shared secret (0x-prefixed hex)
 * @returns {string} Stealth address (0x-prefixed, checksummed)
 */
function deriveStealthAddress(sharedSecret) {
  return ethers.getAddress(
    ethers.dataSlice(ethers.keccak256(sharedSecret), 12)
  );
}

/**
 * Derive topic from shared secret
 * @param {string} sharedSecret - Shared secret (0x-prefixed hex)
 * @returns {string} Topic (bytes32 hex)
 */
function deriveTopic(sharedSecret) {
  return ethers.keccak256(sharedSecret);
}

/**
 * Complete contact setup
 * @param {string} myPrivateKey - Your ECIES private key
 * @param {string} contactPublicKey - Contact's ECIES public key
 * @returns {{sharedSecret: string, stealthAddress: string, topic: string}}
 */
function setupContact(myPrivateKey, contactPublicKey) {
  const sharedSecret = calculateSharedSecret(myPrivateKey, contactPublicKey);
  const stealthAddress = deriveStealthAddress(sharedSecret);
  const topic = deriveTopic(sharedSecret);
  
  return {
    sharedSecret,
    stealthAddress,
    topic
  };
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage:');
    console.log('  node stealth.js <myPrivateKey> <contactPublicKey>');
    console.log('');
    console.log('Example:');
    console.log('  node stealth.js 0x1234... 0x04abcd...');
    process.exit(1);
  }
  
  const [myPrivateKey, contactPublicKey] = args;
  const result = setupContact(myPrivateKey, contactPublicKey);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = {
  calculateSharedSecret,
  deriveStealthAddress,
  deriveTopic,
  setupContact
};
