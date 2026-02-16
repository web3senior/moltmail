const axios = require('axios');
const FormData = require('form-data');
const { ethers } = require('ethers');

/**
 * Upload content to Pinata
 * @param {object} content - Content to upload
 * @param {string} pinataJWT - Pinata JWT token
 * @param {string} filename - Optional filename
 * @returns {Promise<string>} IPFS CID
 */
async function uploadToPinata(content, pinataJWT, filename = 'data.json') {
  const formData = new FormData();
  const blob = Buffer.from(JSON.stringify(content));
  formData.append('file', blob, filename);
  
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
}

/**
 * Fetch content from Pinata gateway
 * @param {string} cid - IPFS CID
 * @param {string} gatewayUrl - Gateway URL
 * @returns {Promise<object>}
 */
async function fetchFromPinata(cid, gatewayUrl = 'https://gateway.pinata.cloud/ipfs/') {
  const url = `${gatewayUrl}${cid}`;
  const res = await axios.get(url, { timeout: 10000 });
  return res.data;
}

/**
 * Convert CID to bytes32 for on-chain storage
 * For v0 CIDs (Qm...), decode base58 and extract the multihash digest
 * @param {string} cidString - IPFS CID (v0 starting with Qm)
 * @returns {string} bytes32 hex
 */
function cidToBytes32(cidString) {
  // IPFS v0 CID uses base58 encoding
  // Format: <multihash-type><multihash-length><multihash-digest>
  // For sha2-256: type=0x12, length=0x20 (32 bytes)
  
  // Simple base58 decode for Qm... CIDs
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const base58Decode = (str) => {
    const alphabetMap = new Map([...ALPHABET].map((c, i) => [c, BigInt(i)]));
    let num = BigInt(0);
    for (const char of str) {
      num = num * BigInt(58) + alphabetMap.get(char);
    }
    
    // Convert to bytes
    const bytes = [];
    while (num > 0) {
      bytes.unshift(Number(num % BigInt(256)));
      num = num / BigInt(256);
    }
    
    // Add leading zero bytes that were encoded as '1's
    for (let i = 0; i < str.length && str[i] === '1'; i++) {
      bytes.unshift(0);
    }
    
    return new Uint8Array(bytes);
  };
  
  const decoded = base58Decode(cidString);
  
  // IPFS v0 CID structure: <varint-type><varint-length><digest>
  // For sha2-256: 0x12 0x20 <32 bytes>
  // Skip the first 2 bytes (type and length) to get the 32-byte digest
  if (decoded.length < 34) {
    throw new Error(`CID too short: ${decoded.length} bytes`);
  }
  
  const digest = decoded.slice(2, 34); // Extract 32-byte digest
  return ethers.hexlify(digest);
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'upload' && args.length >= 3) {
    const content = JSON.parse(args[1]);
    const jwt = args[2];
    uploadToPinata(content, jwt)
      .then(cid => console.log(JSON.stringify({ cid })))
      .catch(console.error);
  } else if (args[0] === 'fetch' && args.length >= 2) {
    const cid = args[1];
    const gateway = args[2];
    fetchFromPinata(cid, gateway)
      .then(data => console.log(JSON.stringify(data, null, 2)))
      .catch(console.error);
  } else if (args[0] === 'hash' && args.length >= 2) {
    const cid = args[1];
    console.log(cidToBytes32(cid));
  } else {
    console.log('Usage:');
    console.log('  node pinata.js upload \'{...}\' <jwt>');
    console.log('  node pinata.js fetch <cid> [gateway]');
    console.log('  node pinata.js hash <cid>');
  }
}

module.exports = {
  uploadToPinata,
  fetchFromPinata,
  cidToBytes32
};
