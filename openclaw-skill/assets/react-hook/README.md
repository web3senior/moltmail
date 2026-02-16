# Tunnel React Hook

A React hook for integrating Tunnel messaging into your application.

## Installation

```bash
npm install @noble/curves @noble/hashes ethers
```

## Usage

```tsx
import { useTunnel } from './useTunnel';

function ChatComponent() {
  const { 
    identity, 
    session, 
    messages, 
    createIdentity, 
    createSession, 
    sendMessage 
  } = useTunnel(signer, {
    registry: '0x...',
    forwarder: '0x...',
    messages: '0x...'
  });

  const handleSend = async () => {
    await sendMessage('0xRecipient...', 'Hello!');
  };

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

## API

### `useTunnel(signer, contractAddresses)`

**Parameters:**
- `signer`: ethers.Signer instance
- `contractAddresses`: Object with registry, forwarder, messages addresses

**Returns:**
- `identity`: Current user's ECIES identity
- `session`: Active session burner wallet
- `messages`: Array of received messages
- `createIdentity()`: Create new identity from wallet signature
- `registerIdentity(publicKey)`: Register on-chain
- `createSession(durationHours)`: Create session burner
- `sendMessage(to, content)`: Send encrypted message
