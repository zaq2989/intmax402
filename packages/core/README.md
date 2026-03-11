# @tanakayuto/intmax402-core

Protocol primitives for [intmax402](https://github.com/zaq2989/intmax402) — types, nonce generation, signature verification, and error definitions.

## Install

```bash
npm install @tanakayuto/intmax402-core
```

## Usage

```typescript
import {
  generateNonce,
  verifyNonce,
  parseWWWAuthenticate,
  parseAuthorization,
  buildWWWAuthenticate,
  INTMAX402Error,
  INTMAX402_ERROR_CODES,
} from '@tanakayuto/intmax402-core'

// Generate a time-windowed nonce (30s window, no database needed)
const nonce = generateNonce(secret, clientIp, '/api/resource', false)

// Parse a WWW-Authenticate header from a 401/402 response
const challenge = parseWWWAuthenticate(wwwAuthHeader)
// => { realm, nonce, mode: 'identity' | 'payment', serverAddress?, amount?, ... }

// Parse an Authorization header from a client request
const credential = parseAuthorization(authHeader)
// => { address, nonce, signature, txHash? }

// Verify a nonce (checks HMAC + time window)
const valid = verifyNonce(nonce, secret, clientIp, '/api/resource', false)
```

## API Reference

### `generateNonce(secret, ip, path, bindIp)`

Generates a stateless, replay-protected nonce using HMAC-SHA256.

```
nonce = HMAC-SHA256(secret, path + floor(timestamp / 30_000))
```

| Parameter | Type | Description |
|---|---|---|
| `secret` | `string` | HMAC secret (keep private) |
| `ip` | `string` | Client IP address |
| `path` | `string` | Request path |
| `bindIp` | `boolean` | Bind nonce to client IP (default `false`) |

Returns: `string` — 64-char hex nonce

---

### `verifyNonce(nonce, secret, ip, path, bindIp)`

Verifies a nonce against the current ±1 time window (covers clock skew up to 30s).

Returns: `boolean`

---

### `parseWWWAuthenticate(header)`

Parses a `WWW-Authenticate: INTMAX402 ...` header into a challenge object.

```typescript
const challenge = parseWWWAuthenticate(
  'INTMAX402 realm="intmax402", nonce="abc123", mode="payment", serverAddress="0x...", amount="1000"'
)
// => { realm, nonce, mode, serverAddress, amount, tokenAddress?, chainId? }
```

Returns: `INTMAX402Challenge | null`

---

### `parseAuthorization(header)`

Parses an `Authorization: INTMAX402 ...` header. Includes strict format validation (address length, nonce format, signature format).

Returns: `INTMAX402Credential | null`

---

### `buildWWWAuthenticate(nonce, config)`

Builds a `WWW-Authenticate` header string from a config object.

---

### `INTMAX402Error`

Custom error class with a typed `code` property.

```typescript
import { INTMAX402Error, INTMAX402_ERROR_CODES } from '@tanakayuto/intmax402-core'

try {
  // ...
} catch (e) {
  if (e instanceof INTMAX402Error) {
    console.error(e.code, e.message, e.details)
  }
}
```

---

### `INTMAX402_ERROR_CODES`

All error codes:

| Code | Category | Description |
|---|---|---|
| `INVALID_SIGNATURE` | Auth | Signature verification failed |
| `NONCE_EXPIRED` | Auth | Nonce is outside the valid time window |
| `NONCE_ALREADY_USED` | Auth | Nonce replay detected |
| `MISSING_AUTH_HEADER` | Auth | No Authorization header present |
| `INVALID_AUTH_FORMAT` | Auth | Authorization header is malformed |
| `PAYMENT_NOT_FOUND` | Payment | Payment transaction not found on INTMAX |
| `PAYMENT_AMOUNT_MISMATCH` | Payment | Payment amount doesn't match required amount |
| `PAYMENT_RECIPIENT_MISMATCH` | Payment | Payment recipient doesn't match server address |
| `INTMAX_NETWORK_UNAVAILABLE` | Network | INTMAX L2 network is unreachable |
| `INTMAX_SYNC_TIMEOUT` | Network | INTMAX wallet sync timed out |
| `INTMAX_BROADCAST_FAILED` | Network | Transaction broadcast failed |
| `INVALID_CONFIG` | Config | Invalid middleware/client configuration |
| `MISSING_PRIVATE_KEY` | Config | Private key is missing or invalid |

## Network

intmax402 operates on **Ethereum mainnet** by default (via INTMAX ZK L2 on Scroll).

| Environment | L1 Chain | L2 Chain | L1 Chain ID |
|---|---|---|---|
| `mainnet` (default) | Ethereum mainnet | Scroll | `1` |
| `testnet` | Sepolia | Scroll Sepolia | `11155111` |

## License

MIT
