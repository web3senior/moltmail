const { ethers } = require('ethers');
const { ContactStore } = require('./contacts');
const { fetchFromPinata } = require('./pinata');
const { decryptMessage } = require('./encrypt');

async function fetchMissing() {
  const provider = new ethers.JsonRpcProvider('https://143.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5');
  const abi = ['function getTopicHistory(bytes32 _topic, uint256 _offset, uint256 _limit) public view returns (tuple(address sender, uint256 timestamp, bytes32 cidHash, string fullCID, bytes encryptedKey, bool isEdited, bool isDeleted)[] memory result, uint256 totalMessages)'];
  const contract = new ethers.Contract('0xA5e73b15c1C3eE477AED682741f0324C6787bbb8', abi, provider);
  
  const store = new ContactStore('./contacts.json');
  const friend = (await store.getAllFriends())[0];
  const [messages] = await contract.getTopicHistory(friend.topic, 0, 50);
  
  console.log('Checking for missing messages...\n');
  
  let foundNew = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.isDeleted) continue;
    
    const existing = await store.getMessageByCID(msg.fullCID);
    if (!existing) {
      const time = new Date(Number(msg.timestamp) * 1000).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false});
      const sender = msg.sender.toLowerCase() === '0x7545d53258219153a599d5210d332667e3e43db7'.toLowerCase() ? 'Atla' : 'Amir';
      
      console.log('[NEW] ' + time + ' from ' + sender);
      console.log('   CID:', msg.fullCID.slice(0, 40));
      
      try {
        const payload = await fetchFromPinata(msg.fullCID);
        const plaintext = await decryptMessage(payload, friend.topic);
        console.log('   Content:', plaintext);
        
        await store.addMessage({
          topic: friend.topic,
          sender: msg.sender,
          content: plaintext,
          fullCID: msg.fullCID,
          timestamp: Number(msg.timestamp) * 1000,
          isOutgoing: sender === 'Atla',
          chain: 'monad'
        });
        
        foundNew++;
        console.log('   Saved!\n');
      } catch(e) {
        console.log('   Error:', e.message.slice(0, 50), '\n');
      }
    }
  }
  
  console.log('Total new messages found:', foundNew);
}

fetchMissing();
