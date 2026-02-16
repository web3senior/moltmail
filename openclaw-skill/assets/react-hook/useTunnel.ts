import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

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

const EIP712_DOMAIN = {
  name: 'TunnelForwarder',
  version: '1',
  chainId: 1337, // Update for your chain
  verifyingContract: '0x...' // Your forwarder address
};

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

export function useTunnel(signer, contractAddresses) {
  const [identity, setIdentity] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);

  // Initialize contracts
  const registry = new ethers.Contract(
    contractAddresses.registry,
    TUNNEL_REGISTRY_ABI,
    signer
  );

  const forwarder = new ethers.Contract(
    contractAddresses.forwarder,
    MINIMAL_FORWARDER_ABI,
    signer
  );

  const messagesContract = new ethers.Contract(
    contractAddresses.messages,
    TUNNEL_MESSAGES_ABI,
    signer
  );

  /**
   * Create identity from wallet signature
   */
  const createIdentity = useCallback(async () => {
    const message = "Tunnel Identity Authorization";
    const signature = await signer.signMessage(message);
    
    // Derive ECIES keypair (implement with @noble/curves)
    const { privateKey, publicKey } = await deriveKeysFromSignature(signature);
    
    const identityData = {
      privateKey,
      publicKey,
      signature
    };
    
    // Encrypt and store private key
    const encrypted = await encryptWithPassword(privateKey, await promptPassword());
    localStorage.setItem('tunnel_identity', encrypted);
    
    setIdentity(identityData);
    return identityData;
  }, [signer]);

  /**
   * Register identity on-chain
   */
  const registerIdentity = useCallback(async (publicKey) => {
    const tx = await registry.registerIdentity(publicKey);
    await tx.wait();
    return tx.hash;
  }, [registry]);

  /**
   * Create and authorize session burner
   */
  const createSession = useCallback(async (durationHours = 12) => {
    // Generate burner wallet
    const burner = ethers.Wallet.createRandom();
    const expiration = Math.floor(Date.now() / 1000) + (durationHours * 60 * 60);
    
    // Create authorization signature
    const address = await signer.getAddress();
    const authHash = ethers.utils.solidityKeccak256(
      ['address', 'uint256'],
      [burner.address, expiration]
    );
    const authSignature = await signer.signMessage(ethers.utils.arrayify(authHash));
    
    // Authorize on-chain
    const tx = await registry.authorizeSession(burner.address, expiration, authSignature);
    await tx.wait();
    
    const sessionData = {
      address: burner.address,
      privateKey: burner.privateKey,
      expiration,
      authSignature
    };
    
    sessionStorage.setItem('tunnel_session', JSON.stringify(sessionData));
    setSession(sessionData);
    return sessionData;
  }, [signer, registry]);

  /**
   * Send encrypted message
   */
  const sendMessage = useCallback(async (to, content) => {
    if (!session) throw new Error('No active session');
    
    // Get recipient's public key
    const recipientPublicKey = await registry.getPublicKey(to);
    
    // Encrypt message (implement ECIES encryption)
    const encrypted = await encryptMessage(content, recipientPublicKey, identity.privateKey);
    
    // Create meta-transaction
    const request = {
      from: session.address,
      to: contractAddresses.messages,
      value: 0,
      gas: 100000,
      nonce: await forwarder.getNonce(session.address),
      data: messagesContract.interface.encodeFunctionData('sendMessage', [
        to,
        encrypted.payload
      ])
    };
    
    // Sign with burner
    const burnerWallet = new ethers.Wallet(session.privateKey);
    const signature = await burnerWallet._signTypedData(
      EIP712_DOMAIN,
      EIP712_TYPES,
      request
    );
    
    // Submit to relayer
    const response = await fetch('/api/v1/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request,
        signature,
        chainId: EIP712_DOMAIN.chainId
      })
    });
    
    const result = await response.json();
    return result;
  }, [session, identity, registry, forwarder, messagesContract]);

  /**
   * Listen for incoming messages
   */
  useEffect(() => {
    if (!messagesContract) return;
    
    const address = signer.getAddress();
    const filter = messagesContract.filters.MessageSent(null, null, address);
    
    messagesContract.on(filter, async (messageId, from, to, encryptedPayload) => {
      // Decrypt message
      const senderPublicKey = await registry.getPublicKey(from);
      const decrypted = await decryptMessage(
        encryptedPayload,
        senderPublicKey,
        identity.privateKey
      );
      
      setMessages(prev => [...prev, {
        id: messageId,
        from,
        content: decrypted,
        timestamp: Date.now()
      }]);
    });
    
    return () => messagesContract.removeAllListeners();
  }, [messagesContract, signer, identity, registry]);

  /**
   * Load stored identity/session on mount
   */
  useEffect(() => {
    const storedIdentity = localStorage.getItem('tunnel_identity');
    const storedSession = sessionStorage.getItem('tunnel_session');
    
    if (storedIdentity) {
      // Decrypt and load
      decryptWithPassword(storedIdentity, password).then(privateKey => {
        setIdentity({ privateKey /* ... */ });
      });
    }
    
    if (storedSession) {
      setSession(JSON.parse(storedSession));
    }
  }, []);

  return {
    identity,
    session,
    messages,
    createIdentity,
    registerIdentity,
    createSession,
    sendMessage
  };
}

// Placeholder functions - implement with @noble/curves
declare function deriveKeysFromSignature(signature: string): Promise<{ privateKey: string; publicKey: string }>;
declare function encryptWithPassword(data: string, password: string): Promise<string>;
declare function decryptWithPassword(encrypted: string, password: string): Promise<string>;
declare function encryptMessage(message: string, recipientPublicKey: string, senderPrivateKey: string): Promise<{ payload: string }>;
declare function decryptMessage(payload: string, senderPublicKey: string, recipientPrivateKey: string): Promise<string>;
declare function promptPassword(): Promise<string>;
