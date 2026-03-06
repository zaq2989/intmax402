# intmax402

> HTTP 402, reimagined for AI agents.

A stateless HTTP payment gating protocol powered by [INTMAX](https://intmax.io) ZK L2. Inspired by [XMR402](https://github.com/KYC-rip/xmr402-org).

## Why?

| | API Keys | JWT | XMR402 | **intmax402** |
|---|---|---|---|---|
| Wallet-native | ❌ | ❌ | ✅ | ✅ |
| Stateless | △ | ✅ | ✅ | ✅ |
| Micropayments | ❌ | ❌ | ✅ | ✅ |
| Node required | ❌ | ❌ | ✅ | **❌** |
| EVM compatible | ❌ | ❌ | ❌ | **✅** |
| Auth latency | <1ms | <1ms | 50-200ms | **10ms** |

## Benchmark

```
sign_message:    4ms  (client-side)
verify_signature: 6ms  (server-side)
─────────────────────────────────
Total auth cost: ~10ms
```

## How It Works

```
Client                              Server
  │                                    │
  ├─── GET /resource ───────────────>  │
  │                                    │ generate nonce
  │<── HTTP 402 ─────────────────────  │
  │    WWW-Authenticate: INTMAX402     │
  │      nonce="abc123..."             │
  │      mode="identity"               │
  │      [amount="1.00", address="..."]│  ← payment mode only
  │                                    │
  │  [client: signMessage(nonce)]      │
  │                                    │
  ├─── GET /resource ───────────────>  │
  │    Authorization: INTMAX402        │
  │      address="..."                 │
  │      nonce="abc123..."             │
  │      signature="..."               │
  │                                    │
  │                                    │ verifySignature(sig, nonce)
  │<── HTTP 200 OK ─────────────────   │
```

## Packages

| Package | Description |
|---|---|
| `@intmax402/core` | Protocol types, nonce generation, verification |
| `@intmax402/express` | Express middleware |
| `@intmax402/client` | Client SDK with auto-retry |
| `@intmax402/cli` | CLI testing tool |

## Quick Start

### Server

```typescript
import express from 'express'
import { intmax402 } from '@intmax402/express'

const app = express()

// Identity mode - prove wallet ownership
app.get('/premium', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET!,
}), (req, res) => {
  res.json({ message: 'Access granted', address: req.intmax402?.address })
})

// Payment mode - pay per request
app.post('/api/task', intmax402({
  mode: 'payment',
  secret: process.env.INTMAX402_SECRET!,
  serverAddress: process.env.INTMAX_ADDRESS!,
  amount: 1_000_000, // $1.00 USDC
}), taskHandler)
```

### Client

```typescript
import { INTMAX402Client } from '@intmax402/client'

const client = new INTMAX402Client({
  privateKey: process.env.ETH_PRIVATE_KEY!,
  environment: 'mainnet',
})

await client.init() // ~7s one-time login

// Auto-handles 402 responses
const response = await client.fetch('https://api.example.com/premium')
```

## Modes

- **`identity`** – Prove INTMAX wallet ownership (no payment, just signature)
- **`payment`** – Sign + broadcast INTMAX transfer, server verifies receipt

## URI Schema

```
intmax402://<address>?amount=<usdc>&nonce=<nonce>&callback=<url>
```

## Nonce Design (Stateless, Replay-Protected)

```
nonce = HMAC-SHA256(
  server_secret,
  client_ip + url_path + floor(timestamp / 30_000)
)
```

30-second time windows. No database required.

## License

MIT
