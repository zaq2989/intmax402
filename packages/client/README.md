# @tanakayuto/intmax402-client

Client SDK for [intmax402](https://github.com/zaq2989/intmax402) — auto-handles 401/402 challenges, wallet signing, and INTMAX L2 payments.

## Install

```bash
npm install @tanakayuto/intmax402-client
```

## Usage

### Identity Mode (prove wallet ownership)

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

const client = new INTMAX402Client({
  privateKey: process.env.ETH_PRIVATE_KEY!,
})
await client.init()

// Automatically handles 401 → sign → retry
const response = await client.fetch('https://your-api.com/protected')
const data = await response.json()
```

### Payment Mode (INTMAX L2 micropayment)

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'

const client = new INTMAX402Client({
  privateKey: process.env.ETH_PRIVATE_KEY!,
  environment: 'mainnet', // or 'testnet'
})

// Initialize INTMAX L2 wallet (logs in, required for payment)
// Fund your wallet first: https://app.intmax.io (mainnet) or https://testnet.intmax.io (testnet)
await client.initPayment()

// Automatically handles 402 → pay → retry with txHash
const response = await client.fetch('https://your-api.com/api/premium')
const data = await response.json()
console.log(data) // { message: 'Payment verified!', txHash: '...' }
```

### Error Handling

```typescript
import { INTMAX402Client } from '@tanakayuto/intmax402-client'
import { INTMAX402Error, INTMAX402_ERROR_CODES } from '@tanakayuto/intmax402-core'

try {
  const response = await client.fetch(url)
} catch (e) {
  if (e instanceof INTMAX402Error) {
    switch (e.code) {
      case INTMAX402_ERROR_CODES.INTMAX_NETWORK_UNAVAILABLE:
        console.error('INTMAX network is down, retry later')
        break
      case INTMAX402_ERROR_CODES.INTMAX_BROADCAST_FAILED:
        console.error('Payment broadcast failed')
        break
      case INTMAX402_ERROR_CODES.MISSING_PRIVATE_KEY:
        console.error('Invalid or missing private key')
        break
    }
  }
}
```

## API Reference

### `new INTMAX402Client(options)`

| Option | Type | Required | Description |
|---|---|---|---|
| `privateKey` | `string` | ✅ | Ethereum private key (0x-prefixed, 32 bytes) |
| `environment` | `'mainnet' \| 'testnet'` | — | INTMAX network. Default: `'mainnet'` |
| `l1RpcUrl` | `string` | — | Custom L1 RPC URL override |

---

### `client.init()`

Initialize for **identity mode** (wallet signing only, no INTMAX network connection).

```typescript
await client.init()
```

---

### `client.initPayment(l1RpcUrl?)`

Initialize for **payment mode** — logs into INTMAX L2 network.  
Must be called before `client.fetch()` on a payment-gated endpoint.

```typescript
await client.initPayment()
// optional: override RPC URL
await client.initPayment('https://your-custom-rpc.example.com')
```

Throws `INTMAX402Error` with code `INTMAX_NETWORK_UNAVAILABLE` if login fails.

---

### `client.fetch(url, options?)`

Drop-in replacement for the global `fetch`. Automatically handles the full 401/402 challenge-response flow:

- **Identity mode:** `GET` → `401` + nonce → sign → `GET` with `Authorization` → `200`
- **Payment mode:** `GET` → `402` + payment challenge → pay + sign → `GET` with `Authorization` + `txHash` → `200`

```typescript
const response = await client.fetch('https://api.example.com/resource', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
})
```

Returns: `Promise<Response>`

---

### `client.isPaymentInitialized()`

Returns `true` if `initPayment()` has succeeded.

```typescript
if (!client.isPaymentInitialized()) {
  await client.initPayment()
}
```

---

### `client.getAddress()`

Returns the Ethereum wallet address (checksummed).

```typescript
const address = client.getAddress()
// => '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
```

---

### `client.getIntMaxAddress()`

Returns the INTMAX L2 address. Requires `initPayment()` to have been called first.

```typescript
const intmaxAddress = client.getIntMaxAddress()
```

Throws if called before `initPayment()`.

## Network

| Environment | L1 RPC | Notes |
|---|---|---|
| `mainnet` (default) | `https://api.rpc.intmax.io?network=ethereum` | Ethereum mainnet + Scroll |
| `testnet` | `https://sepolia.gateway.tenderly.co` | Sepolia + Scroll Sepolia |

## License

MIT
