# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

- `intmax402-nextjs` — Next.js middleware + App Router support (v0.1.0)

---

## [0.2.5] — 2026-03-07

### Fixed
- **express**: `allowList` address comparison is now case-insensitive — addresses are normalized with `toLowerCase()` before matching (fixes rejection of checksum-formatted addresses)

---

## [0.2.4] — 2026-03-07

### Security (23 measures implemented)
- **express**: Added `try/catch` around all async middleware paths to prevent unhandled rejections from crashing the server
- **express**: Hex format validation for `signature` and `address` fields before processing
- **express**: `privateKey` format validation in client initialization
- **express**: Header sanitization — `WWW-Authenticate` and `Authorization` headers are sanitized before parsing
- **core**: `crypto.randomBytes` used for all secret generation (replaces `Math.random`)
- **core**: Optional chaining added to all header field accesses
- **core**: Strict mode validation rejects unknown `mode` values with structured error responses

### Fixed
- Race condition in replay-protection map (atomic check-and-add)
- Timing attack mitigation: `crypto.timingSafeEqual` used for HMAC comparisons

---

## [0.2.3] — 2026-03-07

### Security
- **express**: Fixed hardcoded private key exposure in development examples
- **express**: SSRF mitigation for payment verification URL construction
- **express**: Payment signature format hardened — reject malformed `txHash` before INTMAX lookup

---

## [0.2.2] — 2026-03-07

### Added
- **hono**: `@tanakayuto/intmax402-hono` middleware package (v0.1.2)
- **fetch-adapter**: `@tanakayuto/intmax402-fetch` Web Fetch API adapter (v0.1.2) — enables Cloudflare Workers, Deno, and edge runtimes
- Unified fetch-adapter base — moved `buildWWWAuthenticate` to `core` for reuse

### Changed
- Refactored internal package structure to share code between express and fetch adapters

---

## [0.2.1] — 2026-03-07

### Added
- Security and edge case test suite across all packages
- Test coverage for invalid signatures, malformed headers, and replay scenarios

---

## [0.2.0] — 2026-03-06

### Added
- **Payment mode** — full implementation with `intmax2-server-sdk`
  - `initPaymentVerifier()` — server-side INTMAX L2 login
  - `getPaymentVerifierAddress()` — retrieve server's INTMAX address
  - `verifyPayment()` — on-chain payment verification via `fetchTransfers()`
  - Replay protection: used `txHash` tracking with 24h TTL
  - Amount and recipient verification against L2 data
- **client**: `initPayment(l1RpcUrl)` — initialize INTMAX payment capability
- **client**: `getIntMaxAddress()` — retrieve client's INTMAX L2 address
- `examples/payment-demo/` — full payment mode server + client example on testnet

### Changed
- `intmax402-express` now depends on `intmax2-server-sdk` for real L2 verification
- Payment mode WWW-Authenticate header now includes `serverAddress`, `amount`, `tokenAddress`, `chainId`

---

## [0.1.2] — 2026-03-05

### Fixed
- **client**: Real `ethers.js` signing replaces placeholder HMAC-based signing
- **core**: Real ECDSA signature verification with `ethers.verifyMessage()`
- All usecase tests passing (7/7) with real cryptographic signatures
- Fixed import paths in `dist/` output (patch 0.1.1 → 0.1.2)

---

## [0.1.1] — 2026-03-04

### Fixed
- Import path resolution in compiled `dist/` output
- IP-free nonce design — removed IP binding from nonce to support AI agents behind proxies/VPNs

---

## [0.1.0] — 2026-03-03

### Added
- Initial release 🎉
- **core** (`@tanakayuto/intmax402-core`): Protocol types, HMAC nonce generation, header parsing
- **express** (`@tanakayuto/intmax402-express`): Express middleware for identity mode
  - `intmax402({ mode: 'identity', secret })` middleware
  - `allowList` support for address whitelisting
  - `req.intmax402` — verified address attached to request
- **client** (`@tanakayuto/intmax402-client`): Client SDK
  - `INTMAX402Client` with `init()` and `fetch()` (auto-retry on 401)
- **cli** (`@tanakayuto/intmax402-cli`): CLI tool
  - `intmax402 test <url>` — test any endpoint
  - `intmax402 keygen` — generate a test wallet
- `examples/basic-express/` — identity mode server example
- `examples/agent-to-agent/` — AI agent calling AI agent demo
- Protocol specification (`docs/SPEC.md`)
- Security model (`docs/SECURITY.md`)

---

## Version Summary

| Package | Latest Version |
|---|---|
| `@tanakayuto/intmax402-core` | 0.2.4 |
| `@tanakayuto/intmax402-express` | 0.2.5 |
| `@tanakayuto/intmax402-client` | 0.2.1 |
| `@tanakayuto/intmax402-cli` | 0.3.1 |
| `@tanakayuto/intmax402-fetch` | 0.1.2 |
| `@tanakayuto/intmax402-hono` | 0.1.2 |
