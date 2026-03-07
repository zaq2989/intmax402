# Getting Started with intmax402

This guide walks you from installation to your first protected API endpoint in under 5 minutes.

## Prerequisites

- Node.js 18+
- npm / pnpm / yarn
- An Ethereum private key (or generate one with the CLI)

---

## Step 1: Install

### Server-side

```bash
# Express (recommended)
npm install @tanakayuto/intmax402-express

# Hono / edge runtimes
npm install @tanakayuto/intmax402-hono
```

### Client-side (AI agent / consumer)

```bash
npm install @tanakayuto/intmax402-client
```

### CLI (testing & debugging)

```bash
npm install -g @tanakayuto/intmax402-cli
```

---

## Step 2: Generate a test wallet

```bash
intmax402 keygen
```

Output:
```
Generated wallet
  Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
  Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

Add to .env:
  ETH_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

> ⚠️ Never use this key with real funds. It's for local testing only.

---

## Step 3: Create a server

Create `server.ts`:

```typescript
import express from 'express'
import { intmax402 } from '@tanakayuto/intmax402-express'

const app = express()

// Free endpoint
app.get('/free', (_req, res) => {
  res.json({ message: 'Anyone can access this' })
})

// Protected endpoint (identity mode)
app.get('/premium', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET || 'dev-secret-change-in-prod',
}), (req, res) => {
  res.json({
    message: 'Access granted!',
    address: req.intmax402?.address,
  })
})

app.listen(3000, () => console.log('Server running on http://localhost:3000'))
```

Start it:
```bash
node server.js
# or: ts-node server.ts
```

---

## Step 4: Test with the CLI

```bash
intmax402 test http://localhost:3000/premium
```

Expected output:
```
Testing: http://localhost:3000/premium
  ① GET /premium → 401
  ② nonce: a3f8c2d1... (30s window)
  ③ Signing with wallet: 0xf39F...
  ④ GET /premium + Authorization → 200 ✅

Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Time: 12ms
```

---

## Step 5: Use the client SDK

Create `client.ts`:

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

async function main() {
  const client = new INTMAX402Client({
    privateKey: process.env.ETH_PRIVATE_KEY!,
    environment: 'testnet',
  })

  // Initialize (required before making requests)
  await client.init()
  console.log('Address:', client.getAddress())

  // This automatically handles:
  //   1. GET /premium → receives 401
  //   2. Signs the nonce
  //   3. Retries with Authorization header
  //   4. Returns 200 response
  const res = await client.fetch('http://localhost:3000/premium')
  const data = await res.json()
  console.log(data)
  // → { message: 'Access granted!', address: '0x...' }
}

main().catch(console.error)
```

---

## Next Steps

- **Identity Mode details** → [docs/identity-mode.md](identity-mode.md)
- **Payment Mode (pay per request)** → [docs/payment-mode.md](payment-mode.md)
- **Security model** → [docs/security.md](security.md)
- **Examples** → [`examples/`](../examples/)

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `INTMAX402_SECRET` | ✅ Server | HMAC secret for nonce generation. Use a 32+ byte random string in production. |
| `ETH_PRIVATE_KEY` | ✅ Client | Ethereum private key for signing (`0x...` format) |
| `SERVER_PRIVATE_KEY` | Payment server | INTMAX private key for receiving payments |
| `INTMAX_ENV` | Optional | `"testnet"` (default) or `"mainnet"` |

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
