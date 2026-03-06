import { Context, Next, MiddlewareHandler } from "hono"
import { INTMAX402Config, generateNonce, verifyNonce, parseAuthorization } from "@tanakayuto/intmax402-core"
import { verifySignature } from "@tanakayuto/intmax402-express/dist/crypto"
import { verifyPayment } from "@tanakayuto/intmax402-express/dist/verify-payment"

// Hono context に intmax402 情報を追加するための型
export type Intmax402Env = {
  Variables: {
    intmax402: {
      address: string
      verified: boolean
      txHash?: string
    }
  }
}

export function intmax402(config: INTMAX402Config): MiddlewareHandler<Intmax402Env> {
  return async (c: Context<Intmax402Env>, next: Next) => {
    const url = new URL(c.req.url)
    const authHeader = c.req.header("authorization")
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
      ?? c.req.header("x-real-ip")
      ?? "unknown"

    if (!authHeader) {
      const nonce = generateNonce(config.secret, ip, url.pathname, config.bindIp ?? false)
      const statusCode = config.mode === "payment" ? 402 : 401
      return c.json({
        error: config.mode === "payment" ? "Payment Required" : "Unauthorized",
        protocol: "INTMAX402",
        mode: config.mode,
      }, statusCode, {
        "WWW-Authenticate": buildWWWAuthenticate(nonce, config),
      })
    }

    const credential = parseAuthorization(authHeader)
    if (!credential) return c.json({ error: "Invalid authorization header" }, 401)

    if (!verifyNonce(credential.nonce, config.secret, ip, url.pathname, config.bindIp ?? false)) {
      return c.json({ error: "Invalid or expired nonce" }, 401)
    }

    if (config.allowList?.length) {
      if (!config.allowList.includes(credential.address.toLowerCase())) {
        return c.json({ error: "Address not in allow list" }, 403)
      }
    }

    const isValidSig = verifySignature(credential.signature, credential.nonce, credential.address)
    if (!isValidSig) return c.json({ error: "Invalid signature" }, 401)

    if (config.mode === "payment") {
      if (!credential.txHash) return c.json({ error: "Payment transaction hash required" }, 402)
      if (!config.serverAddress || !config.amount) return c.json({ error: "Server misconfigured" }, 500)
      const result = await verifyPayment(credential.txHash, config.amount, config.serverAddress)
      if (!result.valid) return c.json({ error: result.error ?? "Payment verification failed" }, 402)
    }

    c.set("intmax402", { address: credential.address, verified: true, txHash: credential.txHash })
    await next()
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
