import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Loki OS MCP Server (Next.js Endpoint)',
    timestamp: new Date().toISOString(),
    env: {
      supabase_configured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
      user_id_configured: !!process.env.LOKIOS_USER_ID,
      token_configured: !!process.env.LOKIOS_MCP_TOKEN
    }
  })
}
