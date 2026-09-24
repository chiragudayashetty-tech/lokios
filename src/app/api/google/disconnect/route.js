/**
 * POST /api/google/disconnect
 * Body: { userId: string }
 * Removes Google tokens from the user's profile.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { error } = await supabase
    .from('profiles')
    .update({
      google_refresh_token: null,
      google_calendar_id:   null,
      google_connected_at:  null,
    })
    .eq('id', userId)

  if (error) return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })

  return NextResponse.json({ success: true })
}
