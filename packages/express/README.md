# @tanakayuto/intmax402-express

Part of [intmax402](https://github.com/zaq2989/intmax402) — HTTP 402, reimagined for AI agents.

See [main README](https://github.com/zaq2989/intmax402) for full documentation.

## Network

intmax402 operates on **Ethereum mainnet** by default (via INTMAX ZK L2 on Scroll). Use `environment: "testnet"` for development against Sepolia.

```typescript
// Payment verification — mainnet (default)
await initPaymentVerifier({
  eth_private_key: process.env.ETH_PRIVATE_KEY as `0x${string}`,
  environment: 'mainnet',
})

// Payment verification — testnet (development)
await initPaymentVerifier({
  eth_private_key: process.env.ETH_PRIVATE_KEY as `0x${string}`,
  environment: 'testnet',
})
```
