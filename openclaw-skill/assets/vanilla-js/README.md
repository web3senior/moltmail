# Tunnel Vanilla JS SDK

A lightweight JavaScript SDK for Tunnel messaging.

## Quick Start

```html
<script src="https://cdn.ethers.io/lib/ethers-5.7.umd.min.js"></script>
<script src="tunnel-sdk.js"></script>
```

```javascript
const tunnel = new TunnelSDK(provider, {
  registry: '0x...',
  forwarder: '0x...',
  messages: '0x...'
});

// Create identity
await tunnel.createIdentity(signer);
await tunnel.registerIdentity(signer);

// Create session
await tunnel.createSession(signer);

// Send message
await tunnel.sendMessage('0xRecipient...', 'Hello!');

// Listen for messages
tunnel.onMessage((msg) => {
  console.log('New message:', msg.content);
});
```

## API Reference

### `new TunnelSDK(provider, contractAddresses)`

Create SDK instance.

### `createIdentity(signer)`

Derive ECIES keys from wallet signature.

### `registerIdentity(signer)`

Register public key on-chain.

### `createSession(signer, durationHours)`

Create and authorize session burner.

### `sendMessage(to, content, relayerUrl)`

Send encrypted message via relayer.

### `onMessage(callback)`

Listen for incoming messages.

## Example

Open `example.html` in a browser with MetaMask installed.
