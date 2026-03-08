# @tanakayuto/intmax402-fetch

Web標準の `Request`/`Response` で動く INTMAX402 認証アダプター。

Hono、Next.js、Cloudflare Workers など、すべての fetch ベースフレームワークで使える共通基盤です。

## インストール

```bash
npm install @tanakayuto/intmax402-fetch
```

## 使い方

### Cloudflare Workers

```typescript
import { handleIntmax402 } from "@tanakayuto/intmax402-fetch"

const config = {
  secret: process.env.INTMAX402_SECRET!,
  mode: "signature" as const,
}

export default {
  async fetch(request: Request): Promise<Response> {
    const result = await handleIntmax402(request, config)
    if (result.response) {
      // 認証失敗 → エラーレスポンスを返す
      return result.response
    }
    // 認証成功 → result.context にアドレス等が入る
    const { address } = result.context
    return new Response(`Hello, ${address}!`)
  },
}
```

### Hono

```typescript
import { Hono } from "hono"
import { handleIntmax402 } from "@tanakayuto/intmax402-fetch"

const app = new Hono()

const config = {
  secret: process.env.INTMAX402_SECRET!,
  mode: "signature" as const,
}

app.use("/protected/*", async (c, next) => {
  const result = await handleIntmax402(c.req.raw, config)
  if (result.response) {
    return result.response
  }
  c.set("intmax402", result.context)
  await next()
})

app.get("/protected/resource", (c) => {
  const ctx = c.get("intmax402")
  return c.json({ message: "Access granted", address: ctx.address })
})
```

### Next.js App Router (Middleware)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { handleIntmax402 } from "@tanakayuto/intmax402-fetch"

const config = {
  secret: process.env.INTMAX402_SECRET!,
  mode: "payment" as const,
  serverAddress: process.env.SERVER_ADDRESS!,
  amount: process.env.PAYMENT_AMOUNT!,
}

export async function middleware(request: NextRequest) {
  const result = await handleIntmax402(request, config)
  if (result.response) {
    return result.response
  }
  // 認証成功 → ヘッダーにアドレスを追加して続行
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-intmax402-address", result.context.address)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: "/api/protected/:path*",
}
```

## API

### `handleIntmax402(request, config)`

**パラメータ:**
- `request: Request` — Web標準の Request オブジェクト
- `config: INTMAX402Config` — 認証設定

**戻り値:**
- 認証失敗時: `{ response: Response, context: null }` — このレスポンスをクライアントに返す
- 認証成功時: `{ response: null, context: Intmax402Context }` — 次のハンドラに進む

### `Intmax402Context`

```typescript
interface Intmax402Context {
  address: string   // 認証済みウォレットアドレス
  verified: boolean // 常に true
  txHash?: string   // payment モード時のトランザクションハッシュ
}
```

## Network / ネットワーク

intmax402-fetch は **Ethereum mainnet**（INTMAX ZK L2 on Scroll）をデフォルトで使用します。開発時は `environment: "testnet"` を指定してください。

| Environment | Network | L1 Chain ID |
|---|---|---|
| `mainnet` (default) | Ethereum + Scroll | `1` |
| `testnet` | Sepolia + Scroll Sepolia | `11155111` |

## ライセンス

MIT

## ⚠️ IP Binding Warning
When using `bindIp: true`, ensure your server is behind a trusted reverse proxy (Nginx, Cloudflare, etc.).
Direct exposure allows attackers to forge `X-Forwarded-For` headers, bypassing IP binding.
Default (`bindIp: false`) is recommended for AI agent use cases.
