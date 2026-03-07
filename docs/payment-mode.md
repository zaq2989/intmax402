# Payment Mode

Payment mode lets you charge per request using **INTMAX ZK L2 micropayments**. The client sends a real on-chain payment, then proves it by including the transaction ID in the Authorization header. The server verifies the payment on-chain before responding.

Use it for: pay-per-use APIs, AI agent micropayments, content paywalls, resource metering.

---

## How It Works

```
Client                              Server
  │── GET /api/task ─────────────>  │
  │<─ 402 Payment Required ───────  │  nonce = HMAC-SHA256(secret, path + timeWindow)
  │   WWW-Authenticate: INTMAX402   │
  │     nonce="a3f8c2..."           │
  │     mode="payment"              │
  │     serverAddress="0x..."       │  ← where to send payment
  │     amount="1000000"            │  ← in token smallest unit
  │     tokenAddress="0x..."        │
  │                                 │
  │  intmax.transfer(serverAddr,    │
  │    amount, tokenAddress)        │
  │  wallet.signMessage(nonce)      │
  │                                 │
  │── GET /api/task ─────────────>  │
  │   Authorization: INTMAX402      │  verifySignature(nonce, sig) ✓
  │     address="0x..."             │  verifyPayment(txHash, amount, serverAddr) ✓
  │     nonce="a3f8c2..."           │  replayCheck(txHash) ✓
  │     signature="0x..."           │
  │     txHash="0x..."              │
  │<─ 200 OK ──────────────────────  │
```

**Key properties:**
- Gas-free on INTMAX L2 — no ETH needed for transaction fees
- Server verifies the payment via INTMAX SDK, not by trusting the client
- `txHash` is tracked server-side to prevent replay attacks (same payment used twice)
- Nonce is path-bound — a payment for `/api/task` cannot authorize `/api/other`

---

## Testnet Setup

### Prerequisites

1. **Get a testnet wallet** with Sepolia ETH (for INTMAX L2 deposit):
   ```bash
   intmax402 keygen
   # Save the private key
   ```

2. **Get Sepolia ETH** from a faucet:
   - [sepoliafaucet.com](https://sepoliafaucet.com)
   - [alchemy.com/faucets/ethereum-sepolia](https://www.alchemy.com/faucets/ethereum-sepolia)

3. **Deposit to INTMAX L2** (one-time setup):
   - Visit [INTMAX testnet portal](https://testnet.intmax.io) or use the SDK
   - Deposit some test USDC/ETH to your INTMAX L2 address

4. **Get your INTMAX address**:
   ```typescript
   import { IntmaxWalletInfraImpl } from 'intmax2-server-sdk'
   const client = new IntmaxWalletInfraImpl({ ... })
   await client.login()
   console.log(client.address)
   ```

---

## Server Setup

### Install

```bash
npm install @tanakayuto/intmax402-express intmax2-server-sdk
```

### Initialize the payment verifier (one-time at startup)

```typescript
import { initPaymentVerifier, getPaymentVerifierAddress } from '@tanakayuto/intmax402-express'

// Must be called once before starting your server
// This logs in to the INTMAX network (~3-7s)
await initPaymentVerifier({
  eth_private_key: process.env.SERVER_PRIVATE_KEY as `0x${string}`,
  environment: 'testnet',     // or 'mainnet'
  l1_rpc_url: 'https://sepolia.gateway.tenderly.co',
})

const serverAddress = getPaymentVerifierAddress()
console.log('Server INTMAX address:', serverAddress)
```

### Protect endpoints

```typescript
import express from 'express'
import { intmax402, initPaymentVerifier, getPaymentVerifierAddress } from '@tanakayuto/intmax402-express'

async function main() {
  await initPaymentVerifier({
    eth_private_key: process.env.SERVER_PRIVATE_KEY as `0x${string}`,
    environment: 'testnet',
    l1_rpc_url: 'https://sepolia.gateway.tenderly.co',
  })

  const app = express()
  app.use(express.json())

  app.post('/api/analyze', intmax402({
    mode: 'payment',
    secret: process.env.INTMAX402_SECRET!,
    serverAddress: getPaymentVerifierAddress(),
    amount: '1000000',  // 1 USDC (6 decimals)
    // tokenAddress: '0x...'  // optional, defaults to USDC on testnet
  }), (req, res) => {
    res.json({
      result: 'Analysis complete',
      paidBy: req.intmax402?.address,
      txHash: req.intmax402?.txHash,
    })
  })

  app.listen(3761, () => console.log('Payment server on http://localhost:3761'))
}

main().catch(console.error)
```

### Environment variables

```bash
SERVER_PRIVATE_KEY=0x...   # Server's Ethereum private key for INTMAX login
INTMAX402_SECRET=...       # HMAC secret for nonce generation
INTMAX_ENV=testnet         # or mainnet
```

---

## Client Setup

### Initialize with payment support

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

const client = new INTMAX402Client({
  privateKey: process.env.ETH_PRIVATE_KEY!,
  environment: 'testnet',
})

// initPayment sets up INTMAX L2 payment capability (~7s)
await client.initPayment('https://sepolia.gateway.tenderly.co')

console.log('ETH address:', client.getAddress())
console.log('INTMAX address:', client.getIntMaxAddress())
```

### Make payment-gated requests

```typescript
// The client automatically:
//   1. Sends initial request → receives 402 with payment details
//   2. Sends INTMAX transfer to serverAddress
//   3. Signs the nonce
//   4. Retries with Authorization + txHash
const res = await client.fetch('http://localhost:3761/api/analyze', {
  method: 'POST',
  body: JSON.stringify({ query: 'Analyze this data' }),
  headers: { 'Content-Type': 'application/json' },
})

const data = await res.json()
console.log(data)
// → { result: 'Analysis complete', paidBy: '0x...', txHash: '0x...' }
```

---

## Testing on Testnet

### Quick test with CLI

```bash
# Payment mode requires a funded wallet
export ETH_PRIVATE_KEY=0x...  # funded testnet key
intmax402 test http://localhost:3761/api/analyze --mode payment
```

### Running the payment-demo example

```bash
cd examples/payment-demo

# Set up environment
cp .env.example .env
# Edit .env with your keys

# Start server
SERVER_PRIVATE_KEY=0x... INTMAX402_SECRET=dev-secret node dist/server.js

# In another terminal, run client
CLIENT_PRIVATE_KEY=0x... node dist/client.js
```

Expected output:
```
Initializing payment verifier...
Server INTMAX address: 0xABC...

--- Client ---
Initializing client with payment support...
Client address: 0xDEF...

--- Accessing free endpoint ---
Status: 200
Response: {"message":"Free endpoint - no payment required"}

--- Accessing payment-gated endpoint ---
This will automatically send payment and include proof...
Status: 200
Response: {"message":"Payment verified!","paidBy":"0xDEF...","txHash":"0x123..."}
```

---

## Token Addresses (Testnet)

| Token | Sepolia Address |
|---|---|
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| ETH (native) | Use `amount` in wei |

---

## Amount Format

Amounts are specified in the token's smallest unit:

| Token | 1 unit | 1 USDC |
|---|---|---|
| USDC | 0.000001 USDC | `"1000000"` |
| ETH | 1 wei (0.000000000000000001 ETH) | `"1000000000000000000"` |

---

## Replay Protection

Once a `txHash` is verified by the server, it is tracked in an in-memory set for 24 hours. If the same `txHash` is submitted again, the server returns `402 Payment transaction already used`.

> ⚠️ In multi-instance deployments, use a shared cache (Redis) for replay protection. The default in-memory map is not shared across processes.

---

## Security Notes

- **Server must call `initPaymentVerifier()`** at startup — without it, payment verification is disabled
- **Never expose your `SERVER_PRIVATE_KEY`** — it controls your INTMAX wallet
- **Use HTTPS** — the `txHash` and signature are sensitive
- **Set a reasonable `amount`** — too low invites spam; too high discourages legitimate use

For full security model, see [security.md](security.md).
