import { handleIntmax402 } from "@tanakayuto/intmax402-fetch"
import { INTMAX402Config } from "@tanakayuto/intmax402-core"
import { MiddlewareHandler } from "hono"

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
  return async (c, next) => {
    try {
      const result = await handleIntmax402(c.req.raw, config)
      if (result.response !== null) {
        return result.response
      }
      c.set("intmax402", result.context!)
      await next()
    } catch (err) {
      return c.json({ error: "Internal Server Error" }, 500)
    }
  }
}
