const { ethers } = require('ethers');
const { decryptKey } = require('./keys');
const { decryptMessage } = require('./encrypt');
const { ContactStore } = require('./contacts');
const { fetchFromPinata } = require('./pinata');
const fs = require('fs').promises;

async function fullCheck() {
  const provider = new ethers.JsonRpcProvider('https://143.rpc.thirdweb.com/a2fa0ffd825845ef577d25a7d93d43c5');
  const abi = [
    'function getPaginatedTopics(address _meetingPoint, uint256 _offset, uint256 _limit) external view returns (bytes32[] memory result, uint256 total)',
    'function getTopicHistory(bytes32 _topic, uint256 _offset, uint256 _limit) public view returns (tuple(address sender, uint256 timestamp, bytes32 cidHash, string fullCID, bytes encryptedKey, bool isEdited, bool isDeleted)[] memory result, uint256 totalMessages)'
  ];
  
  const contract = new ethers.Contract('0xA5e73b15c1C3eE477AED682741f0324C6787bbb8', abi, provider);
  
  const store = new ContactStore('./contacts.json');
  const config = JSON.parse(await fs.readFile('./agent-config.json', 'utf8'));
  
  const friends = await store.getAllFriends();
  
  console.log('=== FULL MONAD CHECK ===\n');
  
  for (const friend of friends) {
    console.log('Contact:', friend.name);
    console.log('Stealth Address:', friend.stealthAddress);
    console.log('');
    
    const [topics, totalTopics] = await contract.getPaginatedTopics(friend.stealthAddress, 0, 50);
    console.log('Total Topics:', totalTopics.toString());
    
    let totalChainMessages = 0;
    let newMessagesFound = 0;
    
    for (const topic of topics) {
      console.log('\nTopic:', topic);
      const [messages, totalMsgs] = await contract.getTopicHistory(topic, 0, 50);
      console.log('  Messages on chain:', totalMsgs.toString());
      totalChainMessages += Number(totalMsgs);
      
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.isDeleted) continue;
        
        const existing = await store.getMessageByCID(msg.fullCID);
        if (!existing) {
          console.log('\n  [NEW MESSAGE ' + i + ']');
          console.log('     Sender:', msg.sender);
          console.log('     Time:', new Date(Number(msg.timestamp) * 1000).toLocaleString());
          console.log('     CID:', msg.fullCID.slice(0, 30) + '...');
          
          try {
            const payload = await fetchFromPinata(msg.fullCID);
            const plaintext = await decryptMessage(payload, friend.topic);
            console.log('     Content:', plaintext);
            
            await store.addMessage({
              topic: friend.topic,
              sender: msg.sender,
              content: plaintext,
              fullCID: msg.fullCID,
              timestamp: Number(msg.timestamp) * 1000,
              isOutgoing: msg.sender.toLowerCase() === config.walletAddress.toLowerCase(),
              chain: 'monad'
            });
            
            newMessagesFound++;
          } catch(e) {
            console.log('     Error:', e.message.slice(0, 50));
          }
        }
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log('Total messages on Monad chain:', totalChainMessages);
    console.log('New messages found:', newMessagesFound);
    
    const savedMessages = await store.getMessagesByTopic(friend.topic, 100);
    console.log('Messages in local store:', savedMessages.length);
  }
}

fullCheck().catch(console.error);
