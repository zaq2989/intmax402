# intmax402 Basic Express Example

Demonstrates HTTP 402 payment gate with Express.

## Setup

```bash
cd /path/to/intmax402
pnpm install
pnpm build
```

## Run

```bash
cd examples/basic-express
node dist/server.js
```

## Test

```bash
# Free endpoint
curl http://localhost:3760/free

# Identity-protected (returns 401 with challenge)
curl http://localhost:3760/identity

# Payment-protected (returns 402 with challenge)
curl http://localhost:3760/paid
```

## Using the CLI

```bash
intmax402 test http://localhost:3760/identity
```
