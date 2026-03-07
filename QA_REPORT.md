# QA Report: intmax402 v1.1 Payment Mode Implementation

**Author**: DORO (QA Team)  
**Date**: 2026-03-07  
**Scope**: Pre-implementation code review + test plan for payment mode (v1.1)

---

## テスト状況サマリー（最新）

| テストファイル | テスト数 | 状態 |
|---|---|---|
| `usecase-test.mjs` (シナリオ1-15) | **47テスト** | ✅ 全PASS |
| `tests/payment-mock-test.mjs` (シナリオA-F) | **14テスト** | ✅ 全PASS |
| **合計** | **61テスト** | ✅ 全PASS |

### usecase-test.mjs シナリオ別

| シナリオ | 概要 | テスト数 | 状態 |
|---|---|---|---|
| 1 | AIエージェント自動認証 | 3 | ✅ |
| 2 | 並列アクセス | 1 | ✅ |
| 3 | 不正アクセスブロック | 3 | ✅ |
| 4 | Payment mode基本フロー | 4 | ✅ |
| 5 | Identity modeリグレッション | 1 | ✅ |
| 6 | parse.tsバリデーション | 4 | ✅ |
| 7 | parseWWWAuthenticate modeバリデーション | 3 | ✅ |
| 8 | allowList機能 | 3 | ✅ |
| 9 | アドレス大文字小文字正規化 | 1 | ✅ |
| 10 | nonce再利用（stateless設計） | 2 | ✅ |
| 11 | malformed Authorizationヘッダー | 3 | ✅ |
| **12** | **payment mode WWW-Authenticate全フィールド検証** | **8** | ✅ (新規追加) |
| **13** | **txHash長さバリデーション（境界値）** | **4** | ✅ (新規追加) |
| **14** | **amount="0"のエッジケース** | **2** | ✅ (新規追加) |
| **15** | **identity + payment混在サーバー** | **5** | ✅ (新規追加) |

### tests/payment-mock-test.mjs シナリオ別（新規）

| シナリオ | 概要 | テスト数 | 状態 |
|---|---|---|---|
| A | 正常payment flow (402→transfer→認証成功) | 4 | ✅ |
| B | 無効txHash → 402 | 3 | ✅ |
| C | 金額不足 → 402 | 1 | ✅ |
| D | 受取人アドレス不一致 → 402 | 1 | ✅ |
| E | txHash再利用（リプレイ攻撃）→ 402 | 3 | ✅ |
| F | 並列リクエスト（race condition防止） | 2 | ✅ |

---

## Payment Mode 検証状況

### モック統合テスト（testnet不要）✅

`tests/payment-mock-test.mjs` にて、`intmax2-server-sdk` をモックして完全なE2Eフローを検証済み：

- ✅ 正常payment flow（402 → 転送 → 認証成功 → 200）
- ✅ 存在しないtxHash → 402（Transaction not found）
- ✅ 金額不足（BigInt比較: `amount < expectedAmount`）→ 402
- ✅ 受取人アドレス不一致 → 402
- ✅ txHash再利用（リプレイ攻撃）→ 402（Transaction already used）
- ✅ 同一txHash並列リクエスト → [200, 402]（PENDING機構でrace condition防止）
- ✅ 異なるtxHash並列3件 → 全200（正常並列処理）
- ✅ txHashなし → 402（Payment transaction hash required）
- ✅ txHash129文字超（制限128文字）→ 401（parse拒否）
- ✅ 金額多め（amount >= expected）→ 200（`>=`検証）

### モック方法

```javascript
// verify-payment.js の exports を直接書き換え（CommonJS require cache経由）
const verifyPaymentModule = require('.../packages/express/dist/verify-payment.js');
verifyPaymentModule.verifyPayment = mockVerifyPayment;
// middleware.js は同じ exports オブジェクトを参照するため mock が有効
```

### Testnet検証（WSL2環境）❌ Blocked

WSL2 (Linux 6.6.87.2-microsoft-standard-WSL2) 環境でのtestnet接続時：

```
Error: validity prover error / connection refused
```

- `intmax2-server-sdk` の `login()` 呼び出し時に validity prover への接続が失敗
- Testnet エンドポイントへのアクセス制限（WSL2ネットワーク経由）が原因と推定
- 実際のtestnet検証はWSL2外（Linux native / クラウド環境）で実施が必要

**影響**: モックテストで代替。実装ロジック（fetchTransfers + digest照合 + BigInt比較）は `verify-payment.ts` のコードレビューで確認済み。

---

## 1. Baseline Status

| Item | Status |
|------|--------|
| `pnpm build` (all packages) | PASS |
| `usecase-test.mjs` (identity mode + payment mode, **47 tests**) | **PASS (47/47)** |
| `tests/payment-mock-test.mjs` (payment mock E2E, **14 tests**) | **PASS (14/14)** |
| Existing code compiles without type errors | PASS |

---

## 2. Code Quality Findings

### CRITICAL - Must fix before/during implementation

**C1: `parseAuthorization` field name mismatch with spec** ✅ Resolved
- Field name は `txHash` で統一済み（`parse.ts`, `client.ts`, `middleware.ts` 一致確認）

**C2: Payment mode has no actual verification (known TODO)** ✅ Resolved
- `verify-payment.ts` 実装済み。モックテストで動作確認。

### HIGH - Should fix during implementation

**H1: SDK `Transaction.digest` vs `txHash`/`txId` mapping** ✅ Confirmed
- `verifyPayment()` は `tx.digest === txHash` で照合（実装済み）

**H2: `broadcastTransaction` response** → testnet接続後に要確認

**H3: Nonce timing with payment flow** → testnet接続後に要確認

### MEDIUM - Warning only

**M1: `ethers` in both `dependencies` and `devDependencies`** → 継続監視

**M2: Hardcoded absolute pnpm paths in test files** → 既知の技術的負債

**M3: Authorization header regex limitations** → 低リスク（現在の値は安全）

**M4: `parseAuthorization` regex `(\w+)` ではなく `tx_id` のアンダースコア問題** → `txHash` 統一により解消

### NEW - Discovered during QA

**N1: `sanitize()` が文字 `r` を除去するバグ**
- File: `packages/core/src/www-authenticate.ts`
- `/["\\r\n]/g` regex が `r` をリテラル文字として除去している
- 例: `tokenAddress="0xTokenAddr..."` → `"0xTokenAdd..."` にサニタイズされる
- **影響**: tokenAddress 等に `r` を含む値が壊れる
- **回避策**: tokenAddress は hex-only 文字列（0-9, a-f のみ）を使用
- **修正**: `replace(/["\\r\n]/g, "")` → `replace(/["\\\r\n]/g, "")` が正解

---

## 3. Test Plan for Payment Mode

### 実施済み ✅

| ID | Test Case | 状態 |
|----|-----------|------|
| UP-1 | Valid txId + correct amount/recipient -> `{ valid: true }` | ✅ シナリオA |
| UP-2 | txId not found -> `{ valid: false, error: "Transaction not found..." }` | ✅ シナリオB |
| UP-3 | Recipient != serverAddress -> `{ valid: false }` | ✅ シナリオD |
| UP-4 | amount < expectedAmount -> `{ valid: false }` | ✅ シナリオC |
| UP-5 | Replay: same txId used twice -> second fails | ✅ シナリオE |
| UP-6 | Race condition: same txId parallel -> [200, 402] | ✅ シナリオF |
| IM-1 | No auth header -> 402 with WWW-Authenticate | ✅ シナリオA-1, 4 |
| IM-2 | Valid sig + valid txId -> 200 | ✅ シナリオA-3 |
| IM-3 | Valid sig + no txId -> 402 | ✅ シナリオB-1 |
| IM-4 | Valid sig + invalid txId -> 402 | ✅ シナリオB-2 |
| IM-5 | Invalid sig + valid txId -> 401 (sig check before payment) | ✅ 確認済み |

### 未実施（testnet要）

| ID | Test Case | 備考 |
|----|-----------|------|
| CL-1 | Full flow with real INTMAX transfer | testnet要 |
| CL-4 | INTMAX transfer failure propagation | testnet要 |
| UP-6 | TTL 24h expiry | 時間経過テスト |

---

## 5. Acceptance Criteria Checklist

- [x] `pnpm build` passes with no errors (all packages)
- [x] All existing identity mode tests pass (regression)
- [x] `verify-payment.ts` created with txId verification via fetchTransfers
- [x] Replay protection (used txId map with 24h TTL) implemented
- [x] Middleware payment mode uses `verifyPayment()` (real impl)
- [x] Payment mode mock E2E tests added and passing (14 tests)
- [x] Identity + payment mixed server tests added (scenario 15)
- [x] WWW-Authenticate full field validation (scenario 12)
- [x] txHash boundary value tests (scenario 13)
- [x] amount="0" edge case tests (scenario 14)
- [ ] Real testnet E2E (blocked by WSL2/validity-prover connection error)
- [ ] `examples/payment-demo/` tested on real testnet
