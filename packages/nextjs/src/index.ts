import { handleIntmax402 } from "@tanakayuto/intmax402-fetch"
import { INTMAX402Config, buildWWWAuthenticate } from "@tanakayuto/intmax402-core"
import { ethers } from "ethers"

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface Intmax402Info {
  address: string
  verified: boolean
  txHash?: string
}

/** Extended Request type that carries intmax402 context after successful auth */
export interface Intmax402Request extends Request {
  intmax402: Intmax402Info
}

export interface WithIntmax402Options extends INTMAX402Config {
  // verifyPayment override for custom payment verification (payment mode)
  verifyPayment?: (txHash: string, amount: string, serverAddress: string) => Promise<{ valid: boolean; error?: string }>
}

export interface MiddlewareOptions extends Omit<INTMAX402Config, "mode"> {
  mode?: INTMAX402Config["mode"]
  /** Path patterns to intercept. Matched against request.nextUrl.pathname */
  matcher?: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Edge-compatible utilities (Web Crypto API — no Node.js crypto)
// ──────────────────────────────────────────────────────────────────────────────

const WINDOW_MS = 30_000

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function generateNonceEdge(
  secret: string,
  ip: string,
  path: string,
  bindIp = false
): Promise<string> {
  const window = Math.floor(Date.now() / WINDOW_MS)
  const data = bindIp ? `${window}:${ip}:${path}` : `${window}:${path}`
  return hmacHex(secret, data)
}

async function verifyNonceEdge(
  nonce: string,
  secret: string,
  ip: string,
  path: string,
  bindIp = false
): Promise<boolean> {
  if (!/^[0-9a-f]+$/i.test(nonce)) return false
  const window = Math.floor(Date.now() / WINDOW_MS)
  for (const w of [window, window - 1]) {
    const data = bindIp ? `${w}:${ip}:${path}` : `${w}:${path}`
    const expected = await hmacHex(secret, data)
    if (expected === nonce) return true
  }
  return false
}

function verifySignatureEdge(signature: string, message: string, claimedAddress: string): boolean {
  try {
    const recovered = ethers.verifyMessage(message, signature)
    return recovered.toLowerCase() === claimedAddress.toLowerCase()
  } catch {
    return false
  }
}

function parseAuthorizationEdge(header: string): { address: string; nonce: string; signature: string; txHash?: string } | null {
  // Format: INTMAX402 address=<addr>,nonce=<nonce>,signature=<sig>[,txHash=<hash>]
  const match = header.match(/^INTMAX402\s+(.+)$/i)
  if (!match) return null
  const params: Record<string, string> = {}
  for (const part of match[1].split(",")) {
    const eq = part.indexOf("=")
    if (eq === -1) continue
    const k = part.slice(0, eq).trim()
    const v = part.slice(eq + 1).trim()
    params[k] = v
  }
  if (!params.address || !params.nonce || !params.signature) return null
  return {
    address: params.address,
    nonce: params.nonce,
    signature: params.signature,
    txHash: params.txHash,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// withIntmax402 — Route Handler wrapper (Node.js runtime)
// ──────────────────────────────────────────────────────────────────────────────

type NextRouteHandler = (req: Request, ctx?: unknown) => Promise<Response> | Response
type AuthedRouteHandler = (req: Intmax402Request, ctx?: unknown) => Promise<Response> | Response

/**
 * Wraps a Next.js App Router Route Handler with INTMAX402 authentication.
 *
 * @example
 * // app/api/premium/route.ts
 * import { withIntmax402 } from '@tanakayuto/intmax402-nextjs'
 *
 * export const GET = withIntmax402(
 *   async (req) => {
 *     return Response.json({ data: 'premium content', address: req.intmax402.address })
 *   },
 *   { secret: process.env.INTMAX402_SECRET!, mode: 'identity' }
 * )
 */
export function withIntmax402(
  handler: AuthedRouteHandler,
  options: WithIntmax402Options
): NextRouteHandler {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    const config: INTMAX402Config = {
      mode: options.mode,
      secret: options.secret,
      serverAddress: options.serverAddress,
      amount: options.amount,
      tokenAddress: options.tokenAddress,
      chainId: options.chainId,
      environment: options.environment,
      allowList: options.allowList,
      bindIp: options.bindIp,
      l1RpcUrl: options.l1RpcUrl,
      ethPrivateKey: options.ethPrivateKey,
    }

    const result = await handleIntmax402(req, config)

    if (result.response !== null) {
      return result.response
    }

    // Attach auth context to request (cast to extended type)
    const authedReq = req as Intmax402Request
    authedReq.intmax402 = result.context!

    return handler(authedReq, ctx)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// intmax402Middleware — Next.js middleware.ts (Edge Runtime compatible)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns a Next.js middleware function for INTMAX402 authentication.
 * Compatible with Edge Runtime.
 *
 * @example
 * // middleware.ts
 * import { intmax402Middleware } from '@tanakayuto/intmax402-nextjs'
 *
 * export default intmax402Middleware({
 *   secret: process.env.INTMAX402_SECRET!,
 *   mode: 'identity',
 *   matcher: ['/api/premium'],
 * })
 *
 * export const config = { matcher: ['/api/premium/:path*'] }
 */
export function intmax402Middleware(options: MiddlewareOptions) {
  const mode = options.mode ?? "identity"
  const config: INTMAX402Config = { ...options, mode }

  return async function middleware(request: Request): Promise<Response> {
    // Dynamic import of NextResponse to avoid bundling issues in non-Next environments
    const { NextResponse } = await import("next/server")

    const url = new URL(request.url)
    const pathname = url.pathname

    // Path matching
    if (options.matcher && options.matcher.length > 0) {
      const matched = options.matcher.some((pattern) => matchPath(pattern, pathname))
      if (!matched) {
        return NextResponse.next()
      }
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      // Generate challenge nonce (Edge-compatible)
      const nonce = await generateNonceEdge(config.secret, ip, pathname, config.bindIp ?? false)
      const statusCode = mode === "payment" ? 402 : 401
      return new Response(
        JSON.stringify({
          error: mode === "payment" ? "Payment Required" : "Unauthorized",
          protocol: "INTMAX402",
          mode,
        }),
        {
          status: statusCode,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": buildWWWAuthenticate(nonce, config),
          },
        }
      )
    }

    // Verify the authorization header
    const credential = parseAuthorizationEdge(authHeader)
    if (!credential) {
      return edgeError(401, "Invalid authorization header")
    }

    const nonceValid = await verifyNonceEdge(
      credential.nonce,
      config.secret,
      ip,
      pathname,
      config.bindIp ?? false
    )
    if (!nonceValid) {
      return edgeError(401, "Invalid or expired nonce")
    }

    if (config.allowList && config.allowList.length > 0) {
      const normalized = config.allowList.map((a) => a.toLowerCase())
      if (!normalized.includes(credential.address.toLowerCase())) {
        return edgeError(403, "Address not in allow list")
      }
    }

    const sigValid = verifySignatureEdge(credential.signature, credential.nonce, credential.address)
    if (!sigValid) {
      return edgeError(401, "Invalid signature")
    }

    // For payment mode in middleware, we skip on-chain verification (do it in route handler)
    // Pass auth info downstream via headers
    const response = NextResponse.next()
    response.headers.set("x-intmax402-address", credential.address)
    response.headers.set("x-intmax402-verified", "true")
    if (credential.txHash) {
      response.headers.set("x-intmax402-tx-hash", credential.txHash)
    }

    return response
  }
}

function edgeError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Simple path pattern matcher.
 * Supports wildcards: `/api/premium/:path*` → matches `/api/premium/anything`
 */
function matchPath(pattern: string, pathname: string): boolean {
  // Convert pattern to regex
  const regexStr = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // escape special chars
    .replace(/:([^/]+)\*/g, ".*") // :param* → .*
    .replace(/:([^/]+)/g, "[^/]+") // :param → [^/]+
    .replace(/\*/g, ".*") // * → .*
  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(pathname)
}

// Re-export core types for convenience
export type { INTMAX402Config, INTMAX402Mode } from "@tanakayuto/intmax402-core"
