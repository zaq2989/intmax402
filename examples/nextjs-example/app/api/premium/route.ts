import { withIntmax402 } from '@tanakayuto/intmax402-nextjs'

export const GET = withIntmax402(
  async (req) => {
    return Response.json({
      message: 'Welcome to the premium endpoint!',
      address: req.intmax402.address,
      verified: req.intmax402.verified,
      timestamp: new Date().toISOString(),
    })
  },
  {
    secret: process.env.INTMAX402_SECRET ?? 'dev-secret-change-me',
    mode: 'identity',
  }
)
