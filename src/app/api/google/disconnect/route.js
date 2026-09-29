/**
 * POST /api/google/disconnect
 * Body: { userId: string }
 * Removes Google tokens from the user's profile.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRequestUser } from '@/lib/supabase/requireUser'

export async function POST(request) {
  const { userId: requestedUserId } = await request.json()
  const { user } = await getRequestUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (requestedUserId && requestedUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })

  return NextResponse.json({ success: true })
}
