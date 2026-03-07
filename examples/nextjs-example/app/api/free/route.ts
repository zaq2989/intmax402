export async function GET() {
  return Response.json({
    message: 'This is a free endpoint — no authentication required.',
    timestamp: new Date().toISOString(),
  })
}
