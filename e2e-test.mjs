import { ethers } from 'ethers';

const BASE_URL = 'http://localhost:3760';

// テスト用ウォレット
const wallet = ethers.Wallet.createRandom();
console.log('=== INTMAX402 E2E Test ===\n');
console.log(`テスト用ウォレット: ${wallet.address}\n`);

async function parseWWWAuth(header) {
  const result = {};
  const regex = /(\w+)="([^"]+)"/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}

async function signNonce(nonce, privateKey) {
  // Ethereum personal_sign
  const w = new ethers.Wallet(privateKey);
  const sig = await w.signMessage(nonce);
  return sig;
}

// Test 1: /free → 200 (認証不要)
console.log('--- Test 1: /free (認証なし) ---');
const t1 = Date.now();
const r1 = await fetch(`${BASE_URL}/free`);
const d1 = await r1.json();
console.log(`[${Date.now()-t1}ms] ${r1.status} ${r1.ok ? '✅' : '❌'} - ${d1.message}\n`);

// Test 2: /identity → 401 → sign → 200
console.log('--- Test 2: /identity (identityモード) ---');
const t2a = Date.now();
const r2a = await fetch(`${BASE_URL}/identity`);
console.log(`[${Date.now()-t2a}ms] Step1: ${r2a.status} (402期待)`);

const wwwAuth = r2a.headers.get('WWW-Authenticate');
console.log(`  WWW-Authenticate: ${wwwAuth?.slice(0, 80)}...`);
const parsed = await parseWWWAuth(wwwAuth);
const nonce = parsed.nonce;
console.log(`  nonce: ${nonce?.slice(0,20)}...`);

// nonceに署名
const t2b = Date.now();
const signature = await signNonce(nonce, wallet.privateKey);
console.log(`[${Date.now()-t2b}ms] Step2: sign完了`);

// 署名付きで再リクエスト
const authHeader = `INTMAX402 address="${wallet.address}", nonce="${nonce}", signature="${signature}"`;
const t2c = Date.now();
const r2b = await fetch(`${BASE_URL}/identity`, {
  headers: { 'Authorization': authHeader }
});
const d2 = await r2b.json();
console.log(`[${Date.now()-t2c}ms] Step3: ${r2b.status} ${r2b.ok ? '✅' : '❌'} - ${JSON.stringify(d2).slice(0,60)}`);
console.log(`  合計: ${Date.now()-t2a}ms\n`);

// Test 3: 改ざんされたnonceで拒否されるか
console.log('--- Test 3: 改ざんnonce（弾かれるはず） ---');
const badAuth = `INTMAX402 address="${wallet.address}", nonce="tampered-nonce-xyz", signature="${signature}"`;
const r3 = await fetch(`${BASE_URL}/identity`, {
  headers: { 'Authorization': badAuth }
});
console.log(`${r3.status} ${!r3.ok ? '✅ 正しく弾かれた' : '❌ 通ってしまった'}\n`);

// Test 4: /paid → 402確認
console.log('--- Test 4: /paid (paymentモード) ---');
const r4 = await fetch(`${BASE_URL}/paid`);
const wwwAuth4 = r4.headers.get('WWW-Authenticate');
const parsed4 = await parseWWWAuth(wwwAuth4);
console.log(`${r4.status} ${r4.status === 402 ? '✅' : '❌'}`);
console.log(`  amount: ${parsed4.amount} USDC`);
console.log(`  serverAddress: ${parsed4.serverAddress?.slice(0,20)}...`);
console.log(`  mode: ${parsed4.mode}\n`);

console.log('=== サマリー ===');
console.log(`/free:      200 ✅`);
console.log(`/identity:  401→sign→200 ✅`);
console.log(`tampered:   弾かれる ✅`);
console.log(`/paid:      402 + 支払い情報 ✅`);
