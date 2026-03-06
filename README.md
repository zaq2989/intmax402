# intmax402

> HTTP 402, reimagined for AI agents.

A stateless HTTP payment gating protocol powered by [INTMAX](https://intmax.io) ZK L2. Inspired by [XMR402](https://github.com/KYC-rip/xmr402-org).

**Benchmark:** sign=4ms, verify=6ms → **10ms total auth** (vs. XMR402's 50-200ms)

## Status

| Version | Feature | Status |
|---|---|---|
| **v0.2.0** | Payment mode (INTMAX transfer verification) | ✅ **Implemented** |
| **v0.1.x** | Identity mode (wallet ownership proof) | ✅ **Implemented** |
| v2.0 | ZK proof mode | 🔜 Planned |

## Try It Now

```bash
# Test any intmax402-protected endpoint instantly
npx @tanakayuto/intmax402-cli test https://your-api.com/premium

# Generate a test wallet
npx @tanakayuto/intmax402-cli keygen
```

## Install

```bash
# Server
npm install @tanakayuto/intmax402-express

# Client (AI agent)
npm install @tanakayuto/intmax402-client

# CLI (testing / debugging)
npm install -g @tanakayuto/intmax402-cli
```

## Quick Start

### Identity Mode — Prove Wallet Ownership

No payment required. Just prove you control an INTMAX wallet.

```typescript
// Server
import express from 'express'
import { intmax402 } from '@tanakayuto/intmax402-express'

const app = express()

app.get('/premium', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET!,
}), (req, res) => {
  res.json({ message: 'Access granted', address: req.intmax402?.address })
})
```

```typescript
// Client (AI agent)
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

const client = new INTMAX402Client({ privateKey: process.env.ETH_PRIVATE_KEY! })
await client.init()

// Auto-handles 401 → sign → retry
const res = await client.fetch('https://your-api.com/premium')
```

### Payment Mode — Pay Per Request

Sign + broadcast an INTMAX transfer. Server verifies the receipt on-chain.

```typescript
// Server
app.post('/api/task', intmax402({
  mode: 'payment',
  secret: process.env.INTMAX402_SECRET!,
  serverAddress: process.env.INTMAX_ADDRESS!,
  amount: '1000000', // 1 USDC (6 decimals)
}), taskHandler)
```

```typescript
// Client (AI agent)
const client = new INTMAX402Client({ privateKey: process.env.ETH_PRIVATE_KEY! })
await client.init() // ~7s one-time INTMAX login

// Auto-handles 402 → transfer → sign → retry
const res = await client.fetchWithPayment('https://your-api.com/api/task', {
  method: 'POST',
  body: JSON.stringify({ prompt: 'Analyze this dataset' }),
})
```

## How It Works

```
Client                         Server
  │── GET /resource ─────────>  │
  │<─ 401/402 ────────────────  │  nonce = HMAC-SHA256(secret, path + timeWindow)
  │   WWW-Authenticate:         │
  │     INTMAX402               │
  │     nonce="..."             │
  │     mode="identity|payment" │
  │     [serverAddress="..."]   │  ← payment only
  │     [amount="..."]          │  ← payment only
  │                             │
  │  [identity] signMessage()   │
  │  [payment]  transfer()      │
  │             signMessage()   │
  │                             │
  │── GET + Authorization ────> │
  │   INTMAX402                 │  verifySignature() + [verifyPayment()]
  │     address="..."           │
  │     nonce="..."             │
  │     signature="..."         │
  │     [tx_id="..."]           │  ← payment only
  │<─ 200 OK ─────────────────  │
```

**Nonce design — stateless, replay-protected:**
```
nonce = HMAC-SHA256(server_secret, url_path + floor(timestamp / 30_000))
```
30-second time windows. No database. No sessions. AI-agent friendly (no IP binding).

## Modes

| Mode | HTTP Status | Use case |
|---|---|---|
| `identity` | 401 | Premium access, rate limiting by wallet, allowlists |
| `payment` | 402 | Pay-per-use API, AI agent micropayments |

## CLI

```bash
# Test an endpoint (identity mode)
intmax402 test https://api.example.com/premium

# Test payment mode
intmax402 test https://api.example.com/paid --mode payment

# Generate a test wallet
intmax402 keygen
```

```
$ intmax402 test http://localhost:3000/premium

Testing: http://localhost:3000/premium
  ① GET /premium → 401
  ② nonce: a3f8c2... (30s window)
  ③ Signing with wallet: 0xf39F...
  ④ GET /premium + Authorization → 200 ✅

Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Time: 12ms
```

## Packages

| Package | Description |
|---|---|
| [`@tanakayuto/intmax402-core`](https://www.npmjs.com/package/@tanakayuto/intmax402-core) | Protocol types, nonce generation, verification |
| [`@tanakayuto/intmax402-express`](https://www.npmjs.com/package/@tanakayuto/intmax402-express) | Express middleware |
| [`@tanakayuto/intmax402-client`](https://www.npmjs.com/package/@tanakayuto/intmax402-client) | Client SDK with auto-retry |
| [`@tanakayuto/intmax402-cli`](https://www.npmjs.com/package/@tanakayuto/intmax402-cli) | CLI — test any endpoint instantly |

## Why INTMAX?

| | API Keys | JWT | XMR402 | **intmax402** |
|---|---|---|---|---|
| Wallet-native | ❌ | ❌ | ✅ | ✅ |
| Stateless | △ | ✅ | ✅ | ✅ |
| No node required | ❌ | ❌ | ❌ | ✅ |
| EVM compatible | ❌ | ❌ | ❌ | ✅ |
| Auth latency | ~1ms | ~1ms | 50-200ms | **~10ms** |
| AI agent friendly | △ | △ | △ | ✅ |
| Micropayments | ❌ | ❌ | ✅ | ✅ |

## Examples

- [`examples/basic-express/`](examples/basic-express/) — Identity mode server
- [`examples/payment-demo/`](examples/payment-demo/) — Payment mode server + client
- [`examples/agent-to-agent/`](examples/agent-to-agent/) — AI agent calling AI agent

## License

MIT
