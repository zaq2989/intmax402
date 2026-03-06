/**
 * intmax402 ユースケーステスト
 * 
 * シナリオ1: AIエージェントがプレミアムAPIにアクセス
 * シナリオ2: 複数エージェントの並列アクセス
 * シナリオ3: 不正エージェントはブロック
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BASE = '/home/zaq/Projects/intmax402/node_modules/.pnpm';
const express = require(`${BASE}/express@4.22.1/node_modules/express`);
const { intmax402 } = require('/home/zaq/Projects/intmax402/packages/express/dist/index.js');
const { INTMAX402Client } = require('/home/zaq/Projects/intmax402/packages/client/dist/index.js');
const { ethers } = require(`${BASE}/ethers@6.16.0/node_modules/ethers/lib.commonjs/index.js`);

const SECRET = 'usecase-test-secret-2026';
const PORT = 3802;

// === サーバー起動 ===
const app = express();
app.use(express.json());

// エンドポイント1: AIニュースAPI（identity認証）
app.get('/api/news', intmax402({ mode: 'identity', secret: SECRET }),
  (req, res) => {
    res.json({
      news: [
        { title: 'GPT-6 released', score: 9.8 },
        { title: 'INTMAX raises $50M', score: 8.5 },
      ],
      accessedBy: req.intmax402?.address,
      timestamp: Date.now(),
    });
  }
);

// エンドポイント2: ホワイトリスト限定API
let whitelist = [];
app.get('/api/admin', intmax402({ mode: 'identity', secret: SECRET, allowList: whitelist }),
  (req, res) => res.json({ secret: 'classified', address: req.intmax402?.address })
);

// エンドポイント3: 無料エンドポイント
app.get('/api/free', (req, res) => res.json({ data: 'public data' }));

const server = app.listen(PORT);
await new Promise(r => setTimeout(r, 300));

console.log('='.repeat(50));
console.log('intmax402 ユースケーステスト');
console.log('='.repeat(50));

let pass = 0, fail = 0;
function ok(label) { console.log(`  ✅ ${label}`); pass++; }
function ng(label) { console.log(`  ❌ ${label}`); fail++; }

// === シナリオ1: AIエージェントの自動認証 ===
console.log('\n📡 シナリオ1: AIエージェントが自動認証してAPIを叩く\n');

const agent = new INTMAX402Client({
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  environment: 'testnet',
});
await agent.init();
console.log(`  Agent address: ${agent.getAddress()}`);

// 無料エンドポイント（認証不要）
const r1 = await agent.fetch(`http://localhost:${PORT}/api/free`);
const d1 = await r1.json();
r1.status === 200 ? ok(`/api/free → 200: "${d1.data}"`) : ng(`/api/free failed: ${r1.status}`);

// 認証必要なエンドポイント（自動ハンドリング）
const r2 = await agent.fetch(`http://localhost:${PORT}/api/news`);
const d2 = await r2.json();
if (r2.status === 200 && d2.accessedBy?.toLowerCase() === agent.getAddress().toLowerCase()) {
  ok(`/api/news → 200 (自動認証成功、${d2.news.length}件取得)`);
  ok(`  アドレス一致: ${d2.accessedBy.slice(0,20)}...`);
} else {
  ng(`/api/news failed: ${r2.status} ${JSON.stringify(d2)}`);
}

// === シナリオ2: 複数エージェントの並列アクセス ===
console.log('\n📡 シナリオ2: 3体のエージェントが並列アクセス\n');

const agents = [
  new INTMAX402Client({ privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' }),
  new INTMAX402Client({ privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' }),
  new INTMAX402Client({ privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' }),
];
for (const a of agents) await a.init();

const results = await Promise.all(
  agents.map(a => a.fetch(`http://localhost:${PORT}/api/news`).then(r => ({ status: r.status, addr: a.getAddress() })))
);
const allOk = results.every(r => r.status === 200);
allOk
  ? ok(`並列アクセス全成功: ${results.map(r => r.status).join(', ')}`)
  : ng(`並列アクセス一部失敗: ${JSON.stringify(results)}`);

// === シナリオ3: 不正エージェントのブロック ===
console.log('\n📡 シナリオ3: 不正アクセスのブロック\n');

// ケース3-1: 認証ヘッダーなし
const r3a = await fetch(`http://localhost:${PORT}/api/news`);
r3a.status === 401 ? ok(`認証なし → 401`) : ng(`認証なし → ${r3a.status} (想定外)`);

// ケース3-2: 偽署名
const r3b_challenge = await fetch(`http://localhost:${PORT}/api/news`);
const nonce = r3b_challenge.headers.get('www-authenticate')?.match(/nonce="([^"]+)"/)?.[1];
const fakeWallet = ethers.Wallet.createRandom();
const victimWallet = agents[0];
const fakeSig = await fakeWallet.signMessage(nonce);  // 別ウォレットで署名
const r3b = await fetch(`http://localhost:${PORT}/api/news`, {
  headers: { Authorization: `INTMAX402 address="${victimWallet.getAddress()}", nonce="${nonce}", signature="${fakeSig}"` }
});
r3b.status === 401 ? ok(`なりすまし攻撃 → 401 (ブロック)`) : ng(`なりすまし → ${r3b.status} (セキュリティホール!)`);

// ケース3-3: 期限切れnonce（古いタイムウィンドウ）
const oldNonce = 'a'.repeat(64); // 無効なnonce
const realSig = await agents[0]['wallet'].signMessage(oldNonce);
const r3c = await fetch(`http://localhost:${PORT}/api/news`, {
  headers: { Authorization: `INTMAX402 address="${agents[0].getAddress()}", nonce="${oldNonce}", signature="${realSig}"` }
});
r3c.status === 401 ? ok(`無効nonce → 401 (期限切れ)`) : ng(`無効nonce → ${r3c.status}`);

// === シナリオ4: Payment modeの基本フロー ===
console.log('\n📡 シナリオ4: Payment mode基本フロー\n');

// Payment modeエンドポイント追加（verifyPaymentのIntMaxNodeClientはテスト環境では未初期化なので、
// プロトコルレベルの検証のみ行う）
const SERVER_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';
const PAYMENT_PORT = 3803;
const payApp = express();
payApp.use(express.json());
payApp.get('/api/premium', intmax402({
  mode: 'payment',
  secret: SECRET,
  serverAddress: SERVER_ADDRESS,
  amount: '1000',
}), (req, res) => {
  res.json({
    content: 'premium data',
    paidBy: req.intmax402?.address,
    txHash: req.intmax402?.txHash,
  });
});
const payServer = payApp.listen(PAYMENT_PORT);
await new Promise(r => setTimeout(r, 300));

// ケース4-1: Payment modeは402を返す（401ではない）
const r4a = await fetch(`http://localhost:${PAYMENT_PORT}/api/premium`);
const d4a = await r4a.json();
if (r4a.status === 402 && d4a.mode === 'payment') {
  ok(`Payment mode → 402 (Payment Required)`);
} else {
  ng(`Payment mode → ${r4a.status} (想定外: ${JSON.stringify(d4a)})`);
}

// ケース4-2: WWW-Authenticateにpaymentパラメータが含まれる
const wwwAuth4 = r4a.headers.get('www-authenticate');
if (wwwAuth4?.includes('mode="payment"') && wwwAuth4?.includes(`serverAddress="${SERVER_ADDRESS}"`) && wwwAuth4?.includes('amount="1000"')) {
  ok(`WWW-Authenticate にpayment情報含む`);
} else {
  ng(`WWW-Authenticate 不正: ${wwwAuth4}`);
}

// ケース4-3: txHashなしでアクセス → 402
const nonce4 = wwwAuth4?.match(/nonce="([^"]+)"/)?.[1];
const sig4 = await agent.sign(nonce4);
const r4b = await fetch(`http://localhost:${PAYMENT_PORT}/api/premium`, {
  headers: { Authorization: `INTMAX402 address="${agent.getAddress()}", nonce="${nonce4}", signature="${sig4}"` }
});
const d4b = await r4b.json();
if (r4b.status === 402 && d4b.error?.includes('transaction hash required')) {
  ok(`txHashなし → 402 (Payment transaction hash required)`);
} else {
  ng(`txHashなし → ${r4b.status}: ${JSON.stringify(d4b)}`);
}

// ケース4-4: 偽txHashでアクセス → 402 (payment verification failed)
const r4c_challenge = await fetch(`http://localhost:${PAYMENT_PORT}/api/premium`);
const nonce4c = r4c_challenge.headers.get('www-authenticate')?.match(/nonce="([^"]+)"/)?.[1];
const sig4c = await agent.sign(nonce4c);
const r4c = await fetch(`http://localhost:${PAYMENT_PORT}/api/premium`, {
  headers: { Authorization: `INTMAX402 address="${agent.getAddress()}", nonce="${nonce4c}", signature="${sig4c}", txHash="0xfake1234567890"` }
});
const d4c = await r4c.json();
if (r4c.status === 402) {
  ok(`偽txHash → 402 (支払い検証失敗: ${d4c.error})`);
} else {
  ng(`偽txHash → ${r4c.status}: ${JSON.stringify(d4c)}`);
}

payServer.close();

// === シナリオ5: Identity modeリグレッション確認 ===
console.log('\n📡 シナリオ5: Identity modeリグレッション確認\n');

// 既存のidentity modeが壊れていないことを確認
const r5 = await agent.fetch(`http://localhost:${PORT}/api/news`);
const d5 = await r5.json();
if (r5.status === 200 && d5.accessedBy?.toLowerCase() === agent.getAddress().toLowerCase()) {
  ok(`Identity mode依然動作: /api/news → 200`);
} else {
  ng(`Identity modeリグレッション! ${r5.status} ${JSON.stringify(d5)}`);
}

// === 結果 ===
server.close();
console.log('\n' + '='.repeat(50));
console.log(`結果: ${pass} passed / ${fail} failed`);
console.log('='.repeat(50));
if (fail > 0) process.exit(1);
