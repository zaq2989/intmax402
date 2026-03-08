# @tanakayuto/intmax402-hono

[Hono](https://hono.dev/) middleware for the INTMAX402 protocol — HTTP 402 Payment Required / identity verification via INTMAX zkRollup.

## Features

- 🦄 **Hono-native** — typed middleware with `MiddlewareHandler<Env>`
- ⚡ **Edge-ready** — works on Cloudflare Workers, Deno Deploy, Bun, and Node.js
- 🔐 **Identity & Payment modes** — same config as Express adapter
- 🧠 **AI-agent friendly** — designed for autonomous agent-to-agent payments

## Installation

```bash
npm install @tanakayuto/intmax402-hono hono
```

## Usage

```typescript
import { Hono } from "hono"
import { intmax402, Intmax402Env } from "@tanakayuto/intmax402-hono"

const app = new Hono<Intmax402Env>()

// Free route
app.get("/free", (c) => c.json({ message: "free access" }))

// Identity-gated route
app.get(
  "/premium",
  intmax402({ mode: "identity", secret: process.env.INTMAX402_SECRET! }),
  (c) => c.json({
    message: "verified",
    address: c.get("intmax402").address,
  })
)

// Payment-gated route
app.get(
  "/paid",
  intmax402({
    mode: "payment",
    secret: process.env.INTMAX402_SECRET!,
    serverAddress: process.env.SERVER_ADDRESS!,
    amount: "1.0",
    chainId: 137,
  }),
  (c) => c.json({ message: "paid content" })
)

export default app
```

## Hono vs Express

| Feature | Express | Hono |
|---|---|---|
| Runtime | Node.js only | Node / Workers / Deno / Bun |
| Typing | `req.intmax402` (augmented) | `c.get("intmax402")` (typed via `Env`) |
| Edge support | ❌ | ✅ Cloudflare Workers ready |
| Bundle size | Heavy | Ultralight |

### Typed Context

Hono uses a generic `Env` type for context variables. Import `Intmax402Env` and pass it to your `Hono` instance:

```typescript
import { Intmax402Env } from "@tanakayuto/intmax402-hono"

const app = new Hono<Intmax402Env>()
```

After a successful auth middleware call, `c.get("intmax402")` returns:

```typescript
{
  address: string   // verified Ethereum address
  verified: boolean // always true if middleware passed
  txHash?: string   // present in payment mode
}
```

## Cloudflare Workers

No changes needed for Workers — Hono's fetch handler works natively:

```typescript
// worker.ts
export default app
```

## Network

intmax402-hono operates on **Ethereum mainnet** by default (via INTMAX ZK L2 on Scroll). Use `environment: "testnet"` for development.

| Environment | Network | L1 Chain ID |
|---|---|---|
| `mainnet` (default) | Ethereum + Scroll | `1` |
| `testnet` | Sepolia + Scroll Sepolia | `11155111` |

## License

MIT

## ⚠️ IP Binding Warning
When using `bindIp: true`, ensure your server is behind a trusted reverse proxy (Nginx, Cloudflare, etc.).
Direct exposure allows attackers to forge `X-Forwarded-For` headers, bypassing IP binding.
Default (`bindIp: false`) is recommended for AI agent use cases.
