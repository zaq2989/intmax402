# QA Report: intmax402 v1.1 Payment Mode Implementation

**Author**: DORO (QA Team)
**Date**: 2026-03-07
**Scope**: Pre-implementation code review + test plan for payment mode (v1.1)

---

## 1. Baseline Status

| Item | Status |
|------|--------|
| `pnpm build` (all packages) | PASS |
| `usecase-test.mjs` (identity mode, 7 tests) | PASS |
| Existing code compiles without type errors | PASS |

## 2. Code Quality Findings

### CRITICAL - Must fix before/during implementation

**C1: `parseAuthorization` field name mismatch with spec**
- File: `packages/core/src/parse.ts:38`
- The parser extracts `result.txHash` from the Authorization header, but the task spec defines the header field as `tx_id="..."`.
- Either the parser must also check `result.tx_id` and map it to `txHash`, or the header field name must be `txHash`. The spec and parser must agree.
- **Action**: Verify which field name will be used in the Authorization header (`tx_id` vs `txHash`) and ensure `parse.ts`, `client.ts`, and `middleware.ts` are consistent.

**C2: Payment mode has no actual verification (known TODO)**
- File: `packages/express/src/middleware.ts:88-95`
- Currently only checks `txHash` presence; trusts it without verification.
- **Action**: This is the core of the v1.1 work (Step 2/3).

### HIGH - Should fix during implementation

**H1: SDK `Transaction.digest` vs `txHash`/`txId` mapping**
- The `intmax2-server-sdk` `fetchTransfers()` returns `Transaction` objects with a `digest` field (not `txId` or `txHash`).
- `Transaction` type: `{ digest, amount, from, to, status, timestamp, transfers[], tokenIndex, txType, tokenAddress? }`
- The `Transfer` sub-type has: `{ recipient, tokenIndex, amount, salt }`
- **Action**: `verifyPayment()` must match incoming `txId` against `Transaction.digest`. Verify this mapping is correct by testing with real testnet data. The `amount` on `Transaction` is a `string` (not `bigint`), so comparison logic must handle decimal parsing.

**H2: `broadcastTransaction` response uses `txTreeRoot`, not a simple txId**
- `BroadcastTransactionResponse`: `{ txTreeRoot: string, transferDigests: string[] }`
- The client side (`fetchWithPayment`) will receive `txTreeRoot` after broadcasting. The server side will look up via `fetchTransfers()` which returns `Transaction.digest`.
- **Action**: Clarify which identifier the client sends as `tx_id` - likely one of `transferDigests[]` since `fetchTransfers` returns individual `Transaction` objects. Must test this mapping on testnet.

**H3: Nonce timing with payment flow**
- Nonce window is 30s (with 2-window tolerance = ~60s max).
- Payment flow: GET -> 402 -> INTMAX transfer (~7-10s+ for sync/broadcast/confirm) -> retry with auth.
- If the INTMAX transfer is slow, the nonce could expire before the retry.
- **Action**: Consider whether 60s is sufficient. Monitor in E2E tests; may need to increase `WINDOW_MS` or implement a payment-specific nonce with longer TTL.

### MEDIUM - Warning only (no code change required now)

**M1: `ethers` listed in both `dependencies` and `devDependencies`**
- File: `packages/client/package.json`
- `ethers` appears in both sections. Not a build-breaking issue but indicates package.json hygiene concern.

**M2: Hardcoded absolute pnpm paths in test files**
- File: `usecase-test.mjs:13-16`
- Uses hardcoded paths like `${BASE}/express@4.22.1/node_modules/express`. If dependency versions change, this will break.

**M3: Authorization header regex limitations**
- File: `packages/core/src/parse.ts:8,28`
- The regex `(\w+)="([^"]*)"` does not handle values containing escaped quotes or special characters. Current values (hex addresses, hex signatures) are safe, but this is fragile.

**M4: No `tx_id` field in `parseAuthorization` regex key mapping**
- The `parseAuthorization` function uses `result.txHash` but the key in the parsed header uses `\w+` which would match `tx_id` as a key. Since the underscore `_` is matched by `\w`, parsing `tx_id="..."` would create `result.tx_id`, but the return maps `result.txHash`. This needs alignment.

## 3. Test Plan for Payment Mode

### 3.1 Unit Tests (verify-payment.ts)

| ID | Test Case | Priority |
|----|-----------|----------|
| UP-1 | Valid txId with correct amount and recipient -> `{ ok: true }` | P0 |
| UP-2 | txId not found in fetchTransfers -> `{ ok: false, reason: "tx not found" }` | P0 |
| UP-3 | txId found but recipient != serverAddress -> `{ ok: false }` | P0 |
| UP-4 | txId found but amount < expectedAmount -> `{ ok: false }` | P0 |
| UP-5 | Replay attack: same txId used twice -> second call returns `{ ok: false }` | P0 |
| UP-6 | Used txId map TTL: entry expires after 24h | P1 |
| UP-7 | INTMAX client not logged in -> graceful error handling | P1 |
| UP-8 | fetchTransfers network error -> graceful error handling | P1 |
| UP-9 | Amount comparison with different decimal representations | P1 |

### 3.2 Integration Tests (middleware.ts payment mode)

| ID | Test Case | Priority |
|----|-----------|----------|
| IM-1 | No auth header -> 402 with WWW-Authenticate containing serverAddress/amount/mode=payment | P0 |
| IM-2 | Auth header with valid signature + valid txId -> 200 | P0 |
| IM-3 | Auth header with valid signature but no tx_id -> 402 "Payment transaction hash required" | P0 |
| IM-4 | Auth header with valid signature + invalid txId -> 402 or appropriate error | P0 |
| IM-5 | Auth header with invalid signature + valid txId -> 401 | P0 |
| IM-6 | Payment mode config without serverAddress -> should error or warn at startup | P1 |
| IM-7 | Payment mode config without amount -> should error or warn at startup | P1 |

### 3.3 Client Tests (fetchWithPayment)

| ID | Test Case | Priority |
|----|-----------|----------|
| CL-1 | Full flow: GET -> 402 -> transfer -> retry -> 200 | P0 |
| CL-2 | Non-402 response returns immediately (no payment attempt) | P0 |
| CL-3 | Missing WWW-Authenticate header on 402 -> returns raw response | P1 |
| CL-4 | INTMAX transfer failure -> appropriate error propagation | P1 |
| CL-5 | Server rejects after payment (e.g., nonce expired) -> no retry loop | P1 |

### 3.4 E2E Tests (usecase-test.mjs additions)

| ID | Test Case | Priority |
|----|-----------|----------|
| E2E-1 | Payment mode happy path: client pays, server verifies, 200 returned | P0 |
| E2E-2 | Payment mode without payment: client gets 402 with payment details | P0 |
| E2E-3 | Payment mode replay: same txId rejected on second use | P0 |
| E2E-4 | Identity mode still works (regression) | P0 |
| E2E-5 | Payment amount insufficient -> rejected | P1 |

### 3.5 Security Tests

| ID | Test Case | Priority |
|----|-----------|----------|
| SEC-1 | Replay attack: reuse a valid tx_id from a previous request | P0 |
| SEC-2 | Cross-endpoint replay: use tx_id from endpoint A on endpoint B | P1 |
| SEC-3 | Spoofed tx_id: fabricated digest that doesn't exist on-chain | P0 |
| SEC-4 | Amount manipulation: pay less than required amount | P0 |
| SEC-5 | Recipient manipulation: pay to wrong address, claim paid to server | P0 |

## 4. SDK Integration Notes for Implementers

### Key Type Mappings
```
fetchTransfers() -> FetchTransactionsResponse = { items: Transaction[], pagination }
Transaction = { digest, amount(string), from, to, status, timestamp, transfers[], tokenIndex, txType }
Transfer = { recipient, tokenIndex, amount(string), salt }
broadcastTransaction() -> { txTreeRoot, transferDigests[] }
```

### Important Considerations
1. `Transaction.amount` is a `string`, not `bigint`. Parse carefully for comparison.
2. `fetchTransfers()` returns items received by the logged-in wallet. The server must be logged in as itself.
3. `broadcastTransaction` returns `transferDigests[]` - one of these likely corresponds to the `digest` in `fetchTransfers`. Verify on testnet.
4. `login()` takes ~3-7s. Must be called once at server startup, not per-request.
5. `sync()` should be called periodically to keep balance updated.
6. The `ConstructorNodeParams.eth_private_key` type is `` `0x${string}` `` - must include `0x` prefix.

## 5. Acceptance Criteria Checklist

- [ ] `pnpm build` passes with no errors (all packages)
- [ ] All existing identity mode tests pass (regression)
- [ ] `verify-payment.ts` created with txId verification via fetchTransfers
- [ ] Replay protection (used txId map with 24h TTL) implemented
- [ ] `middleware.ts` payment mode uses real verifyPayment()
- [ ] `client.ts` fetchWithPayment() implements full 402 flow
- [ ] `examples/payment-demo/` created and functional on testnet
- [ ] E2E test for payment mode added and passing
- [ ] No hardcoded secrets or private keys in committed code
- [ ] `parse.ts` field name (`tx_id`/`txHash`) is consistent across all packages
