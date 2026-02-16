const { PrivateKey } = require('eciesjs');
const CryptoJS = require('crypto-js');

/**
 * Generate ECIES keypair for Tunnel
 * @returns {{privateKey: string, publicKey: string}}
 */
function generateKeyPair() {
  const sk = new PrivateKey();
  
  // Private key (32 bytes)
  const privateKey = '0x' + sk.secret.toString('hex');
  
  // Public key (65 bytes uncompressed: 0x04 + X + Y)
  const publicKeyBytes = sk.publicKey.toBytes();
  const publicKey = '0x' + Buffer.from(publicKeyBytes).toString('hex');
  
  return { privateKey, publicKey };
}

/**
 * Encrypt private key with password
 * @param {string} privateKey - Hex private key
 * @param {string} password - User password
 * @returns {string} Encrypted key
 */
function encryptKey(privateKey, password) {
  return CryptoJS.AES.encrypt(privateKey, password).toString();
}

/**
 * Decrypt private key with password
 * @param {string} encryptedKey - Encrypted key from storage
 * @param {string} password - User password
 * @returns {string} Decrypted private key
 */
function decryptKey(encryptedKey, password) {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, password);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Get private key instance from stored key
 * @param {string} encryptedKey - Encrypted key
 * @param {string} password - User password
 * @returns {PrivateKey} ECIES PrivateKey instance
 */
function getPrivateKey(encryptedKey, password) {
  const decryptedHex = decryptKey(encryptedKey, password);
  return new PrivateKey(Buffer.from(decryptedHex.replace('0x', ''), 'hex'));
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--generate')) {
    const keys = generateKeyPair();
    console.log(JSON.stringify(keys, null, 2));
  } else if (args.includes('--encrypt') && args.length >= 4) {
    const key = args[args.indexOf('--encrypt') + 1];
    const password = args[args.indexOf('--encrypt') + 2];
    console.log(encryptKey(key, password));
  } else if (args.includes('--decrypt') && args.length >= 4) {
    const encrypted = args[args.indexOf('--decrypt') + 1];
    const password = args[args.indexOf('--decrypt') + 2];
    console.log(decryptKey(encrypted, password));
  } else {
    console.log('Usage:');
    console.log('  node keys.js --generate');
    console.log('  node keys.js --encrypt <privateKey> <password>');
    console.log('  node keys.js --decrypt <encryptedKey> <password>');
  }
}

module.exports = {
  generateKeyPair,
  encryptKey,
  decryptKey,
  getPrivateKey
};
