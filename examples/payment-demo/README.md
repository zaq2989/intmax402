# Payment Demo

Demonstrates intmax402 **payment mode** — a full pay-per-request flow using INTMAX ZK L2.

The server requires a real INTMAX testnet payment before serving the protected endpoint. The client automatically sends the payment and includes proof in the Authorization header.

## What This Demo Shows

- Server initializes INTMAX L2 login at startup (`initPaymentVerifier`)
- `GET /free` — accessible without authentication
- `GET /premium` — requires payment of 1000 token units (INTMAX testnet)
- Client (`client.ts`) automatically handles the full payment flow:
  1. GET /premium → 402 with payment details
  2. Send INTMAX transfer to server's address
  3. Retry with Authorization + txHash
  4. Receive 200 with result

## Prerequisites

- Funded INTMAX testnet wallet (Sepolia ETH + some USDC on INTMAX L2)
- See [Payment Mode Guide](../../docs/payment-mode.md) for testnet setup

## Setup

```bash
# From the monorepo root:
pnpm install
pnpm build
```

## Environment Variables

```bash
# Server
SERVER_PRIVATE_KEY=0x...    # Ethereum private key for INTMAX server login
INTMAX402_SECRET=my-secret  # HMAC secret for nonce generation
PORT=3761                   # (optional, default: 3761)

# Client
CLIENT_PRIVATE_KEY=0x...    # Ethereum private key for client payments
SERVER_URL=http://localhost:3761  # (optional)
```

## Run

### Terminal 1 — Start the server

```bash
cd examples/payment-demo
SERVER_PRIVATE_KEY=0x... INTMAX402_SECRET=demo-secret node dist/server.js
```

Output:
```
Initializing payment verifier...
Server INTMAX address: 0xABC123...
Payment demo server running on http://localhost:3761
Endpoints:
  GET /free    - No payment required
  GET /premium - Payment required (1000 units)
```

### Terminal 2 — Run the client

```bash
cd examples/payment-demo
CLIENT_PRIVATE_KEY=0x... node dist/client.js
```

Output:
```
Initializing client with payment support...
Client address: 0xDEF456...
Client INTMAX address: 0xGHI789...

--- Accessing free endpoint ---
Status: 200
Response: {"message":"Free endpoint - no payment required"}

--- Accessing payment-gated endpoint ---
This will automatically send payment and include proof...
Status: 200
Response: {"message":"Payment verified! Here is your premium content.","paidBy":"0xDEF456...","txHash":"0x123...","timestamp":1234567890}
```

## Key Files

- `src/server.ts` — Express server with payment-gated endpoint
- `src/client.ts` — INTMAX402Client making payment-gated requests

## Related Docs

- [Payment Mode Guide](../../docs/payment-mode.md)
- [Security Model](../../docs/security.md)
