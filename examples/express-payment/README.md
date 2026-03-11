# express-payment example

Minimal Express server + client demonstrating **intmax402 payment mode**.

The server gates an endpoint behind an INTMAX L2 micropayment. The client automatically handles the full 402 payment flow.

## Prerequisites

- Node.js 18+
- An Ethereum wallet with ETH deposited on INTMAX L2
  - Testnet: [https://testnet.intmax.io](https://testnet.intmax.io)
  - Mainnet: [https://app.intmax.io](https://app.intmax.io)

Generate a test wallet:

```bash
npm install -g @tanakayuto/intmax402-cli
intmax402 keygen
```

## Install

```bash
cd examples/express-payment
npm install
```

## Run

### 1. Start the server

```bash
export INTMAX402_SECRET="my-secret-key-change-this"
export ETH_PRIVATE_KEY="0xYourServerPrivateKey"
export INTMAX_ENV="testnet"   # or 'mainnet'

node server.js
```

```
intmax402 express-payment server running on http://localhost:3762
Environment: testnet

Endpoints:
  GET http://localhost:3762/free    — no authentication
  GET http://localhost:3762/premium — requires INTMAX payment
```

### 2. Run the client (in another terminal)

```bash
export CLIENT_PRIVATE_KEY="0xYourClientPrivateKey"
export INTMAX_ENV="testnet"

node client.js
```

```
Connecting to server: http://localhost:3762
Environment: testnet

Initializing INTMAX L2 wallet...
Ethereum address : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
INTMAX L2 address: 0x...

=== GET /free (no auth) ===
Status: 200
Body:   {"message":"Free endpoint — no payment required"}

=== GET /premium (payment mode) ===
Sending payment and proving ownership...
Status: 200
Body:   {"message":"Payment verified!","paidBy":"0xf39F...","txHash":"0x...","timestamp":"..."}
```

## Environment Variables

### Server

| Variable | Required | Description |
|---|---|---|
| `INTMAX402_SECRET` | ✅ | HMAC secret for nonce generation |
| `ETH_PRIVATE_KEY` | ✅ | Ethereum private key (for payment verification) |
| `INTMAX_ADDRESS` | — | Your INTMAX L2 address (auto-derived if omitted) |
| `INTMAX_ENV` | — | `testnet` or `mainnet` (default: `testnet`) |
| `PORT` | — | HTTP port (default: `3762`) |

### Client

| Variable | Required | Description |
|---|---|---|
| `CLIENT_PRIVATE_KEY` | ✅ | Ethereum private key for the paying client |
| `SERVER_URL` | — | Server base URL (default: `http://localhost:3762`) |
| `INTMAX_ENV` | — | `testnet` or `mainnet` (default: `testnet`) |

## How it works

```
Client                             Server
  │── GET /premium ─────────────>  │
  │<─ 402 ────────────────────────  │  nonce = HMAC(secret, path + timeWindow)
  │   WWW-Authenticate: INTMAX402   │
  │     nonce="..."                 │
  │     serverAddress="0x..."       │
  │     amount="1000"               │
  │                                 │
  │  1. Send INTMAX L2 transfer     │
  │  2. Sign nonce with wallet      │
  │                                 │
  │── GET /premium ─────────────>  │
  │   Authorization: INTMAX402      │
  │     address="0x..."             │
  │     nonce="..."                 │
  │     signature="0x..."           │
  │     txHash="0x..."              │
  │                                 │
  │<─ 200 OK ─────────────────────  │  verifySignature() + verifyPayment()
  │   { message: "Payment verified" }│
```

See the [main README](../../README.md) for full documentation.
