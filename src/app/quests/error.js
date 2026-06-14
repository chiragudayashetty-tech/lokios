'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Next.js caught error:', error)
  }, [error])

  return (
    <div style={{ padding: '40px', backgroundColor: '#000', color: '#ff4444', fontFamily: 'monospace' }}>
      <h2>DailyOps Page Crashed!</h2>
      <p style={{ color: '#fff', margin: '20px 0' }}>{error?.message || 'Unknown error'}</p>
      <pre style={{ backgroundColor: '#222', padding: '10px', overflowX: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
        {error?.stack}
      </pre>
      <button onClick={() => reset()} style={{ padding: '10px 20px', marginTop: '20px', backgroundColor: '#333', color: 'white', border: 'none', borderRadius: '4px' }}>
        Try again
      </button>
    </div>
  )
}
