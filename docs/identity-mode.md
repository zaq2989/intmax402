# Identity Mode

Identity mode lets you gate API access behind **wallet ownership proof**. The client proves they control a specific Ethereum address by signing a server-issued nonce — no payment required.

Use it for: premium access tiers, rate limiting by wallet, allowlists, AI agent authentication.

---

## How It Works

```
Client                              Server
  │── GET /premium ──────────────>   │
  │<─ 401 Unauthorized ────────────  │  nonce = HMAC-SHA256(secret, path + timeWindow)
  │   WWW-Authenticate: INTMAX402    │
  │     nonce="a3f8c2..."            │
  │     mode="identity"              │
  │                                  │
  │  wallet.signMessage(nonce)       │
  │                                  │
  │── GET /premium ──────────────>   │
  │   Authorization: INTMAX402       │  recoverAddress(nonce, signature) === address?
  │     address="0x..."              │
  │     nonce="a3f8c2..."            │
  │     signature="0x..."            │
  │<─ 200 OK ──────────────────────  │
```

**Key properties:**
- The server never stores any state — nonces are HMAC-derived from time windows
- The signature proves private key ownership without revealing it
- Nonces expire every 30 seconds (with 1-window grace period = ~60s total)
- No IP binding — works with proxies, VPNs, and AI agent deployments

---

## Server Setup

### Express

```typescript
import express from 'express'
import { intmax402 } from '@tanakayuto/intmax402-express'

const app = express()

app.get('/premium', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET!,
}), (req, res) => {
  // req.intmax402.address is the verified wallet address
  res.json({ address: req.intmax402?.address })
})
```

### With allowList (whitelist specific addresses)

```typescript
app.get('/vip', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET!,
  allowList: [
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  ],
}), (req, res) => {
  res.json({ message: 'Welcome, VIP!', address: req.intmax402?.address })
})
```

> 📝 `allowList` addresses are normalized to lowercase automatically (case-insensitive).

### Hono (edge-compatible)

```typescript
import { Hono } from 'hono'
import { intmax402, Intmax402Env } from '@tanakayuto/intmax402-hono'

const app = new Hono<Intmax402Env>()

app.get('/premium',
  intmax402({ mode: 'identity', secret: process.env.INTMAX402_SECRET! }),
  (c) => c.json({ address: c.get('intmax402').address })
)
```

### Middleware Options

```typescript
interface Intmax402Options {
  mode: 'identity' | 'payment'
  secret: string          // HMAC secret for nonce generation
  allowList?: string[]    // Optional: restrict to specific addresses
  // Payment mode only:
  serverAddress?: string
  amount?: string
  tokenAddress?: string
}
```

---

## Client Setup

### Using `@tanakayuto/intmax402-client`

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

const client = new INTMAX402Client({
  privateKey: process.env.ETH_PRIVATE_KEY!,
  environment: 'testnet', // or 'mainnet'
})

await client.init() // Sets up signing capability

// Automatically handles 401 challenge-response
const res = await client.fetch('https://api.example.com/premium')
```

### Manual flow (any HTTP client)

If you need to integrate with a custom client:

```typescript
import { ethers } from 'ethers'

const wallet = new ethers.Wallet(privateKey)

// Step 1: Get the challenge
const challengeRes = await fetch('https://api.example.com/premium')
// → 401 with WWW-Authenticate header

// Step 2: Parse the nonce
const wwwAuth = challengeRes.headers.get('WWW-Authenticate')
const nonce = wwwAuth.match(/nonce="([^"]+)"/)?.[1]

// Step 3: Sign the nonce
const signature = await wallet.signMessage(nonce)

// Step 4: Retry with Authorization
const res = await fetch('https://api.example.com/premium', {
  headers: {
    Authorization: `INTMAX402 address="${wallet.address}", nonce="${nonce}", signature="${signature}"`,
  },
})
```

---

## Testing

### CLI

```bash
# Quick test (uses a randomly generated wallet)
intmax402 test https://api.example.com/premium

# Test with a specific private key
ETH_PRIVATE_KEY=0x... intmax402 test https://api.example.com/premium

# Verbose output
intmax402 test https://api.example.com/premium --verbose
```

### curl (manual)

```bash
# Step 1: Get challenge
curl -v https://api.example.com/premium
# → Look for WWW-Authenticate header with nonce="..."

# Step 2: Sign nonce with ethers.js, then:
curl -H 'Authorization: INTMAX402 address="0x...", nonce="...", signature="0x..."' \
  https://api.example.com/premium
```

---

## Security Notes

- **Always use HTTPS** in production — the protocol relies on TLS for confidentiality
- **Rotate your secret** periodically (e.g., monthly); old nonces automatically expire
- **allowList addresses** — verify these are correct before deploying (checksummed or lowercase both work)
- The nonce includes the request path, so a signature for `/premium` cannot be used on `/admin`

For full security model details, see [security.md](security.md).
