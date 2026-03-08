# intmax402

[![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-core?label=core&color=blue)](https://www.npmjs.com/package/@tanakayuto/intmax402-core)
[![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-express?label=express&color=blue)](https://www.npmjs.com/package/@tanakayuto/intmax402-express)
[![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-client?label=client&color=blue)](https://www.npmjs.com/package/@tanakayuto/intmax402-client)
[![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-cli?label=cli&color=blue)](https://www.npmjs.com/package/@tanakayuto/intmax402-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> HTTP 402, reimagined for AI agents — powered by [INTMAX](https://intmax.io) ZK L2.

A stateless HTTP authentication & micropayment protocol. Prove wallet ownership or send gas-free payments in **~10ms**, with no blockchain node required. Designed for AI agent-to-agent payments, API monetization, and privacy-preserving access control.

**Works on Ethereum mainnet** (via INTMAX ZK L2 on Scroll). Testnet (Sepolia + Scroll Sepolia) is also supported for development.

**Benchmark:** sign=4ms, verify=6ms → **10ms total** (vs. XMR402's 50-200ms)

---

## Why INTMAX402?

| | API Keys | JWT | XMR402 | **intmax402** |
|---|---|---|---|---|
| Wallet-native | ❌ | ❌ | ✅ | ✅ |
| Stateless (no DB) | △ | ✅ | ✅ | ✅ |
| No node required | ❌ | ❌ | ❌ | ✅ |
| Gas-free payments | ❌ | ❌ | ❌ | ✅ |
| Privacy (ZK) | ❌ | ❌ | △ | ✅ |
| EVM compatible | ❌ | ❌ | ❌ | ✅ |
| Auth latency | ~1ms | ~1ms | 50-200ms | **~10ms** |
| AI agent friendly | △ | △ | △ | ✅ |
| Micropayments | ❌ | ❌ | ✅ | ✅ |

**INTMAX ZK L2 advantages:**
- 🆓 **Gas-free** — transactions cost nothing on the L2 layer
- 🔒 **Privacy** — zero-knowledge proofs hide transaction details
- 🤖 **AI agent native** — no IP binding, no sessions, works anywhere
- ⚡ **Fast** — sub-second payment verification without polling

---

## Quick Start (5 minutes)

### 1. Install

```bash
# Server
npm install @tanakayuto/intmax402-express

# Client (AI agent)
npm install @tanakayuto/intmax402-client

# CLI (testing)
npm install -g @tanakayuto/intmax402-cli
```

### 2. Server — Protect an endpoint

```typescript
import express from 'express'
import { intmax402 } from '@tanakayuto/intmax402-express'

const app = express()

// Identity mode: prove wallet ownership (no payment)
app.get('/premium', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET!,
  allowList: ['0xYourTrustedAddress'],  // optional
}), (req, res) => {
  res.json({ message: 'Access granted', address: req.intmax402?.address })
})

app.listen(3000)
```

### 3. Client — Auto-authenticate

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

// Defaults to mainnet (Ethereum mainnet + Scroll)
const client = new INTMAX402Client({ privateKey: process.env.ETH_PRIVATE_KEY! })
await client.init()

// Automatically handles 401 → sign → retry
const res = await client.fetch('http://localhost:3000/premium')
const data = await res.json()
console.log(data) // { message: 'Access granted', address: '0x...' }
```

### 4. Test instantly with the CLI

```bash
# Generate a test wallet
intmax402 keygen

# Test any intmax402-protected endpoint
intmax402 test http://localhost:3000/premium
```

```
Testing: http://localhost:3000/premium
  ① GET /premium → 401
  ② nonce: a3f8c2... (30s window)
  ③ Signing with wallet: 0xf39F...
  ④ GET /premium + Authorization → 200 ✅

Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Time: 12ms
```

---

## Packages

| Package | Description | Version |
|---|---|---|
| [`@tanakayuto/intmax402-core`](https://www.npmjs.com/package/@tanakayuto/intmax402-core) | Protocol types, nonce generation, signature verification | ![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-core) |
| [`@tanakayuto/intmax402-express`](https://www.npmjs.com/package/@tanakayuto/intmax402-express) | Express middleware (identity + payment modes) | ![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-express) |
| [`@tanakayuto/intmax402-client`](https://www.npmjs.com/package/@tanakayuto/intmax402-client) | Client SDK with auto-retry and INTMAX payment support | ![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-client) |
| [`@tanakayuto/intmax402-cli`](https://www.npmjs.com/package/@tanakayuto/intmax402-cli) | CLI tool — test any endpoint instantly | ![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-cli) |
| [`@tanakayuto/intmax402-fetch`](https://www.npmjs.com/package/@tanakayuto/intmax402-fetch) | Fetch API adapter (Cloudflare Workers, Deno, Edge) | ![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-fetch) |
| [`@tanakayuto/intmax402-hono`](https://www.npmjs.com/package/@tanakayuto/intmax402-hono) | Hono middleware (edge-compatible) | ![npm](https://img.shields.io/npm/v/@tanakayuto/intmax402-hono) |
| `intmax402-nextjs` _(coming soon)_ | Next.js middleware + App Router support | 🔜 |

---

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
  │     [txHash="..."]          │  ← payment only
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

---

## Use Cases

### 🤖 AI Agent-to-Agent Payments
AI agents can autonomously pay for services without human intervention. No API keys to manage, no billing accounts — just wallet-based micropayments.

```typescript
// Agent A pays Agent B per task
const result = await client.fetch('https://agent-b.example.com/analyze', {
  method: 'POST',
  body: JSON.stringify({ data: '...' }),
})
```

### 💰 API Monetization
Charge per request without managing subscriptions. Set any amount in USDC with 6 decimal precision.

```typescript
app.post('/api/gpt-task', intmax402({
  mode: 'payment',
  secret: process.env.INTMAX402_SECRET!,
  serverAddress: process.env.INTMAX_ADDRESS!,
  amount: '1000000', // 1 USDC
}), taskHandler)
```

### 🔒 Content Paywalls
Gate content behind wallet ownership. Only verified holders of specific addresses can access.

```typescript
app.get('/exclusive', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET!,
  allowList: ['0xVIP1', '0xVIP2', '0xVIP3'],
}), contentHandler)
```

---

## Examples

| Example | Description |
|---|---|
| [`examples/basic-express/`](examples/basic-express/) | Identity mode server — simplest possible setup |
| [`examples/payment-demo/`](examples/payment-demo/) | Payment mode server + client (mainnet by default, testnet for dev) |
| [`examples/agent-to-agent/`](examples/agent-to-agent/) | AI agent calling AI agent (self-contained demo) |
| [`examples/hono-example/`](examples/hono-example/) | Hono framework (edge-compatible) |

---

## Documentation

| Doc | Description |
|---|---|
| [Getting Started](docs/getting-started.md) | Installation to first API call |
| [Identity Mode](docs/identity-mode.md) | Wallet ownership proof |
| [Payment Mode](docs/payment-mode.md) | INTMAX micropayments + testnet guide |
| [Security](docs/security.md) | Security model and implemented measures |
| [FAQ](docs/faq.md) | Common questions and troubleshooting |

---

## Roadmap

| Version | Feature | Status |
|---|---|---|
| **v0.1.x** | Identity mode (wallet ownership proof) | ✅ Done |
| **v0.2.x** | Payment mode (INTMAX transfer verification) | ✅ Done |
| **v0.2.x** | Hono + Fetch adapter (edge runtime) | ✅ Done |
| **v0.3.x** | CLI improvements + keygen | ✅ Done |
| **v0.3.x** | Ethereum mainnet support (default) | ✅ Done |
| **v0.x** | Next.js middleware + App Router support | 🔜 In progress |
| **v1.0** | Stable API, full test coverage | 🔜 Planned |
| **v2.0** | ZK proof mode (full privacy) | 🔜 Planned |

---

## Contributing

Pull requests welcome. Please:
1. Fork and create a feature branch
2. Run `pnpm build` and `pnpm test` before submitting
3. Follow the existing code style (TypeScript strict mode)
4. Update relevant docs

```bash
git clone https://github.com/zaq2989/intmax402
cd intmax402
pnpm install
pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details (coming soon).

---

## License

MIT — see [LICENSE](LICENSE) for details.

Inspired by [XMR402](https://github.com/KYC-rip/xmr402-org).
