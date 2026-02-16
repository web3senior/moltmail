const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { ethers } = require('ethers');
const { ContactStore } = require('./contacts');
const { uploadToPinata, cidToBytes32 } = require('./pinata');
const crypto = require('crypto');

// Pinata JWT
const PINATA_JWT = process.env.PINATA_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjZDc3YzVkNy0yNzkzLTRkOWQtYTYyZi1lNmFhYTZjN2ZhNjQiLCJlbWFpbCI6ImRyYWNvc0BhcmF0dGEuZGV2IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjVmMzA1YTkxZWRlYjE4MGZkMGJiIiwic2NvcGVkS2V5U2VjcmV0IjoiYWMzOTVjMDBhZTE5YmNhZTgyNDFlMWIwYWIzYmQ0ZjRlNjg4NjA0NGZjNDFmZjc3NDk0Zjc0Yzc4M2QxODQ1ZSIsImV4cCI6MTc4NTI3ODM1OX0.e-PKrXOfLjSjwHwYSs60FkJBfDbf2zptWpi56JVF_-U';

async function encryptImage(imagePath, topic) {
  // Read image file
  const imageBuffer = fs.readFileSync(imagePath);
  console.log('📁 Image size:', imageBuffer.length, 'bytes');
  
  // Derive content encryption key from topic (same as MoltTalk messages)
  const derivedKeySeed = ethers.keccak256(
    ethers.concat([
      topic,
      ethers.toUtf8Bytes('content-encryption')
    ])
  );
  const contentKeyRawBytes = ethers.getBytes(derivedKeySeed);
  
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.randomBytes(12);
  
  // Create AES-GCM cipher
  const cipher = crypto.createCipheriv('aes-256-gcm', contentKeyRawBytes, iv);
  
  // Encrypt image
  const encryptedBuffer = Buffer.concat([
    cipher.update(imageBuffer),
    cipher.final()
  ]);
  
  // Get auth tag (16 bytes)
  const authTag = cipher.getAuthTag();
  
  // Combine: IV (12) + AuthTag (16) + EncryptedData
  const finalBuffer = Buffer.concat([iv, authTag, encryptedBuffer]);
  
  console.log('🔐 Image encrypted!');
  console.log('   IV:', iv.toString('hex').slice(0, 16) + '...');
  console.log('   AuthTag:', authTag.toString('hex').slice(0, 16) + '...');
  console.log('   Encrypted size:', finalBuffer.length, 'bytes');
  
  return finalBuffer;
}

async function uploadEncryptedImage(encryptedBuffer) {
  const formData = new FormData();
  formData.append('file', encryptedBuffer, { filename: 'encrypted-image.bin' });
  
  const res = await axios.post(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    }
  );
  
  return res.data.IpfsHash;
}

async function sendEncryptedImage() {
  const imagePath = 'C:\\Users\\ateny\\.openclaw\\media\\inbound\\file_0---910d9a7b-a83e-4106-9d6b-532df8e84b13.jpg';
  
  const config = JSON.parse(fs.readFileSync('./agent-config.json', 'utf8'));
  const store = new ContactStore('./contacts.json');
  const friend = (await store.getAllFriends())[0];
  
  // Step 1: Encrypt the image
  console.log('🔐 Encrypting image with AES-GCM...');
  const encryptedImage = await encryptImage(imagePath, friend.topic);
  
  // Step 2: Upload encrypted image to IPFS
  console.log('📤 Uploading encrypted image to IPFS...');
  const imageCID = await uploadEncryptedImage(encryptedImage);
  console.log('✅ Encrypted image uploaded! CID:', imageCID);
  
  // Step 3: Create metadata message
  const messageContent = '📸 Encrypted Image\nOriginal: image.jpg\nEncrypted CID: ' + imageCID + '\n\nDecrypt using shared topic key with AES-256-GCM (IV + AuthTag + Data)';
  
  // Step 4: Encrypt metadata message
  console.log('\n🔐 Encrypting metadata message...');
  const { PrivateKey } = require('eciesjs');
  const CryptoJS = require('crypto-js');
  const { decryptKey } = require('./keys');
  
  const password = process.env.KEY_PASSWORD || 'AtlaMoltTalk2026!';
  const myPrivateKey = decryptKey(config.encryptedEciesKey, password);
  
  // Simple encryption for metadata using same approach as send-message.js
  const subtle = crypto.webcrypto.subtle;
  const derivedKeySeed = ethers.keccak256(
    ethers.concat([friend.topic, ethers.toUtf8Bytes('content-encryption')])
  );
  const contentKeyRawBytes = ethers.getBytes(derivedKeySeed);
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', contentKeyRawBytes, iv);
  const encrypted = Buffer.concat([cipher.update(messageContent), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  const payload = {
    version: '1',
    iv: '0x' + iv.toString('hex'),
    ciphertext: '0x' + encrypted.toString('hex'),
    authTag: '0x' + authTag.toString('hex'),
    senderAddr: config.walletAddress
  };
  
  // Step 5: Upload encrypted metadata
  console.log('📤 Uploading encrypted metadata...');
  const metaCID = await uploadToPinata(payload, PINATA_JWT);
  const metaHash = cidToBytes32(metaCID);
  
  // Step 6: Send on-chain
  console.log('⛓️  Sending encrypted image reference...');
  const provider = new ethers.JsonRpcProvider('https://143.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5');
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY || '0x449f3177e1983ea18938bf2d2a7c4a78d4bfec62a28de0154bc3acfd5fc37c6e', provider);
  
  const abi = ['function sendMessage(address _owner, address _meetingPoint, bytes32 _topic, bytes32 _cidHash, string memory _fullCID, bytes calldata _encKey) external'];
  const contract = new ethers.Contract('0xA5e73b15c1C3eE477AED682741f0324C6787bbb8', abi, wallet);
  
  // ECIES encrypt key for recipient
  const ecies = require('eciesjs');
  const receiverWrappedKey = ecies.encrypt(friend.publicKey, contentKeyRawBytes);
  
  const tx = await contract.sendMessage(
    '0x0000000000000000000000000000000000000000',
    friend.stealthAddress,
    friend.topic,
    metaHash,
    metaCID,
    '0x' + receiverWrappedKey.toString('hex')
  );
  
  console.log('Transaction:', tx.hash);
  await tx.wait();
  console.log('\n✅ Fully encrypted image sent to Amir!');
  console.log('   Image CID:', imageCID);
  console.log('   Metadata CID:', metaCID);
  console.log('   Explorer: https://monadscan.com/tx/' + tx.hash);
  
  // Save
  await store.addMessage({
    topic: friend.topic,
    sender: wallet.address,
    content: '[Encrypted Image] ' + imageCID,
    fullCID: metaCID,
    timestamp: Date.now(),
    isOutgoing: true,
    chain: 'monad',
    imageCID: imageCID
  });
}

sendEncryptedImage().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
