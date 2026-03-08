# @tanakayuto/intmax402-client

Part of [intmax402](https://github.com/zaq2989/intmax402) — HTTP 402, reimagined for AI agents.

See [main README](https://github.com/zaq2989/intmax402) for full documentation.

## Network

By default, the client connects to **Ethereum mainnet** via INTMAX ZK L2 (Scroll).

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

// Mainnet (default)
const client = new INTMAX402Client({ privateKey: process.env.ETH_PRIVATE_KEY! })

// Testnet (for development)
const testClient = new INTMAX402Client({
  privateKey: process.env.ETH_PRIVATE_KEY!,
  environment: 'testnet',
})
```

| Environment | Network | RPC |
|---|---|---|
| `mainnet` (default) | Ethereum mainnet + Scroll | `https://api.rpc.intmax.io?network=ethereum` |
| `testnet` | Sepolia + Scroll Sepolia | `https://sepolia.gateway.tenderly.co` |
