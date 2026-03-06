import { generateNonce, verifyNonce, parseAuthorization, INTMAX402Config } from "@tanakayuto/intmax402-core"
import { verifySignature } from "@tanakayuto/intmax402-express/dist/crypto"
import { verifyPayment } from "@tanakayuto/intmax402-express/dist/verify-payment"

export interface Intmax402Context {
  address: string
  verified: boolean
  txHash?: string
}

/**
 * Handle INTMAX402 authentication for any Web Standard fetch-based framework.
 * Returns null if auth passes (proceed to next handler).
 * Returns Response if auth fails (return this response to client).
 */
export async function handleIntmax402(
  request: Request,
  config: INTMAX402Config
): Promise<{ response: Response; context: null } | { response: null; context: Intmax402Context }> {
  const url = new URL(request.url)
  const authHeader = request.headers.get("authorization")
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"

  if (!authHeader) {
    const nonce = generateNonce(config.secret, ip, url.pathname, config.bindIp ?? false)
    const statusCode = config.mode === "payment" ? 402 : 401
    return {
      response: new Response(JSON.stringify({
        error: config.mode === "payment" ? "Payment Required" : "Unauthorized",
        protocol: "INTMAX402",
        mode: config.mode,
      }), {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": buildWWWAuthenticate(nonce, config),
        },
      }),
      context: null,
    }
  }

  const credential = parseAuthorization(authHeader)
  if (!credential) {
    return { response: errorResponse(401, "Invalid authorization header"), context: null }
  }

  if (!verifyNonce(credential.nonce, config.secret, ip, url.pathname, config.bindIp ?? false)) {
    return { response: errorResponse(401, "Invalid or expired nonce"), context: null }
  }

  if (config.allowList && config.allowList.length > 0) {
    if (!config.allowList.includes(credential.address.toLowerCase())) {
      return { response: errorResponse(403, "Address not in allow list"), context: null }
    }
  }

  const isValidSig = verifySignature(credential.signature, credential.nonce, credential.address)
  if (!isValidSig) {
    return { response: errorResponse(401, "Invalid signature"), context: null }
  }

  if (config.mode === "payment") {
    if (!credential.txHash) {
      return { response: errorResponse(402, "Payment transaction hash required"), context: null }
    }
    if (!config.serverAddress || !config.amount) {
      return { response: errorResponse(500, "Server misconfigured"), context: null }
    }
    const paymentResult = await verifyPayment(credential.txHash, config.amount, config.serverAddress)
    if (!paymentResult.valid) {
      return { response: errorResponse(402, paymentResult.error ?? "Payment verification failed"), context: null }
    }
  }

  return {
    response: null,
    context: { address: credential.address, verified: true, txHash: credential.txHash },
  }
}

function buildWWWAuthenticate(nonce: string, config: INTMAX402Config): string {
  let header = `INTMAX402 realm="intmax402", nonce="${nonce}", mode="${config.mode}"`
  if (config.serverAddress) header += `, serverAddress="${config.serverAddress}"`
  if (config.amount) header += `, amount="${config.amount}"`
  if (config.tokenAddress) header += `, tokenAddress="${config.tokenAddress}"`
  if (config.chainId) header += `, chainId="${config.chainId}"`
  return header
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
