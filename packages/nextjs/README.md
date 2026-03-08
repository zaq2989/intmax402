# @tanakayuto/intmax402-nextjs

INTMAX402 authentication middleware for Next.js App Router.

## Installation

```bash
npm install @tanakayuto/intmax402-nextjs
# or
pnpm add @tanakayuto/intmax402-nextjs
```

## Usage

### `withIntmax402` — Route Handler wrapper

Wrap individual route handlers to protect them with INTMAX402 authentication.

```typescript
// app/api/premium/route.ts
import { withIntmax402 } from '@tanakayuto/intmax402-nextjs'

export const GET = withIntmax402(
  async (req) => {
    return Response.json({
      data: 'premium content',
      address: req.intmax402.address,
    })
  },
  {
    secret: process.env.INTMAX402_SECRET!,
    mode: 'identity',
  }
)
```

#### Payment mode

```typescript
export const GET = withIntmax402(
  async (req) => {
    return Response.json({ data: 'paid content', address: req.intmax402.address })
  },
  {
    secret: process.env.INTMAX402_SECRET!,
    mode: 'payment',
    serverAddress: process.env.INTMAX_SERVER_ADDRESS!,
    amount: '0.001',
  }
)
```

### `intmax402Middleware` — Next.js middleware.ts

Protect entire route groups at the middleware level (Edge Runtime compatible).

```typescript
// middleware.ts
import { intmax402Middleware } from '@tanakayuto/intmax402-nextjs'

export default intmax402Middleware({
  secret: process.env.INTMAX402_SECRET!,
  mode: 'identity',
  matcher: ['/api/premium/:path*'],
})

export const config = {
  matcher: ['/api/premium/:path*'],
}
```

> **Note:** The middleware runs on Edge Runtime and performs full signature verification.
> Authenticated address is forwarded to route handlers via the `x-intmax402-address` header.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `INTMAX402_SECRET` | HMAC secret for nonce generation | ✅ |
| `INTMAX_SERVER_ADDRESS` | Your INTMAX server address (payment mode) | Payment only |

## How it works

1. Client makes a request without `Authorization` header
2. Server responds with `401`/`402` + `WWW-Authenticate: INTMAX402 nonce=<nonce>, ...`
3. Client signs the nonce with their Ethereum wallet
4. Client retries with `Authorization: INTMAX402 address=<addr>,nonce=<nonce>,signature=<sig>`
5. Server verifies signature and grants access

## Network

intmax402-nextjs operates on **Ethereum mainnet** by default (via INTMAX ZK L2 on Scroll). Pass `environment: "testnet"` for development against Sepolia.

| Environment | Network | L1 Chain ID |
|---|---|---|
| `mainnet` (default) | Ethereum + Scroll | `1` |
| `testnet` | Sepolia + Scroll Sepolia | `11155111` |

## License

MIT
