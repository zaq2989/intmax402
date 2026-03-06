# intmax402

> HTTP 402, reimagined for AI agents.

A stateless HTTP payment gating protocol powered by [INTMAX](https://intmax.io) ZK L2. Inspired by [XMR402](https://github.com/KYC-rip/xmr402-org).

**Benchmark:** sign=4ms, verify=6ms → **10ms total auth** (vs. XMR402's 50-200ms)

## Status

| Version | Feature | Status |
|---|---|---|
| **v1.0** | Identity mode (wallet ownership proof) | ✅ **Implemented** |
| v1.1 | Payment mode (INTMAX transfer verification) | 🔜 Planned |
| v2.0 | ZK proof mode | 🔜 Planned |

> **v1.0 scope:** `identity` mode is fully implemented and production-ready.
> `payment` mode parses the Authorization header but **does not yet verify on-chain transfers** via `intmax2-server-sdk`. Contributions welcome.

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

// Identity mode — prove INTMAX wallet ownership
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

// Auto-handles 401 → sign → retry in one call
const response = await client.fetch('https://your-api.com/premium')
const data = await response.json()
```

## How It Works

```
Client                         Server
  │── GET /resource ─────────>  │
  │<─ 401 + WWW-Authenticate ─  │  nonce = HMAC-SHA256(secret, path + timeWindow)
  │                              │
  │  wallet.signMessage(nonce)   │
  │                              │
  │── GET + Authorization ────>  │
  │   INTMAX402 address="..."    │  ethers.verifyMessage(nonce, sig) == address?
  │            nonce="..."       │
  │            signature="..."   │
  │<─ 200 OK ─────────────────   │
```

**Nonce design (stateless, replay-protected):**
```
nonce = HMAC-SHA256(server_secret, url_path + floor(timestamp / 30_000))
```
30-second time windows. No database. No sessions.

## Modes

### `identity` — Wallet Ownership Proof ✅

Prove you control an INTMAX wallet. No payment required.

```typescript
intmax402({ mode: 'identity', secret: process.env.SECRET! })
```

Use cases: premium API access, rate limiting by wallet, allowlists.

### `payment` — Pay Per Request 🔜 (v1.1)

Sign + broadcast an INTMAX transfer, server verifies the receipt.

```typescript
// Coming in v1.1
intmax402({
  mode: 'payment',
  secret: process.env.SECRET!,
  serverAddress: process.env.INTMAX_ADDRESS!,
  amount: '1000000', // $1.00 USDC
})
```

## Packages

| Package | Description |
|---|---|
| [`@tanakayuto/intmax402-core`](https://www.npmjs.com/package/@tanakayuto/intmax402-core) | Protocol types, nonce generation, verification |
| [`@tanakayuto/intmax402-express`](https://www.npmjs.com/package/@tanakayuto/intmax402-express) | Express middleware |
| [`@tanakayuto/intmax402-client`](https://www.npmjs.com/package/@tanakawuto/intmax402-client) | Client SDK with auto-retry |
| [`@tanakayuto/intmax402-cli`](https://www.npmjs.com/package/@tanakayuto/intmax402-cli) | CLI testing tool |

## Why INTMAX?

| | API Keys | JWT | XMR402 | **intmax402** |
|---|---|---|---|---|
| Wallet-native | ❌ | ❌ | ✅ | ✅ |
| Stateless | △ | ✅ | ✅ | ✅ |
| No node required | ❌ | ❌ | ❌ | ✅ |
| EVM compatible | ❌ | ❌ | ❌ | ✅ |
| Auth latency | ~1ms | ~1ms | 50-200ms | **~10ms** |
| AI agent friendly | △ | △ | △ | ✅ |

## Contributing

Payment mode (`v1.1`) needs `intmax2-server-sdk` integration to verify on-chain transfers.
See [`packages/express/src/middleware.ts`](packages/express/src/middleware.ts) — the hook is already there.

PRs welcome.

## License

MIT
