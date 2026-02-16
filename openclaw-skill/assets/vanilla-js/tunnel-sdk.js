/**
 * Tunnel SDK - Vanilla JavaScript
 * Decentralized stealth messaging for EVM chains
 */

class TunnelSDK {
  constructor(provider, contractAddresses) {
    this.provider = provider;
    this.contracts = {
      registry: new ethers.Contract(
        contractAddresses.registry,
        TUNNEL_REGISTRY_ABI,
        provider
      ),
      forwarder: new ethers.Contract(
        contractAddresses.forwarder,
        MINIMAL_FORWARDER_ABI,
        provider
      ),
      messages: new ethers.Contract(
        contractAddresses.messages,
        TUNNEL_MESSAGES_ABI,
        provider
      )
    };
    this.identity = null;
    this.session = null;
  }

  /**
   * Create identity from wallet signature
   */
  async createIdentity(signer) {
    const message = "Tunnel Identity Authorization";
    const signature = await signer.signMessage(message);
    
    const { privateKey, publicKey } = await this.deriveKeys(signature);
    
    this.identity = { privateKey, publicKey, signature };
    
    // Store encrypted
    const password = await this.promptPassword();
    const encrypted = await this.encryptWithPassword(privateKey, password);
    localStorage.setItem('tunnel_identity', encrypted);
    
    return this.identity;
  }

  /**
   * Load identity from storage
   */
  async loadIdentity(password) {
    const encrypted = localStorage.getItem('tunnel_identity');
    if (!encrypted) throw new Error('No identity found');
    
    const privateKey = await this.decryptWithPassword(encrypted, password);
    // Derive public key from private key
    const publicKey = this.getPublicKey(privateKey);
    
    this.identity = { privateKey, publicKey };
    return this.identity;
  }

  /**
   * Register identity on-chain
   */
  async registerIdentity(signer) {
    if (!this.identity) throw new Error('Identity not created');
    
    const contract = this.contracts.registry.connect(signer);
    const tx = await contract.registerIdentity(this.identity.publicKey);
    await tx.wait();
    return tx.hash;
  }

  /**
   * Create session burner wallet
   */
  async createSession(signer, durationHours = 12) {
    const burner = ethers.Wallet.createRandom();
    const expiration = Math.floor(Date.now() / 1000) + (durationHours * 60 * 60);
    
    const address = await signer.getAddress();
    const authHash = ethers.utils.solidityKeccak256(
      ['address', 'uint256'],
      [burner.address, expiration]
    );
    const authSignature = await signer.signMessage(ethers.utils.arrayify(authHash));
    
    const contract = this.contracts.registry.connect(signer);
    const tx = await contract.authorizeSession(burner.address, expiration, authSignature);
    await tx.wait();
    
    this.session = {
      address: burner.address,
      privateKey: burner.privateKey,
      expiration
    };
    
    sessionStorage.setItem('tunnel_session', JSON.stringify(this.session));
    return this.session;
  }

  /**
   * Send encrypted message
   */
  async sendMessage(to, content, relayerUrl = '/api/v1/submit') {
    if (!this.session) throw new Error('No active session');
    if (!this.identity) throw new Error('No identity loaded');
    
    const recipientPublicKey = await this.contracts.registry.getPublicKey(to);
    const encrypted = await this.encryptMessage(content, recipientPublicKey);
    
    const request = {
      from: this.session.address,
      to: this.contracts.messages.address,
      value: 0,
      gas: 100000,
      nonce: await this.contracts.forwarder.getNonce(this.session.address),
      data: this.contracts.messages.interface.encodeFunctionData('sendMessage', [
        to,
        encrypted.payload
      ])
    };
    
    const burnerWallet = new ethers.Wallet(this.session.privateKey);
    const signature = await burnerWallet._signTypedData(
      this.getEIP712Domain(),
      EIP712_TYPES,
      request
    );
    
    const response = await fetch(relayerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request,
        signature,
        chainId: this.getEIP712Domain().chainId
      })
    });
    
    return response.json();
  }

  /**
   * Listen for messages
   */
  onMessage(callback) {
    const filter = this.contracts.messages.filters.MessageSent(null, null, null);
    
    this.contracts.messages.on(filter, async (messageId, from, to, encryptedPayload) => {
      if (to.toLowerCase() !== this.getAddress().toLowerCase()) return;
      
      try {
        const senderPublicKey = await this.contracts.registry.getPublicKey(from);
        const content = await this.decryptMessage(encryptedPayload, senderPublicKey);
        
        callback({
          id: messageId,
          from,
          to,
          content,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('Failed to decrypt message:', err);
      }
    });
    
    return () => this.contracts.messages.removeAllListeners();
  }

  // Cryptographic methods (implement with @noble/curves)
  async deriveKeys(signature) {
    // Implement ECIES key derivation
    throw new Error('Not implemented');
  }

  async encryptMessage(message, recipientPublicKey) {
    // Implement ECIES encryption
    throw new Error('Not implemented');
  }

  async decryptMessage(payload, senderPublicKey) {
    // Implement ECIES decryption
    throw new Error('Not implemented');
  }

  // Utility methods
  async encryptWithPassword(data, password) {
    // Implement AES encryption
    throw new Error('Not implemented');
  }

  async decryptWithPassword(encrypted, password) {
    // Implement AES decryption
    throw new Error('Not implemented');
  }

  getPublicKey(privateKey) {
    // Derive public key from private key
    throw new Error('Not implemented');
  }

  getEIP712Domain() {
    return {
      name: 'TunnelForwarder',
      version: '1',
      chainId: 1337,
      verifyingContract: this.contracts.forwarder.address
    };
  }

  getAddress() {
    if (!this.identity) throw new Error('No identity');
    // Derive address from public key
    throw new Error('Not implemented');
  }

  promptPassword() {
    return new Promise((resolve) => {
      const password = window.prompt('Enter your Tunnel password:');
      resolve(password);
    });
  }
}

// ABIs
const TUNNEL_REGISTRY_ABI = [
  "function registerIdentity(bytes calldata publicKey) external",
  "function getPublicKey(address user) external view returns (bytes memory)",
  "function authorizeSession(address burnerAddress, uint256 expiration, bytes calldata signature) external",
  "function isAuthorizedSession(address user, address burner) external view returns (bool, uint256)"
];

const MINIMAL_FORWARDER_ABI = [
  "function getNonce(address from) external view returns (uint256)",
  "function execute(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, bytes data) calldata req, bytes calldata signature) external payable returns (bool, bytes memory)"
];

const TUNNEL_MESSAGES_ABI = [
  "function sendMessage(address to, bytes calldata encryptedPayload) external returns (bytes32)",
  "event MessageSent(bytes32 indexed messageId, address indexed from, address indexed to, bytes encryptedPayload)"
];

const EIP712_TYPES = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'data', type: 'bytes' }
  ]
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TunnelSDK };
} else {
  window.TunnelSDK = TunnelSDK;
}
