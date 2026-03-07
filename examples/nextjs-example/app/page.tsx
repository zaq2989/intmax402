'use client'

import { useState } from 'react'

export default function Home() {
  const [freeResult, setFreeResult] = useState<string>('')
  const [premiumResult, setPremiumResult] = useState<string>('')
  const [loading, setLoading] = useState<string | null>(null)

  const callFree = async () => {
    setLoading('free')
    try {
      const res = await fetch('/api/free')
      const data = await res.json()
      setFreeResult(JSON.stringify(data, null, 2))
    } catch (e) {
      setFreeResult(String(e))
    } finally {
      setLoading(null)
    }
  }

  const callPremium = async () => {
    setLoading('premium')
    try {
      // First request — get nonce challenge
      const challenge = await fetch('/api/premium')
      const challengeData = await challenge.json()

      if (challenge.status === 401) {
        setPremiumResult(
          `401 Challenge received:\n${JSON.stringify(challengeData, null, 2)}\n\nWWW-Authenticate: ${challenge.headers.get('WWW-Authenticate')}`
        )
        return
      }

      const data = await challenge.json()
      setPremiumResult(JSON.stringify(data, null, 2))
    } catch (e) {
      setPremiumResult(String(e))
    } finally {
      setLoading(null)
    }
  }

  return (
    <main style={{ fontFamily: 'monospace', maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <h1>INTMAX402 Next.js Demo</h1>
      <p>This demo shows INTMAX402 authentication with Next.js App Router.</p>

      <section style={{ marginTop: 32 }}>
        <h2>Free Endpoint</h2>
        <p><code>GET /api/free</code> — No authentication required</p>
        <button onClick={callFree} disabled={loading === 'free'}>
          {loading === 'free' ? 'Loading...' : 'Call /api/free'}
        </button>
        {freeResult && (
          <pre style={{ background: '#f4f4f4', padding: 16, marginTop: 8 }}>{freeResult}</pre>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Premium Endpoint</h2>
        <p><code>GET /api/premium</code> — Protected with INTMAX402 (identity mode)</p>
        <button onClick={callPremium} disabled={loading === 'premium'}>
          {loading === 'premium' ? 'Loading...' : 'Call /api/premium'}
        </button>
        {premiumResult && (
          <pre style={{ background: '#f4f4f4', padding: 16, marginTop: 8 }}>{premiumResult}</pre>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>How to authenticate</h2>
        <p>Use the <a href="https://github.com/zaq2989/intmax402">INTMAX402 client</a>:</p>
        <pre style={{ background: '#f4f4f4', padding: 16 }}>{`import { createIntmax402Client } from '@tanakayuto/intmax402-client'

const client = createIntmax402Client({ privateKey: '0x...' })
const res = await client.fetch('http://localhost:3000/api/premium')
const data = await res.json()
console.log(data)`}</pre>
      </section>
    </main>
  )
}
