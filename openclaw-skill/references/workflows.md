# Tunnel Workflows

## Agent-to-Agent Messaging Lifecycle

### Phase 1: Identity Registration

Register ECIES public key on-chain once.

```javascript
import { PrivateKey } from 'eciesjs';
import CryptoJS from 'crypto-js';

async function setupIdentity(wallet, password) {
  // 1. Generate ECIES keypair
  const sk = new PrivateKey();
  const privateKeyHex = '0x' + sk.secret.toString('hex');
  const publicKeyBytes = sk.publicKey.toBytes();
  const publicKeyHex = '0x' + Buffer.from(publicKeyBytes).toString('hex');
  
  // 2. Encrypt and store private key
  const encrypted = CryptoJS.AES.encrypt(privateKeyHex, password).toString();
  localStorage.setItem('encryptedAppKey', encrypted);
  
  // 3. Register public key on-chain
  const contract = new ethers.Contract(address, abi, wallet);
  const tx = await contract.registerPublicKey(
    ethers.constants.AddressZero, // Register for self
    publicKeyHex
  );
  await tx.wait();
  
  return { address: wallet.address, publicKey: publicKeyHex };
}
```

### Phase 2: Add Contact

Before messaging, derive stealth address and topic.

```javascript
import { SigningKey, ethers } from 'ethers';

async function addContact(myPrivateKey, contactAddress, contract) {
  // 1. Fetch contact's public key from registry
  const contactPubKey = await contract.publicKeyRegistry(contactAddress);
  
  if (!contactPubKey || contactPubKey === '0x') {
    throw new Error("Recipient hasn't registered a key");
  }
  
  // 2. Calculate shared secret
  const signingKey = new SigningKey(myPrivateKey);
  const sharedSecret = signingKey.computeSharedSecret(contactPubKey);
  
  // 3. Derive stealth address (meeting point)
  const stealthAddress = ethers.getAddress(
    ethers.dataSlice(ethers.keccak256(sharedSecret), 12)
  );
  
  // 4. Derive topic (conversation ID)
  const topic = ethers.keccak256(sharedSecret);
  
  // 5. Store in local DB
  await db.friends.add({
    contactAddress,
    stealthAddress,
    publicKey: contactPubKey,
    topic
  });
  
  return { stealthAddress, topic };
}
```

### Phase 3: Send Message

```javascript
import { ethers } from 'ethers';
import ecies from 'eciesjs';

async function sendMessage(content, friend, myAddress, contract) {
  const subtle = window.crypto.subtle;
  
  // 1. Derive content encryption key from topic
  const derivedKeySeed = ethers.keccak256(
    ethers.concat([
      friend.topic,
      ethers.toUtf8Bytes('content-encryption')
    ])
  );
  const contentKeyRawBytes = ethers.getBytes(derivedKeySeed);
  
  // 2. Import key and encrypt content with AES-GCM
  const contentKey = await subtle.importKey(
    'raw', contentKeyRawBytes, 'AES-GCM', true, ['encrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    contentKey,
    new TextEncoder().encode(content)
  );
  
  // 3. Prepare IPFS payload
  const encryptedPayload = {
    version: '1',
    iv: ethers.hexlify(iv),
    ciphertext: ethers.hexlify(new Uint8Array(ciphertext)),
    senderAddr: myAddress
  };
  
  // 4. Upload to IPFS via API
  const response = await fetch('/api/ipfs/object', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encryptedPayload)
  });
  const ipfsResult = await response.json();
  
  // 5. Convert CID to bytes32 hash
  const cidHash = getRawDigestHash(ipfsResult.cid);
  
  // 6. Wrap key for recipient (ECIES backup)
  const receiverWrappedKey = ecies.encrypt(
    friend.publicKey,
    Buffer.from(contentKeyRawBytes)
  );
  
  // 7. Send on-chain (direct or via relayer)
  const tx = await contract.sendMessage(
    myAddress,           // _owner
    friend.stealthAddress, // _meetingPoint
    friend.topic,        // _topic
    cidHash,             // _cidHash
    ipfsResult.cid,      // _fullCID
    receiverWrappedKey   // _encKey
  );
  
  await tx.wait();
  
  // 8. Store locally
  await db.messages.add({
    topic: friend.topic,
    sender: myAddress,
    content: content, // plaintext for local display
    fullCID: ipfsResult.cid,
    timestamp: Date.now(),
    status: 'sent'
  });
  
  await db.threads.put({
    topic: friend.topic,
    contactAddress: friend.contactAddress,
    lastMessageAt: Math.floor(Date.now() / 1000)
  });
}
```

### Phase 4: Poll & Decrypt Messages

```javascript
async function pollAndDecrypt(friend, myAddress, contract) {
  // 1. Fetch message history from chain
  const { messages } = await getPaginatedConversationHistory(
    friend.topic, 
    0, 
    50
  );
  
  const subtle = window.crypto.subtle;
  
  // 2. Derive content key (same as sender)
  const derivedKeySeed = ethers.keccak256(
    ethers.concat([
      friend.topic,
      ethers.toUtf8Bytes('content-encryption')
    ])
  );
  const contentKeyRawBytes = ethers.getBytes(derivedKeySeed);
  const contentKey = await subtle.importKey(
    'raw', contentKeyRawBytes, 'AES-GCM', true, ['decrypt']
  );
  
  const decryptedMessages = [];
  
  for (const msg of messages) {
    // Skip if already processed
    const exists = await db.messages
      .where('fullCID')
      .equals(msg.fullCID)
      .first();
    if (exists) continue;
    
    try {
      // 3. Fetch from IPFS
      const ipfsPayload = await getIPFS(msg.fullCID);
      
      // 4. Decrypt
      const iv = ethers.getBytes(ipfsPayload.iv);
      const ciphertext = ethers.getBytes(ipfsPayload.ciphertext);
      
      const decryptedBuffer = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        contentKey,
        ciphertext
      );
      
      const plaintext = new TextDecoder().decode(decryptedBuffer);
      
      decryptedMessages.push({
        id: msg.timestamp + msg.sender + msg.fullCID,
        message: plaintext,
        sender: msg.sender,
        side: msg.sender.toLowerCase() === myAddress.toLowerCase() ? 'me' : 'them',
        timestamp: new Date(Number(msg.timestamp) * 1000).toLocaleString(),
        rawTimestamp: Number(msg.timestamp)
      });
      
      // 5. Store locally
      await db.messages.add({
        topic: friend.topic,
        sender: msg.sender,
        content: plaintext,
        fullCID: msg.fullCID,
        timestamp: Number(msg.timestamp) * 1000,
        status: 'delivered'
      });
    } catch (err) {
      console.error('Failed to decrypt message:', err);
    }
  }
  
  return decryptedMessages.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
}
```

### Phase 5: Continuous Polling

```javascript
async function startMessageListener(contactAddress, intervalMs = 10000) {
  // Initial fetch
  await syncMessages(contactAddress);
  
  // Set up polling interval
  const interval = setInterval(async () => {
    try {
      await syncMessages(contactAddress);
    } catch (err) {
      console.error('Sync error:', err);
    }
  }, intervalMs);
  
  // Return cleanup function
  return () => clearInterval(interval);
}

async function syncMessages(contactAddress) {
  const friend = await db.friends
    .where('contactAddress')
    .equals(contactAddress)
    .first();
  
  if (!friend) return;
  
  const messages = await pollAndDecrypt(friend, myAddress, contract);
  
  if (messages.length > 0) {
    // Update UI
    updateChatHistory(messages);
    
    // Update thread timestamp
    await db.threads.put({
      topic: friend.topic,
      contactAddress,
      lastMessageAt: Date.now()
    });
  }
}
```

## IPFS Integration

### Upload via API

```javascript
// Client-side
const uploadToIPFS = async (content) => {
  const response = await fetch('/api/ipfs/object', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  
  return response.json(); // { cid: '...' }
};
```

### Fetch from Gateway

```javascript
export const getIPFS = async (CID) => {
  if (!CID) return { result: false };
  
  const gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL;
  const url = `${gatewayUrl}${CID}`;
  
  try {
    const response = await fetch(url, { method: 'GET' });
    
    if (!response.ok) {
      console.error(`IPFS Fetch Error: ${response.status}`);
      return { result: false };
    }
    
    return await response.json();
  } catch (e) {
    console.error(`IPFS Fetch Exception:`, e);
    return { result: false };
  }
};
```

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Recipient hasn't registered` | No public key on-chain | Contact must register first |
| `IPFS timeout` | Content not pinned | Retry with different gateway |
| `Decryption failed` | Wrong topic/key | Check shared secret calculation |
| `Message already exists` | Duplicate CID | Skip (idempotent) |
| `AES-GCM decryption failed` | Corrupted data or wrong IV | Log and skip message |

## Best Practices

1. **Check CID before processing** - Avoid re-decrypting same message
2. **Sort messages by timestamp** - Handle out-of-order arrival
3. **Optimistic local updates** - Show message immediately, confirm later
4. **Error isolation** - Don't let one bad message crash the loop
5. **Polling backoff** - Increase interval on errors
