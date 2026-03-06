import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { intmax402, Intmax402Env } from "@tanakayuto/intmax402-hono"

const app = new Hono<Intmax402Env>()

app.get("/free", (c) => c.json({ message: "free access" }))

app.get("/premium",
  intmax402({ mode: "identity", secret: process.env.INTMAX402_SECRET || "hono-dev-secret" }),
  (c) => c.json({ message: "verified", address: c.get("intmax402").address })
)

serve({ fetch: app.fetch, port: 3763 }, () => {
  console.log("Hono intmax402 example running on http://localhost:3763")
})
