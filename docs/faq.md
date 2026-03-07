# FAQ

## General

### What is intmax402?

intmax402 is a stateless HTTP authentication and micropayment protocol built on top of INTMAX ZK L2. It lets you:
- **Prove wallet ownership** (identity mode) — like a cryptographic API key
- **Pay per request** (payment mode) — gas-free micropayments via INTMAX

### Do I need a blockchain node?

No. intmax402 is designed to work without running your own node. The INTMAX SDK handles L2 interaction, and identity mode requires no blockchain access at all.

### Is this production-ready?

The identity mode is production-ready. Payment mode is in active development (v0.2.x) — suitable for testnet and early production use, but monitor the changelog for breaking changes.

### What networks are supported?

- **Testnet**: INTMAX testnet (Sepolia-based)
- **Mainnet**: INTMAX mainnet (coming with v1.0)

---

## Installation & Setup

### I'm getting a TypeScript error about `req.intmax402`

Add the type augmentation. In your `tsconfig.json`, make sure `typeRoots` includes `@types`, then create a type declaration file:

```typescript
// types/express.d.ts
import '@tanakayuto/intmax402-express'
// The package augments Express.Request automatically
```

Or import the type directly:
```typescript
import type { Intmax402RequestInfo } from '@tanakayuto/intmax402-express'
```

### Can I use intmax402 with ESM?

Yes. All packages ship CommonJS (for Node.js compatibility) and are compatible with ESM consumers. If you're using `"type": "module"` in your package.json, imports work as expected.

### Does it work with TypeScript strict mode?

Yes. All packages are built with strict TypeScript. If you're seeing type errors, make sure you're on a compatible version:
```bash
npm install @tanakayuto/intmax402-express typescript@^5.4.0
```

---

## Identity Mode

### Why is the client getting 401 repeatedly?

Common causes:
1. **Clock skew** — client and server clocks differ by more than 60 seconds. The nonce is time-based; sync your system clock.
2. **Wrong nonce** — the client is signing a nonce that doesn't match what the server generated. Check that the nonce is extracted correctly from the `WWW-Authenticate` header.
3. **Wrong path** — the nonce is path-bound. Ensure the client retries on the exact same path.
4. **Expired nonce** — if more than 60 seconds pass between receiving the 401 and sending the signed request, the nonce expires. The client should retry immediately.

### Can I use allowList with lowercase and uppercase addresses?

Yes. As of v0.2.5, `allowList` addresses are normalized to lowercase for comparison. You can use either checksum format (`0x1234...ABCD`) or lowercase (`0x1234...abcd`).

---

## Payment Mode

### How long does `initPaymentVerifier()` take?

Approximately 3–7 seconds on first call. This is a one-time cost at server startup — the INTMAX SDK logs in to the network and caches the session.

### The client is timing out during payment — what should I do?

The nonce window is ~60 seconds. INTMAX payment flow (login + transfer + broadcast) can take 7–15 seconds. If you're seeing nonce expiry:

1. Ensure `client.initPayment()` is called **before** making requests (not inline)
2. The client SDK reuses the initialized session — subsequent requests are faster
3. If you're on a slow network, consider increasing `WINDOW_MS` in the core package (advanced)

### WSL2: validity prover error / INTMAX SDK crashes

This is a known issue with INTMAX SDK on WSL2 (Windows Subsystem for Linux). The `validity-prover` process used by the SDK has issues with WSL2's kernel.

**Workarounds:**
1. **Use native Linux** — run on a real Linux machine or VM
2. **Use Docker** — run the server in a Docker container with a Linux base image
3. **Skip payment verification in dev** — set `INTMAX_ENV=mock` (if available) for local development

```bash
# Check if you're in WSL2
uname -r
# → ...microsoft-standard-WSL2  ← this is WSL2

# Recommended: use Docker for payment-mode development
docker run -e SERVER_PRIVATE_KEY=0x... -e INTMAX402_SECRET=... \
  your-server-image node dist/server.js
```

### Payment is accepted but client gets 402 again

The server may not have found the `txHash` on INTMAX L2 yet. Possible causes:
1. **Network delay** — INTMAX L2 may not have indexed the transaction yet. Wait 5–10 seconds and retry.
2. **Wrong `txHash`** — verify the hash returned by `broadcastTransaction` matches what was sent in the Authorization header.
3. **Already used** — if the same `txHash` was submitted before, it's rejected as a replay. Each payment can only authorize one request.

### Can a client re-use a txHash for multiple requests?

No. Each `txHash` can only be used once. This is enforced server-side as replay protection. The client must send a new payment for each protected request.

---

## CLI

### `intmax402 test` fails with "connection refused"

The server isn't running or isn't listening on the expected port. Start your server first:
```bash
node server.js  # in another terminal
intmax402 test http://localhost:3000/premium
```

### How do I test payment mode with the CLI?

```bash
export ETH_PRIVATE_KEY=0x...  # must be a funded INTMAX testnet wallet
intmax402 test http://localhost:3761/premium --mode payment
```

Note: The CLI must have `initPayment` capability, which requires a funded INTMAX wallet.

---

## Edge Runtimes (Hono / Cloudflare Workers)

### Does payment mode work on Cloudflare Workers?

Not currently. Payment mode requires the `intmax2-server-sdk` which uses Node.js-specific APIs (crypto, WebSocket). Identity mode works on any environment that supports standard Web Crypto.

### Which packages work on edge runtimes?

| Package | Edge compatible |
|---|---|
| `intmax402-core` | ✅ (identity only) |
| `intmax402-hono` | ✅ (identity only) |
| `intmax402-fetch` | ✅ (identity only) |
| `intmax402-express` | ❌ (Node.js only) |
| `intmax402-client` | ⚠️ (identity only without initPayment) |

---

## Contributing

### How do I run the tests?

```bash
pnpm install
pnpm build
node usecase-test.mjs         # identity mode integration tests
node e2e-test.mjs             # e2e tests (requires running server)
```

### How do I add a new package?

Create a directory under `packages/` following the existing structure. Add it to `pnpm-workspace.yaml` and run `pnpm install`.
