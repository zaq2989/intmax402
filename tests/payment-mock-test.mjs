/**
 * intmax402 Payment Mode モック統合テスト
 *
 * testnet不要。intmax2-server-SDKをモックして
 * payment modeの完全なE2Eフローをテストする。
 *
 * シナリオA: 正常payment flow (402→transfer→認証成功)
 * シナリオB: 無効txHash → 402
 * シナリオC: 金額不足 → 402
 * シナリオD: 受取人アドレス不一致 → 402
 * シナリオE: txHash再利用（リプレイ攻撃）→ 402
 * シナリオF: 並列リクエスト（race condition防止）
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BASE = '/home/zaq/Projects/intmax402/node_modules/.pnpm';
const express = require(`${BASE}/express@4.22.1/node_modules/express`);
const { ethers } = require(`${BASE}/ethers@6.16.0/node_modules/ethers/lib.commonjs/index.js`);

// ======================================================================
// モックセットアップ
// verify-payment.jsをrequireしてから、そのexportsを書き換える。
// middleware.jsは同じexportsオブジェクトを参照するため、モックが有効になる。
// ======================================================================

const VERIFY_PAYMENT_PATH = '/home/zaq/Projects/intmax402/packages/express/dist/verify-payment.js';
const verifyPaymentModule = require(VERIFY_PAYMENT_PATH);

const SERVER_ADDRESS = '0xdeadbeefcafebabe1234567890abcdef12345678';
const REQUIRED_AMOUNT = '1000';
const PORT = 3850;

// モック用の有効txHashテーブル
const VALID_TX_HASH_EXACT  = '0x' + 'a'.repeat(64); // 66文字
const VALID_TX_HASH_EXTRA  = '0x' + 'b'.repeat(64); // 金額多め
const INVALID_TX_HASH      = '0x' + 'f'.repeat(64); // 存在しない
const LOW_AMOUNT_TX_HASH   = '0x' + 'c'.repeat(64); // 金額不足
const WRONG_ADDR_TX_HASH   = '0x' + 'd'.repeat(64); // 受取人不一致

// モック転送データ
const mockTransferDB = new Map([
  [VALID_TX_HASH_EXACT, { digest: VALID_TX_HASH_EXACT, amount: '1000', to: SERVER_ADDRESS }],
  [VALID_TX_HASH_EXTRA, { digest: VALID_TX_HASH_EXTRA, amount: '9999', to: SERVER_ADDRESS }],
  [LOW_AMOUNT_TX_HASH,  { digest: LOW_AMOUNT_TX_HASH,  amount: '100',  to: SERVER_ADDRESS }],
  [WRONG_ADDR_TX_HASH,  { digest: WRONG_ADDR_TX_HASH,  amount: '1000', to: '0x0000000000000000000000000000000000000000' }],
]);

// リプレイ防止用セット（テスト間でreset可能）
const mockUsedHashes = new Set();

// モックverifyPayment（race condition対応のためPENDINGマップを使用）
const PENDING = Symbol('PENDING');
const pendingMap = new Map();

async function mockVerifyPayment(txHash, expectedAmount, serverAddress) {
  // リプレイ防止
  if (mockUsedHashes.has(txHash)) {
    return { valid: false, error: 'Transaction already used' };
  }
  // Race condition対応: PENDINGチェック
  if (pendingMap.has(txHash)) {
    return { valid: false, error: 'Transaction already used' };
  }
  pendingMap.set(txHash, PENDING);

  try {
    // 非同期処理をシミュレート（実際のSDKは非同期）
    await new Promise(r => setTimeout(r, 5));

    const tx = mockTransferDB.get(txHash);
    if (!tx) {
      return { valid: false, error: 'Transaction not found in recent transfers' };
    }
    if (tx.to.toLowerCase() !== serverAddress.toLowerCase()) {
      return { valid: false, error: 'Recipient does not match server address' };
    }
    if (BigInt(tx.amount) < BigInt(expectedAmount)) {
      return { valid: false, error: `Amount mismatch: expected ${expectedAmount}, got ${tx.amount}` };
    }

    mockUsedHashes.add(txHash);
    return { valid: true };
  } finally {
    pendingMap.delete(txHash);
  }
}

// verify-payment.jsのexportsをモックで上書き
verifyPaymentModule.verifyPayment = mockVerifyPayment;
// clientプロパティ（未初期化チェック回避のため）は不要（mockは直接呼ばれる）

// middleware.jsをrequire（既にverify-payment.jsはモック済み）
const { intmax402 } = require('/home/zaq/Projects/intmax402/packages/express/dist/index.js');

// ======================================================================
// テストサーバー起動
// ======================================================================

const SECRET = 'payment-mock-test-secret-2026';

const app = express();
app.use(express.json());

// Payment modeエンドポイント
app.get('/api/premium', intmax402({
  mode: 'payment',
  secret: SECRET,
  serverAddress: SERVER_ADDRESS,
  amount: REQUIRED_AMOUNT,
}), (req, res) => {
  res.json({
    content: 'premium content',
    paidBy: req.intmax402?.address,
    txHash: req.intmax402?.txHash,
  });
});

const server = app.listen(PORT);
await new Promise(r => setTimeout(r, 200));

// ======================================================================
// テストユーティリティ
// ======================================================================

const wallet = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

let pass = 0, fail = 0;
function ok(label)  { console.log(`  ✅ ${label}`); pass++; }
function ng(label)  { console.log(`  ❌ ${label}`); fail++; }

async function getNonce() {
  const r = await fetch(`http://localhost:${PORT}/api/premium`);
  const wwwAuth = r.headers.get('www-authenticate');
  const nonce = wwwAuth?.match(/nonce="([^"]+)"/)?.[1];
  return { nonce, wwwAuth, status: r.status };
}

async function makeAuthHeader(nonce, txHash = null) {
  const sig = await wallet.signMessage(nonce);
  let header = `INTMAX402 address="${wallet.address}", nonce="${nonce}", signature="${sig}"`;
  if (txHash) header += `, txHash="${txHash}"`;
  return header;
}

async function requestWithAuth(nonce, txHash = null) {
  const auth = await makeAuthHeader(nonce, txHash);
  return fetch(`http://localhost:${PORT}/api/premium`, {
    headers: { Authorization: auth },
  });
}

// ======================================================================
// テスト実行
// ======================================================================

console.log('='.repeat(60));
console.log('intmax402 Payment Mode モック統合テスト');
console.log('='.repeat(60));

// ──────────────────────────────────────────────────────────
// シナリオA: 正常payment flow (402 → transfer → 認証成功)
// ──────────────────────────────────────────────────────────
console.log('\n📡 シナリオA: 正常payment flow\n');

// A-1: 認証なし → 402
const rA1 = await fetch(`http://localhost:${PORT}/api/premium`);
const dA1 = await rA1.json();
if (rA1.status === 402 && dA1.mode === 'payment') {
  ok('A-1: 認証なし → 402 Payment Required');
} else {
  ng(`A-1: 認証なし → ${rA1.status} ${JSON.stringify(dA1)}`);
}

// A-2: WWW-Authenticateに必須フィールドが含まれる
const wwwA = rA1.headers.get('www-authenticate');
if (wwwA?.includes('mode="payment"') &&
    wwwA?.includes(`serverAddress="${SERVER_ADDRESS}"`) &&
    wwwA?.includes(`amount="${REQUIRED_AMOUNT}"`) &&
    wwwA?.includes('nonce=')) {
  ok(`A-2: WWW-Authenticate に全フィールド含む: ${wwwA.slice(0, 80)}...`);
} else {
  ng(`A-2: WWW-Authenticate 不正: ${wwwA}`);
}

// A-3: 有効txHashで認証 → 200
{
  const { nonce } = await getNonce();
  mockUsedHashes.clear();
  const rA3 = await requestWithAuth(nonce, VALID_TX_HASH_EXACT);
  const dA3 = await rA3.json();
  if (rA3.status === 200 && dA3.content === 'premium content' && dA3.txHash === VALID_TX_HASH_EXACT) {
    ok(`A-3: 有効txHash + 正しい金額 → 200 (txHash確認済み)`);
  } else {
    ng(`A-3: 有効txHash → ${rA3.status}: ${JSON.stringify(dA3)}`);
  }
}

// A-4: 金額多めの有効txHash → 200 (>=検証)
{
  const { nonce } = await getNonce();
  const rA4 = await requestWithAuth(nonce, VALID_TX_HASH_EXTRA);
  const dA4 = await rA4.json();
  rA4.status === 200
    ? ok('A-4: 金額多め(9999 >= 1000) → 200 (>=検証OK)')
    : ng(`A-4: 金額多め → ${rA4.status}: ${JSON.stringify(dA4)}`);
}

// ──────────────────────────────────────────────────────────
// シナリオB: 無効txHash → 402
// ──────────────────────────────────────────────────────────
console.log('\n📡 シナリオB: 無効txHash\n');

// B-1: txHashなし → 402 "Payment transaction hash required"
{
  const { nonce } = await getNonce();
  const rB1 = await requestWithAuth(nonce, null);  // txHashなし
  const dB1 = await rB1.json();
  if (rB1.status === 402 && dB1.error?.includes('transaction hash required')) {
    ok(`B-1: txHashなし → 402 (${dB1.error})`);
  } else {
    ng(`B-1: txHashなし → ${rB1.status}: ${JSON.stringify(dB1)}`);
  }
}

// B-2: 存在しないtxHash → 402 "Transaction not found"
{
  const { nonce } = await getNonce();
  const rB2 = await requestWithAuth(nonce, INVALID_TX_HASH);
  const dB2 = await rB2.json();
  if (rB2.status === 402 && dB2.error?.includes('Transaction not found')) {
    ok(`B-2: 存在しないtxHash → 402 (${dB2.error})`);
  } else {
    ng(`B-2: 存在しないtxHash → ${rB2.status}: ${JSON.stringify(dB2)}`);
  }
}

// B-3: 長すぎるtxHash（129文字 > 128文字制限）→ 401 parseAuthorization失敗
{
  const { nonce } = await getNonce();
  const longTxHash = '0x' + 'a'.repeat(127); // 129文字
  const rB3 = await requestWithAuth(nonce, longTxHash);
  rB3.status === 401
    ? ok('B-3: txHash長すぎ(129chars) → 401 (parse失敗)')
    : ng(`B-3: txHash長すぎ → ${rB3.status}`);
}

// ──────────────────────────────────────────────────────────
// シナリオC: 金額不足 → 402
// ──────────────────────────────────────────────────────────
console.log('\n📡 シナリオC: 金額不足\n');

{
  const { nonce } = await getNonce();
  const rC = await requestWithAuth(nonce, LOW_AMOUNT_TX_HASH);
  const dC = await rC.json();
  if (rC.status === 402 && dC.error?.includes('Amount mismatch')) {
    ok(`C-1: 金額不足(100 < 1000) → 402 (${dC.error})`);
  } else {
    ng(`C-1: 金額不足 → ${rC.status}: ${JSON.stringify(dC)}`);
  }
}

// ──────────────────────────────────────────────────────────
// シナリオD: 受取人アドレス不一致 → 402
// ──────────────────────────────────────────────────────────
console.log('\n📡 シナリオD: 受取人アドレス不一致\n');

{
  const { nonce } = await getNonce();
  const rD = await requestWithAuth(nonce, WRONG_ADDR_TX_HASH);
  const dD = await rD.json();
  if (rD.status === 402 && dD.error?.includes('Recipient does not match')) {
    ok(`D-1: 受取人不一致 → 402 (${dD.error})`);
  } else {
    ng(`D-1: 受取人不一致 → ${rD.status}: ${JSON.stringify(dD)}`);
  }
}

// ──────────────────────────────────────────────────────────
// シナリオE: txHash再利用（リプレイ攻撃）→ 402
// ──────────────────────────────────────────────────────────
console.log('\n📡 シナリオE: リプレイ攻撃防止\n');

const REPLAY_TX_HASH = '0x' + 'e'.repeat(64);
mockTransferDB.set(REPLAY_TX_HASH, { digest: REPLAY_TX_HASH, amount: '1000', to: SERVER_ADDRESS });

// E-1: 1回目 → 200
{
  const { nonce } = await getNonce();
  const rE1 = await requestWithAuth(nonce, REPLAY_TX_HASH);
  const dE1 = await rE1.json();
  rE1.status === 200
    ? ok('E-1: 1回目のtxHash使用 → 200')
    : ng(`E-1: 1回目 → ${rE1.status}: ${JSON.stringify(dE1)}`);
}

// E-2: 同じtxHashで再利用 → 402
{
  const { nonce } = await getNonce();
  const rE2 = await requestWithAuth(nonce, REPLAY_TX_HASH);
  const dE2 = await rE2.json();
  if (rE2.status === 402 && dE2.error?.includes('already used')) {
    ok(`E-2: txHash再利用 → 402 (${dE2.error})`);
  } else {
    ng(`E-2: txHash再利用 → ${rE2.status}: ${JSON.stringify(dE2)}`);
  }
}

// E-3: 異なるtxHashは通る（リセット不要）
{
  const { nonce } = await getNonce();
  const rE3 = await requestWithAuth(nonce, VALID_TX_HASH_EXTRA);
  // VALID_TX_HASH_EXTRAは既にA-4で使われているため再利用チェック
  // 新しいtxHashを使う
  const freshTxHash = '0x' + '9'.repeat(64);
  mockTransferDB.set(freshTxHash, { digest: freshTxHash, amount: '5000', to: SERVER_ADDRESS });
  const { nonce: nonce2 } = await getNonce();
  const rE3b = await requestWithAuth(nonce2, freshTxHash);
  rE3b.status === 200
    ? ok('E-3: 新しいtxHashは通る → 200 (リプレイ防止は個別txHash単位)')
    : ng(`E-3: 新しいtxHash → ${rE3b.status}`);
}

// ──────────────────────────────────────────────────────────
// シナリオF: 並列リクエスト（race condition防止）
// ──────────────────────────────────────────────────────────
console.log('\n📡 シナリオF: 並列リクエスト\n');

// F-1: 同一txHashで並列リクエスト → 1つ成功、1つ失敗（リプレイ防止）
const RACE_TX_HASH = '0x' + '7'.repeat(64);
mockTransferDB.set(RACE_TX_HASH, { digest: RACE_TX_HASH, amount: '1000', to: SERVER_ADDRESS });

const [nonceF1a, nonceF1b] = await Promise.all([getNonce(), getNonce()]);
const [rF1a, rF1b] = await Promise.all([
  requestWithAuth(nonceF1a.nonce, RACE_TX_HASH),
  requestWithAuth(nonceF1b.nonce, RACE_TX_HASH),
]);
const statusF1 = [rF1a.status, rF1b.status].sort();
// 1つは200、1つは402になるべき（race condition対応）
if (statusF1[0] === 200 && statusF1[1] === 402) {
  ok(`F-1: 同一txHash並列 → [200, 402] (race condition防止OK)`);
} else if (statusF1[0] === 200 && statusF1[1] === 200) {
  ng(`F-1: 同一txHash並列 → [200, 200] (リプレイ攻撃が通った!)`);
} else {
  // どちらも失敗の場合も記録
  ng(`F-1: 同一txHash並列 → ${JSON.stringify(statusF1)} (想定外)`);
}

// F-2: 異なるtxHashで並列リクエスト → 全成功
const TX_F2A = '0x' + '4'.repeat(64);
const TX_F2B = '0x' + '5'.repeat(64);
const TX_F2C = '0x' + '6'.repeat(64);
mockTransferDB.set(TX_F2A, { digest: TX_F2A, amount: '1000', to: SERVER_ADDRESS });
mockTransferDB.set(TX_F2B, { digest: TX_F2B, amount: '1000', to: SERVER_ADDRESS });
mockTransferDB.set(TX_F2C, { digest: TX_F2C, amount: '1000', to: SERVER_ADDRESS });

const [{ nonce: nF2a }, { nonce: nF2b }, { nonce: nF2c }] = await Promise.all([
  getNonce(), getNonce(), getNonce()
]);
const [rF2a, rF2b, rF2c] = await Promise.all([
  requestWithAuth(nF2a, TX_F2A),
  requestWithAuth(nF2b, TX_F2B),
  requestWithAuth(nF2c, TX_F2C),
]);
const allF2Ok = [rF2a.status, rF2b.status, rF2c.status].every(s => s === 200);
allF2Ok
  ? ok(`F-2: 異なるtxHash並列3件 → 全200 (race condition なし)`)
  : ng(`F-2: 異なるtxHash並列 → ${[rF2a.status, rF2b.status, rF2c.status].join(', ')}`);

// ======================================================================
// 結果
// ======================================================================

server.close();
console.log('\n' + '='.repeat(60));
console.log(`結果: ${pass} passed / ${fail} failed`);
console.log('='.repeat(60));
if (fail > 0) process.exit(1);
