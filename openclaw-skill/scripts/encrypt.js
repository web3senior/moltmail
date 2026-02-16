const { ethers } = require('ethers');
const ecies = require('eciesjs');

/**
 * Encrypt message using AES-GCM with topic-derived key
 * Also wraps key with recipient's public key via ECIES
 * 
 * @param {string} content - Plaintext message
 * @param {string} topic - Conversation topic (bytes32)
 * @param {string} recipientPublicKey - Recipient's ECIES public key (65 bytes)
 * @param {string} senderAddress - Sender's wallet address
 * @returns {Promise<{payload: object, encryptedKey: string}>}
 */
async function encryptMessage(content, topic, recipientPublicKey, senderAddress) {
  const subtle = globalThis.crypto?.subtle || require('crypto').webcrypto.subtle;
  
  // 1. Derive content encryption key from topic
  const derivedKeySeed = ethers.keccak256(
    ethers.concat([
      topic,
      ethers.toUtf8Bytes('content-encryption')
    ])
  );
  
  const contentKeyRawBytes = ethers.getBytes(derivedKeySeed);
  
  // 2. Import key for Web Crypto API
  const contentKey = await subtle.importKey(
    'raw',
    contentKeyRawBytes,
    'AES-GCM',
    true,
    ['encrypt']
  );
  
  // 3. Encrypt content
  const encodedMessage = new TextEncoder().encode(content);
  const iv = globalThis.crypto?.getRandomValues 
    ? globalThis.crypto.getRandomValues(new Uint8Array(12))
    : require('crypto').randomBytes(12);
    
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    contentKey,
    encodedMessage
  );
  
  // 4. Package payload
  const payload = {
    version: '1',
    iv: ethers.hexlify(iv),
    ciphertext: ethers.hexlify(new Uint8Array(ciphertext)),
    senderAddr: senderAddress
  };
  
  // 5. Wrap key for recipient (ECIES backup)
  const receiverWrappedKey = ecies.encrypt(
    recipientPublicKey,
    Buffer.from(contentKeyRawBytes)
  );
  
  return {
    payload,
    encryptedKey: '0x' + receiverWrappedKey.toString('hex')
  };
}

/**
 * Decrypt message using AES-GCM with topic-derived key
 * 
 * @param {object} payload - {iv, ciphertext, senderAddr}
 * @param {string} topic - Conversation topic
 * @returns {Promise<string>} Decrypted plaintext
 */
async function decryptMessage(payload, topic) {
  const subtle = globalThis.crypto?.subtle || require('crypto').webcrypto.subtle;
  
  // 1. Derive same content key from topic
  const derivedKeySeed = ethers.keccak256(
    ethers.concat([
      topic,
      ethers.toUtf8Bytes('content-encryption')
    ])
  );
  
  const contentKeyRawBytes = ethers.getBytes(derivedKeySeed);
  const contentKey = await subtle.importKey(
    'raw',
    contentKeyRawBytes,
    'AES-GCM',
    true,
    ['decrypt']
  );
  
  // 2. Extract IV and ciphertext
  const iv = ethers.getBytes(payload.iv);
  const ciphertext = ethers.getBytes(payload.ciphertext);
  
  // 3. Decrypt
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv },
    contentKey,
    ciphertext
  );
  
  // 4. Decode
  return new TextDecoder().decode(decryptedBuffer);
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'encrypt' && args.length >= 5) {
    const [_, content, topic, recipientPubKey, senderAddr] = args;
    encryptMessage(content, topic, recipientPubKey, senderAddr)
      .then(result => console.log(JSON.stringify(result, null, 2)))
      .catch(console.error);
  } else if (args[0] === 'decrypt' && args.length >= 3) {
    const [_, payloadJson, topic] = args;
    const payload = JSON.parse(payloadJson);
    decryptMessage(payload, topic)
      .then(result => console.log(result))
      .catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node encrypt.js encrypt <content> <topic> <recipientPubKey> <senderAddr>');
    console.log('  node encrypt.js decrypt \'{...}\' <topic>');
  }
}

module.exports = { encryptMessage, decryptMessage };
