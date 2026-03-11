/**
 * intmax402 Express Payment Mode — Client
 *
 * Demonstrates automatic 402 payment handling using INTMAX402Client.
 *
 * Requires:
 *   CLIENT_PRIVATE_KEY - Ethereum private key for the paying client
 *   SERVER_URL         - Base URL of the server (default: http://localhost:3762)
 *   INTMAX_ENV         - 'mainnet' or 'testnet' (default: 'testnet')
 *
 * Fund your testnet wallet at: https://testnet.intmax.io
 * Fund your mainnet wallet at: https://app.intmax.io
 */

const { INTMAX402Client } = require('@tanakayuto/intmax402-client')
const { INTMAX402Error, INTMAX402_ERROR_CODES } = require('@tanakayuto/intmax402-core')

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3762'
const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY
const ENVIRONMENT = process.env.INTMAX_ENV || 'testnet'

if (!CLIENT_PRIVATE_KEY) {
  console.error('Error: CLIENT_PRIVATE_KEY environment variable is required')
  console.error('Generate one with: intmax402 keygen')
  process.exit(1)
}

async function main() {
  console.log(`Connecting to server: ${SERVER_URL}`)
  console.log(`Environment: ${ENVIRONMENT}`)
  console.log()

  // Create client
  const client = new INTMAX402Client({
    privateKey: CLIENT_PRIVATE_KEY,
    environment: ENVIRONMENT,
  })

  // Initialize INTMAX L2 payment capability
  console.log('Initializing INTMAX L2 wallet...')
  await client.initPayment()
  console.log(`Ethereum address : ${client.getAddress()}`)
  console.log(`INTMAX L2 address: ${client.getIntMaxAddress()}`)
  console.log()

  // --- Free endpoint (no authentication) ---
  console.log('=== GET /free (no auth) ===')
  const freeRes = await client.fetch(`${SERVER_URL}/free`)
  console.log(`Status: ${freeRes.status}`)
  console.log(`Body:   ${JSON.stringify(await freeRes.json())}`)
  console.log()

  // --- Payment-gated endpoint ---
  // The client handles the full flow automatically:
  //   1. GET /premium → 402 + payment challenge (nonce, serverAddress, amount)
  //   2. Send INTMAX L2 transfer to server's address
  //   3. GET /premium again with Authorization header (signature + txHash)
  //   4. Server verifies payment → 200
  console.log('=== GET /premium (payment mode) ===')
  console.log('Sending payment and proving ownership...')

  try {
    const premiumRes = await client.fetch(`${SERVER_URL}/premium`)
    console.log(`Status: ${premiumRes.status}`)
    console.log(`Body:   ${JSON.stringify(await premiumRes.json())}`)
  } catch (e) {
    if (e instanceof INTMAX402Error) {
      switch (e.code) {
        case INTMAX402_ERROR_CODES.INTMAX_NETWORK_UNAVAILABLE:
          console.error('INTMAX network is unavailable. Retry later.')
          break
        case INTMAX402_ERROR_CODES.INTMAX_BROADCAST_FAILED:
          console.error('Payment broadcast failed. Check your wallet balance.')
          break
        case INTMAX402_ERROR_CODES.PAYMENT_NOT_FOUND:
          console.error('Payment not found. The server could not verify the transfer.')
          break
        default:
          console.error(`INTMAX402 error [${e.code}]: ${e.message}`)
      }
    } else {
      throw e
    }
  }
}

main().catch(console.error)
