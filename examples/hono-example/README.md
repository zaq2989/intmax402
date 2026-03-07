# Hono Example

Demonstrates intmax402 with **Hono** — a lightweight, edge-compatible web framework. Use this as a starting point for Cloudflare Workers, Deno, Bun, or any edge runtime.

## What This Demo Shows

- `GET /free` — accessible without authentication
- `GET /premium` — protected with identity mode using `@tanakayuto/intmax402-hono`
- Type-safe access to `c.get('intmax402').address` via `Intmax402Env` generic

## Setup

```bash
# From the monorepo root:
pnpm install
pnpm build
```

## Run

```bash
cd examples/hono-example
INTMAX402_SECRET=hono-dev-secret node dist/index.js
```

Output:
```
Hono intmax402 example running on http://localhost:3763
```

## Test

```bash
# Free endpoint
curl http://localhost:3763/free
# → {"message":"free access"}

# Protected endpoint (returns 401 with challenge)
curl http://localhost:3763/premium
# → 401 with WWW-Authenticate header

# Test with CLI
intmax402 test http://localhost:3763/premium
```

## Key Code

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { intmax402, Intmax402Env } from '@tanakayuto/intmax402-hono'

const app = new Hono<Intmax402Env>()

app.get('/premium',
  intmax402({ mode: 'identity', secret: process.env.INTMAX402_SECRET! }),
  (c) => c.json({ address: c.get('intmax402').address })
)
```

## Edge Runtime Deployment

For Cloudflare Workers, replace `@hono/node-server` with `hono/cloudflare-workers`:

```typescript
import { Hono } from 'hono'
import { intmax402, Intmax402Env } from '@tanakayuto/intmax402-hono'

const app = new Hono<Intmax402Env>()
// ... routes ...

export default app
```

> ⚠️ Payment mode is not supported on edge runtimes (requires Node.js crypto APIs). Identity mode works everywhere.

## Related Docs

- [Identity Mode Guide](../../docs/identity-mode.md)
- [Getting Started](../../docs/getting-started.md)
