/**
 * GET /api/google/auth?userId=USER_ID
 * Redirects the user to Google's OAuth consent screen.
 * userId is passed as a query param from the frontend (already available via profile).
 */
import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/supabase/requireUser'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const requestedUserId = searchParams.get('userId')
  const { user } = await getRequestUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (requestedUserId && requestedUserId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lokios.vercel.app'

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${appUrl}/api/google/callback`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ].join(' '),
    access_type:   'offline',
    prompt:        'consent',
    state:         user.id,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
