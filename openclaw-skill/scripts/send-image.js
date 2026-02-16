const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { ethers } = require('ethers');
const { ContactStore } = require('./contacts');

// Pinata JWT
const PINATA_JWT = process.env.PINATA_JWT || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJjZDc3YzVkNy0yNzkzLTRkOWQtYTYyZi1lNmFhYTZjN2ZhNjQiLCJlbWFpbCI6ImRyYWNvc0BhcmF0dGEuZGV2IiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjVmMzA1YTkxZWRlYjE4MGZkMGJiIiwic2NvcGVkS2V5U2VjcmV0IjoiYWMzOTVjMDBhZTE5YmNhZTgyNDFlMWIwYWIzYmQ0ZjRlNjg4NjA0NGZjNDFmZjc3NDk0Zjc0Yzc4M2QxODQ1ZSIsImV4cCI6MTc4NTI3ODM1OX0.e-PKrXOfLjSjwHwYSs60FkJBfDbf2zptWpi56JVF_-U';

async function uploadImageToIPFS(imagePath) {
  const formData = new FormData();
  const fileStream = fs.createReadStream(imagePath);
  formData.append('file', fileStream);
  
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

async function sendImage() {
  const imagePath = 'C:\\Users\\ateny\\.openclaw\\media\\inbound\\file_0---910d9a7b-a83e-4106-9d6b-532df8e84b13.jpg';
  
  console.log('📤 Uploading image to IPFS...');
  const cid = await uploadImageToIPFS(imagePath);
  console.log('✅ Image uploaded! CID:', cid);
  console.log('🔗 IPFS URL: https://gateway.pinata.cloud/ipfs/' + cid);
  
  // Now send the CID through MoltTalk
  const config = JSON.parse(fs.readFileSync('./agent-config.json', 'utf8'));
  const provider = new ethers.JsonRpcProvider('https://143.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5');
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY || '0x449f3177e1983ea18938bf2d2a7c4a78d4bfec62a28de0154bc3acfd5fc37c6e', provider);
  
  const store = new ContactStore('./contacts.json');
  const friend = (await store.getAllFriends())[0];
  
  // Create message with image reference
  const messageContent = '📸 Image shared via MoltTalk\nIPFS: ' + cid + '\nhttps://gateway.pinata.cloud/ipfs/' + cid;
  
  console.log('\n📨 Sending image reference to Amir on Monad...');
  
  // Use simple approach - send the IPFS link as a text message
  const abi = ['function sendMessage(address _owner, address _meetingPoint, bytes32 _topic, bytes32 _cidHash, string memory _fullCID, bytes calldata _encKey) external'];
  const contract = new ethers.Contract('0xA5e73b15c1C3eE477AED682741f0324C6787bbb8', abi, wallet);
  
  // For image, we'll use a simplified approach - just send the IPFS URL as the CID
  const tx = await contract.sendMessage(
    '0x0000000000000000000000000000000000000000',
    friend.stealthAddress,
    friend.topic,
    ethers.keccak256(ethers.toUtf8Bytes(cid)),
    'ipfs://' + cid,
    '0x' // empty encrypted key for simple image sharing
  );
  
  console.log('Transaction:', tx.hash);
  await tx.wait();
  console.log('✅ Image sent to Amir!');
  console.log('\nExplorer: https://monadscan.com/tx/' + tx.hash);
}

sendImage().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
