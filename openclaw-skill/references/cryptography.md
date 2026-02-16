# Tunnel Cryptography

## Key Libraries

Your implementation uses:
- `eciesjs` - ECIES encryption/decryption
- `ethers` - Ethereum utilities, SigningKey for shared secrets
- Web Crypto API - AES-GCM encryption
- `multiformats/cid` - CID parsing

## Key Generation & Storage

### Generate ECIES Keypair

```javascript
import { PrivateKey } from 'eciesjs';

function generateEciesKeyPair() {
  // Generate new ECIES keypair
  const sk = new PrivateKey();
  
  // Private key (32 bytes) as hex
  const privateKeyHex = '0x' + sk.secret.toString('hex');
  
  // Public key (65 bytes uncompressed: 0x04 + X + Y)
  const publicKeyBytes = sk.publicKey.toBytes();
  const publicKeyHex = '0x' + Buffer.from(publicKeyBytes).toString('hex');
  
  return { privateKeyHex, publicKeyHex };
}
```

### Store Encrypted Keys

```javascript
import CryptoJS from 'crypto-js';

// Encrypt private key with user password
const encrypted = CryptoJS.AES.encrypt(privateKeyHex, password).toString();
localStorage.setItem('encryptedAppKey', encrypted);

// Decrypt when needed
const bytes = CryptoJS.AES.decrypt(encrypted, password);
const decryptedKeyHex = bytes.toString(CryptoJS.enc.Utf8);
const privKey = new PrivateKey(Buffer.from(decryptedKeyHex, 'hex'));
```

## Shared Secret Calculation

Using ethers.js SigningKey for ECDH:

```javascript
import { SigningKey } from 'ethers';

// Calculate shared secret with contact
const myPrivateKeyHex = '0x...'; // Your private key
const contactPublicKeyHex = '0x04...'; // Contact's public key from registry

const signingKey = new SigningKey(myPrivateKeyHex);
const sharedSecret = signingKey.computeSharedSecret(contactPublicKeyHex);
// Returns: 0x-prefixed hex string
```

Both parties calculate the **same shared secret** without transmitting it.

## Stealth Address Derivation

### Meeting Point Address

```javascript
import { ethers } from 'ethers';

function deriveStealthAddress(sharedSecret) {
  // Stealth address = last 20 bytes of keccak256(sharedSecret)
  const stealthAddress = ethers.getAddress(
    ethers.dataSlice(ethers.keccak256(sharedSecret), 12)
  );
  
  return stealthAddress;
}
```

### Topic Derivation

```javascript
import { ethers } from 'ethers';

function deriveTopic(sharedSecret) {
  // Topic = keccak256(sharedSecret)
  const topic = ethers.keccak256(sharedSecret);
  return topic;
}
```

Both parties independently arrive at the same stealth address and topic.

## Message Encryption

Your implementation uses **AES-GCM** for content, with the key derived from the topic:

```javascript
import { ethers } from 'ethers';
import ecies from 'eciesjs';

async function encryptMessage(content, topic, recipientPublicKey) {
  const subtle = window.crypto.subtle;
  
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
  
  // 3. Encrypt content with AES-GCM
  const encodedMessage = new TextEncoder().encode(content);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv }, 
    contentKey, 
    encodedMessage
  );
  
  // 4. Package payload for IPFS
  const encryptedPayload = {
    version: '1',
    iv: ethers.hexlify(iv),
    ciphertext: ethers.hexlify(new Uint8Array(ciphertext)),
    senderAddr: senderAddress
  };
  
  // 5. Also wrap the raw key with recipient's public key (ECIES backup)
  const receiverWrappedKey = ecies.encrypt(
    recipientPublicKey, 
    Buffer.from(contentKeyRawBytes)
  );
  
  return {
    payload: encryptedPayload,
    encryptedKey: receiverWrappedKey // Buffer, convert to hex for contract
  };
}
```

## Message Decryption

```javascript
async function decryptMessage(ipfsPayload, topic) {
  const subtle = window.crypto.subtle;
  
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
  
  // 2. Extract IV and ciphertext from IPFS payload
  const iv = ethers.getBytes(ipfsPayload.iv);
  const ciphertext = ethers.getBytes(ipfsPayload.ciphertext);
  
  // 3. Decrypt
  const decryptedBuffer = await subtle.decrypt(
    { name: 'AES-GCM', iv }, 
    contentKey, 
    ciphertext
  );
  
  // 4. Decode plaintext
  const plaintext = new TextDecoder().decode(decryptedBuffer);
  return plaintext;
}
```

## IPFS CID to bytes32

Convert IPFS CID to raw digest hash for on-chain storage:

```javascript
import { CID } from 'multiformats/cid';
import { ethers } from 'ethers';

function getRawDigestHash(cidString) {
  const cid = CID.parse(cidString);
  const rawDigestBuffer = cid.multihash.digest;
  
  if (rawDigestBuffer.length !== 32) {
    throw new Error(`Hash digest is ${rawDigestBuffer.length} bytes, expected 32`);
  }
  
  // Convert to 0x-prefixed hex string (bytes32)
  return ethers.utils.toHex(rawDigestBuffer); // or web3.utils.toHex
}
```

## Security Properties

| Property | Implementation |
|----------|---------------|
| **Forward Secrecy** | Topic-derived keys, unique per conversation |
| **Non-repudiation** | On-chain sender verification |
| **Metadata Resistance** | Stealth addresses break wallet-to-wallet links |
| **Content Privacy** | AES-GCM encryption, IPFS storage |
| **Key Backup** | ECIES-wrapped key as fallback |

## Dependencies

```json
{
  "dependencies": {
    "eciesjs": "^0.x",
    "ethers": "^6.x",
    "multiformats": "^13.x",
    "crypto-js": "^4.x"
  }
}
```
