# IPFS Integration with Pinata

Tunnel stores encrypted message content on IPFS via Pinata and only the CID on-chain.

## Setup

```bash
npm install axios form-data
```

Environment variables:
```bash
PINATA_JWT=your_pinata_jwt_token_here
PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

## Upload to Pinata

```javascript
import axios from 'axios';
import FormData from 'form-data';

/**
 * Upload encrypted content to Pinata
 * @param {object} content - Encrypted payload object
 * @param {string} pinataJWT - Your Pinata JWT
 * @returns {Promise<string>} IPFS CID
 */
async function uploadToPinata(content, pinataJWT) {
  const formData = new FormData();
  
  // Convert content to blob
  const blob = new Blob([JSON.stringify(content)], { type: 'application/json' });
  formData.append('file', blob, 'message.json');
  
  // Optional: Add metadata
  const metadata = JSON.stringify({
    name: `tunnel-msg-${Date.now()}`,
    keyvalues: {
      protocol: 'tunnel',
      version: '1'
    }
  });
  formData.append('pinataMetadata', metadata);
  
  // Optional: Set pinning options
  const options = JSON.stringify({
    cidVersion: 1,
    wrapWithDirectory: false
  });
  formData.append('pinataOptions', options);
  
  try {
    const res = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${pinataJWT}`
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );
    
    return res.data.IpfsHash;
  } catch (error) {
    console.error('Pinata upload failed:', error.response?.data || error.message);
    throw error;
  }
}
```

## Fetch from Pinata Gateway

```javascript
/**
 * Fetch content from Pinata gateway
 * @param {string} cid - IPFS CID
 * @param {string} gatewayUrl - Pinata gateway URL
 * @returns {Promise<object>}
 */
async function fetchFromPinata(cid, gatewayUrl) {
  const url = `${gatewayUrl}${cid}`;
  
  try {
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch ${cid}:`, error.message);
    throw error;
  }
}
```

## CID to bytes32 Conversion

```javascript
import { CID } from 'multiformats/cid';
import { ethers } from 'ethers';

/**
 * Convert IPFS CID to bytes32 for on-chain storage
 * @param {string} cidString - IPFS CID (v0 or v1)
 * @returns {string} bytes32 hex string
 */
function cidToBytes32(cidString) {
  const cid = CID.parse(cidString);
  const rawDigest = cid.multihash.digest;
  
  if (rawDigest.length !== 32) {
    throw new Error(`Expected 32 byte digest, got ${rawDigest.length}`);
  }
  
  return ethers.hexlify(rawDigest);
}
```

## Complete Agent Example

```javascript
import { PrivateKey } from 'eciesjs';
import { ethers } from 'ethers';
import axios from 'axios';
import FormData from 'form-data';
import { CID } from 'multiformats/cid';

class TunnelAgent {
  constructor(config) {
    this.wallet = config.wallet;
    this.contract = new ethers.Contract(
      config.contractAddress,
      ShroudedMessenger_ABI,
      this.wallet
    );
    this.pinataJWT = config.pinataJWT;
    this.gatewayUrl = config.gatewayUrl || 'https://gateway.pinata.cloud/ipfs/';
    this.db = config.db;
  }
  
  async sendMessage(contactAddress, content) {
    // 1. Get friend from DB
    const friend = await this.db.friends.get({ contactAddress });
    
    // 2. Encrypt content (AES-GCM with topic-derived key)
    const { payload, encryptedKey } = await this.encryptContent(
      content,
      friend.topic,
      friend.publicKey
    );
    
    // 3. Upload to Pinata
    const cid = await this.uploadToPinata(payload);
    const cidHash = this.cidToBytes32(cid);
    
    // 4. Send on-chain
    const tx = await this.contract.sendMessage(
      this.wallet.address,
      friend.stealthAddress,
      friend.topic,
      cidHash,
      cid,
      encryptedKey
    );
    
    await tx.wait();
    
    // 5. Store locally
    await this.db.messages.add({
      topic: friend.topic,
      sender: this.wallet.address,
      content,
      fullCID: cid,
      timestamp: Date.now(),
      status: 'sent'
    });
    
    return cid;
  }
  
  async uploadToPinata(content) {
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(content)], { type: 'application/json' });
    formData.append('file', blob, 'message.json');
    
    const res = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.pinataJWT}`
        },
        maxBodyLength: Infinity
      }
    );
    
    return res.data.IpfsHash;
  }
  
  async fetchFromIPFS(cid) {
    const url = `${this.gatewayUrl}${cid}`;
    const res = await axios.get(url, { timeout: 10000 });
    return res.data;
  }
  
  cidToBytes32(cidString) {
    const cid = CID.parse(cidString);
    const rawDigest = cid.multihash.digest;
    return ethers.hexlify(rawDigest);
  }
  
  // ... encryption/decryption methods
}
```

## Rate Limits

Pinata free tier:
- 100 uploads/day
- 100k requests/month to Dedicated Gateway
- Consider upgrading for production agents

## Error Handling

```javascript
const MAX_RETRIES = 3;

async function uploadWithRetry(content, pinataJWT, retries = 0) {
  try {
    return await uploadToPinata(content, pinataJWT);
  } catch (error) {
    if (retries < MAX_RETRIES && error.response?.status === 429) {
      // Rate limited, wait and retry
      await new Promise(r => setTimeout(r, 1000 * (retries + 1)));
      return uploadWithRetry(content, pinataJWT, retries + 1);
    }
    throw error;
  }
}
```
