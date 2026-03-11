/**
 * intmax402 Express Payment Mode — Server
 *
 * Requires:
 *   INTMAX402_SECRET   - HMAC secret for nonce generation
 *   ETH_PRIVATE_KEY    - Ethereum private key (for INTMAX payment verification)
 *   INTMAX_ADDRESS     - Your INTMAX L2 receiving address (optional, auto-derived)
 *   INTMAX_ENV         - 'mainnet' or 'testnet' (default: 'testnet')
 *   PORT               - HTTP port (default: 3762)
 */

const express = require('express')
const { intmax402 } = require('@tanakayuto/intmax402-express')

const PORT = Number(process.env.PORT) || 3762
const SECRET = process.env.INTMAX402_SECRET
const ETH_PRIVATE_KEY = process.env.ETH_PRIVATE_KEY
const INTMAX_ADDRESS = process.env.INTMAX_ADDRESS
const ENVIRONMENT = process.env.INTMAX_ENV || 'testnet'

if (!SECRET) {
  console.error('Error: INTMAX402_SECRET environment variable is required')
  process.exit(1)
}
if (!ETH_PRIVATE_KEY) {
  console.error('Error: ETH_PRIVATE_KEY environment variable is required')
  console.error('Generate one with: intmax402 keygen')
  process.exit(1)
}

const app = express()
app.use(express.json())

// Free endpoint — no authentication required
app.get('/free', (_req, res) => {
  res.json({ message: 'Free endpoint — no payment required' })
})

// Payment-gated endpoint
// Flow: GET /premium → 402 with challenge → client pays → GET /premium with proof → 200
app.get(
  '/premium',
  intmax402({
    mode: 'payment',
    secret: SECRET,
    serverAddress: INTMAX_ADDRESS, // optional: auto-derived from ETH_PRIVATE_KEY if omitted
    amount: '1000',                // payment amount in token smallest unit (very small for testing)
    environment: ENVIRONMENT,
    ethPrivateKey: ETH_PRIVATE_KEY, // auto-initializes INTMAX payment verifier (v0.3.1+)
  }),
  (req, res) => {
    res.json({
      message: 'Payment verified! Here is your premium content.',
      paidBy: req.intmax402?.address,
      txHash: req.intmax402?.txHash,
      timestamp: new Date().toISOString(),
    })
  }
)

app.listen(PORT, () => {
  console.log(`intmax402 express-payment server running on http://localhost:${PORT}`)
  console.log(`Environment: ${ENVIRONMENT}`)
  console.log()
  console.log('Endpoints:')
  console.log(`  GET http://localhost:${PORT}/free    — no authentication`)
  console.log(`  GET http://localhost:${PORT}/premium — requires INTMAX payment`)
  console.log()
  console.log('Run the client in another terminal:')
  console.log('  node client.js')
})
