# intmax402

> HTTP 402, reimagined for AI agents.

A stateless HTTP payment gating protocol powered by [INTMAX](https://intmax.io) ZK L2. Inspired by [XMR402](https://github.com/KYC-rip/xmr402-org).

**Benchmark:** sign=4ms, verify=6ms → **10ms total auth** (20x faster than XMR402)

## Install

```bash
# Server
npm install @tanakayuto/intmax402-express

# Client (AI agent)
npm install @tanakayuto/intmax402-client
```

## Quick Start

### Server (Express)

```typescript
import express from 'express'
import { intmax402 } from '@tanakayuto/intmax402-express'

const app = express()

app.get('/premium', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET!,
}), (req, res) => {
  res.json({ message: 'Access granted', address: req.intmax402?.address })
})

app.listen(3000)
```

### Client (AI Agent)

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

const client = new INTMAX402Client({
  privateKey: process.env.ETH_PRIVATE_KEY!,
  environment: 'mainnet',
})
await client.init()

// Auto-handles 402 → sign → retry
const response = await client.fetch('https://your-api.com/premium')
```

## How It Works

```
Client                    Server
  │── GET /resource ────>  │
  │<─ 402 + nonce ───────  │  (HMAC-SHA256, 30s window)
  │  [signMessage(nonce)]  │
  │── GET + signature ──>  │
  │                        │  verifySignature(sig, nonce, address)
  │<─ 200 OK ────────────  │
```

## Modes

| Mode | Description | Use case |
|---|---|---|
| `identity` | Prove wallet ownership, no payment | Rate limiting, premium access |
| `payment` | Sign + INTMAX transfer | Pay-per-use API |

## Packages

| Package | npm |
|---|---|
| `@tanakayuto/intmax402-core` | Protocol, nonce, verification |
| `@tanakayuto/intmax402-express` | Express middleware |
| `@tanakayuto/intmax402-client` | Client SDK |
| `@tanakayuto/intmax402-cli` | CLI testing tool |

## Why INTMAX?

- **No full node required** — unlike XMR402
- **EVM compatible** — standard Ethereum wallets
- **10ms auth** — sign + verify in milliseconds
- **ZK privacy** — INTMAX ZK L2

## License

MIT
