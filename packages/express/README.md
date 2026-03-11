# @tanakayuto/intmax402-express

Express middleware for [intmax402](https://github.com/zaq2989/intmax402) — wallet-based authentication and INTMAX L2 micropayments for Express apps.

## Install

```bash
npm install @tanakayuto/intmax402-express
```

## Usage

### Identity Mode

Require wallet ownership proof — no payment, no blockchain node needed.

```typescript
import express from 'express'
import { intmax402 } from '@tanakayuto/intmax402-express'

const app = express()

app.use('/protected', intmax402({
  mode: 'identity',
  secret: process.env.INTMAX402_SECRET!,
}))

app.get('/protected', (req, res) => {
  res.json({ message: 'Access granted', address: req.intmax402?.address })
})

app.listen(3000)
```

### Payment Mode

Require an INTMAX L2 transfer before granting access.

```typescript
import express from 'express'
import { intmax402 } from '@tanakayuto/intmax402-express'

const app = express()

app.use('/api/premium', intmax402({
  mode: 'payment',
  secret: process.env.INTMAX402_SECRET!,
  serverAddress: process.env.INTMAX_ADDRESS!,
  amount: '1000000000000000',  // 0.001 ETH in wei
  environment: 'mainnet',
  ethPrivateKey: process.env.ETH_PRIVATE_KEY!,
}))

app.get('/api/premium', (req, res) => {
  res.json({
    message: 'Payment verified!',
    paidBy: req.intmax402?.address,
    txHash: req.intmax402?.txHash,
  })
})

app.listen(3000)
```

## API Reference

### `intmax402(config)`

Returns an Express `RequestHandler` middleware.

On success, populates `req.intmax402`:

```typescript
req.intmax402 = {
  address: string,   // verified Ethereum address
  verified: boolean, // always true
  txHash?: string,   // payment mode only — INTMAX transfer digest
}
```

#### Config Options

| Option | Type | Required | Description |
|---|---|---|---|
| `mode` | `'identity' \| 'payment'` | ✅ | Authentication mode |
| `secret` | `string` | ✅ | HMAC secret for nonce generation (keep private) |
| `serverAddress` | `string` | payment | Your INTMAX L2 address to receive payments |
| `amount` | `string` | payment | Required payment in token smallest unit (wei for ETH) |
| `ethPrivateKey` | `string` | payment† | Ethereum private key — auto-initializes the INTMAX payment verifier (v0.3.1+) |
| `environment` | `'mainnet' \| 'testnet'` | — | Network environment. Default: `'mainnet'` |
| `l1RpcUrl` | `string` | — | Custom L1 RPC URL override |
| `allowList` | `string[]` | — | Identity mode: restrict to specific addresses |
| `bindIp` | `boolean` | — | Bind nonce to client IP. Default `false` (recommended for AI agents) |
| `tokenAddress` | `string` | — | ERC-20 token for payment. Default: native ETH |

†`ethPrivateKey` auto-initializes the payment verifier on first use. If not provided, call `initPaymentVerifier()` manually before handling requests.

#### HTTP Responses

| Scenario | Status | Description |
|---|---|---|
| No `Authorization` header | `401` (identity) / `402` (payment) | Returns `WWW-Authenticate` header with nonce |
| Invalid signature | `401` | Signature verification failed |
| Address not in `allowList` | `403` | Access denied by allowlist |
| Payment not verified | `402` | Transfer not found or amount/recipient mismatch |
| INTMAX network down | `503` | Payment verifier temporarily unavailable |
| Auth verified | calls `next()` | `req.intmax402` is populated |

### Additional Exports

```typescript
import {
  intmax402,
  verifySignature,
  initPaymentVerifier,
  verifyPayment,
  getPaymentVerifierAddress,
} from '@tanakayuto/intmax402-express'
```

#### `initPaymentVerifier(config)`

Manually initialize the INTMAX payment verifier (call once at server startup).

```typescript
import { initPaymentVerifier } from '@tanakayuto/intmax402-express'

await initPaymentVerifier({
  eth_private_key: process.env.ETH_PRIVATE_KEY as `0x${string}`,
  environment: 'mainnet', // or 'testnet'
})
```

#### `verifySignature(signature, nonce, address)`

Low-level utility to verify an Ethereum signature against a nonce.

Returns: `boolean`

## Network

| Environment | Network | Notes |
|---|---|---|
| `mainnet` (default) | Ethereum mainnet + Scroll | Production use |
| `testnet` | Sepolia + Scroll Sepolia | Fund wallet at testnet.intmax.io |

## License

MIT
