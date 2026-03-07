# Security

## Overview

intmax402 is designed with defense-in-depth. The protocol itself is stateless and cryptographically sound, and the implementation includes 23+ hardened security measures across all packages.

---

## Threat Model

### In Scope

| Threat | Mitigation |
|---|---|
| Replay attacks (reuse valid auth token) | Time-windowed HMAC nonces (30s expiry) |
| Replay attacks (reuse valid txHash) | In-memory used-txHash tracking (24h TTL) |
| Signature forgery | ECDSA on secp256k1 via ethers.js (production-grade) |
| Nonce prediction | HMAC-SHA256 with secret key + time window |
| Path confusion (use token from /a on /b) | Nonce includes request path |
| Payment bypass (claim payment without paying) | Server verifies txHash on INTMAX L2 |
| Payment amount manipulation | Server checks exact amount from L2 data |
| Wrong recipient (pay self, claim paid server) | Server checks recipient address from L2 |
| Header injection | Regex-based header parsing, sanitized inputs |
| Invalid input crashes | All inputs validated before processing |
| Timing attacks on secret comparison | `crypto.timingSafeEqual` used for all comparisons |
| Race conditions | Atomic operations on used-txHash map |

### Out of Scope

- Private key compromise on client or server side
- Server-side `INTMAX402_SECRET` leakage
- DDoS / rate limiting (implement at infrastructure layer)
- INTMAX L2 smart contract vulnerabilities
- Compromised INTMAX network validators

---

## Implemented Security Measures

### Nonce Security (Core)
1. **HMAC-SHA256** for nonce generation — not predictable without the server secret
2. **Time-windowed nonces** — expire every 30 seconds; server accepts current + previous window (~60s grace)
3. **Path-bound nonces** — nonce includes the request path; cross-endpoint replay is not possible
4. **No client-controlled nonce input** — server generates all nonces; client cannot influence the value
5. **`crypto.randomBytes`** — server secret generation uses cryptographically secure randomness

### Signature Verification (Core + Express)
6. **Production ECDSA** — uses `ethers.js` for `personal_sign` (EIP-191) signature recovery
7. **Address recovery** — verifies the recovered address matches the claimed address (not just signature format)
8. **Hex format validation** — signatures and addresses are validated against regex before processing
9. **`privateKey` format check** — client validates private key format on initialization

### Payment Verification (Express)
10. **On-chain verification** — `txHash` is verified against INTMAX L2 via `intmax2-server-sdk`
11. **Recipient check** — confirms payment went to the server's INTMAX address, not elsewhere
12. **Amount check** — verifies exact amount matches the configured requirement
13. **Replay protection** — used `txHash` values tracked in a 24h TTL map
14. **Atomic replay check** — check-and-add is synchronous to prevent race conditions

### Input Validation (Express Middleware)
15. **Mode validation** — only `"identity"` and `"payment"` accepted; unknown modes rejected with 500
16. **Header sanitization** — `WWW-Authenticate` and `Authorization` headers are sanitized before parsing
17. **allowList normalization** — addresses normalized to lowercase before comparison (case-insensitive)
18. **Try/catch on all async paths** — errors in middleware are caught and return structured responses, not crashes

### Transport Security
19. **HTTPS enforcement (recommended)** — protocol relies on TLS; always deploy behind HTTPS
20. **No IP binding** — nonces are not bound to client IP (works with proxies, VPNs, AI agents)
21. **No session state** — server stores nothing between requests; stateless by design

### Configuration Security
22. **No hardcoded secrets** — all secrets come from environment variables; no defaults committed
23. **Separate secrets per mode** — `INTMAX402_SECRET` for nonce generation; `SERVER_PRIVATE_KEY` for payment receiving

---

## Nonce Design (Deep Dive)

```
nonce = HMAC-SHA256(server_secret, url_path + ":" + floor(timestamp / 30_000))
```

**Why this design?**
- `server_secret` — only the server can generate valid nonces; clients cannot predict them
- `url_path` — prevents a valid nonce for `/free` being used on `/premium`
- `floor(timestamp / 30_000)` — creates 30-second windows; client has ~60s to complete the flow

**Verification:**
The server checks the nonce against both the current window and the previous window. This provides ~60 seconds for the client to sign and retry, while still limiting replay window to 60s maximum.

---

## Recommendations for Server Operators

### Required
- **Always use HTTPS/TLS** — without it, signatures can be captured and replayed within the 60s window
- **Use a strong secret** — minimum 256-bit (32 bytes) random value
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Set different secrets per environment** — dev, staging, prod should each have unique secrets

### Recommended
- **Rotate `INTMAX402_SECRET` periodically** — e.g., monthly; old tokens automatically expire
- **Set `allowList` where possible** — restrict access to known addresses for sensitive endpoints
- **Monitor auth patterns** — unexpected spikes in 401/402 responses may indicate probing
- **Use Redis for replay protection** in multi-instance deployments (default is in-memory per process)

### Payment Mode Specific
- **Protect `SERVER_PRIVATE_KEY`** — this controls your INTMAX wallet; treat it like a bank account key
- **Call `initPaymentVerifier()` at startup** — verify the INTMAX login succeeds before accepting traffic
- **Log all payment events** — keep an audit trail of `txHash`, `address`, `amount`, and timestamp

---

## Known Limitations

1. **In-memory replay map** — not shared across multiple server instances. Multi-process deployments need a shared store (Redis). Single-process deployments (PM2 cluster mode on one machine) are not safe with the default implementation.

2. **Nonce window ≈ 60s** — for slow connections or high-latency networks, the client may exceed this window during the payment flow. If you experience timeout issues, see the [FAQ](faq.md).

3. **INTMAX L2 finality** — payment verification depends on INTMAX network availability. If the network is degraded, payment verification may fail even for valid payments.

---

## Reporting Vulnerabilities

Found a security issue? Please report it via GitHub Issues with the `security` label, or contact the maintainer directly.

Do **not** create public issues for vulnerabilities that could be actively exploited.
