/**
 * GET /api/google/callback
 * Handles the OAuth callback from Google.
 * Exchanges the authorization code for tokens and stores the refresh_token in Supabase.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code    = searchParams.get('code')
  const state   = searchParams.get('state')   // user_id
  const error   = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/calendar?google_error=${error || 'missing_params'}`)
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  `${appUrl}/api/google/callback`,
      grant_type:    'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()

  if (!tokenRes.ok || !tokens.refresh_token) {
    console.error('Google token exchange failed:', tokens)
    return NextResponse.redirect(`${appUrl}/calendar?google_error=token_exchange_failed`)
  }

  // Use service role to write tokens (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { error: dbError } = await supabase
    .from('profiles')
    .update({
      google_refresh_token:  tokens.refresh_token,
      google_calendar_id:    'primary',
      google_connected_at:   new Date().toISOString(),
    })
    .eq('id', state)

  if (dbError) {
    console.error('Failed to save Google tokens:', dbError)
    return NextResponse.redirect(`${appUrl}/calendar?google_error=db_save_failed`)
  }

  // Sync ALL existing calendar_events to Google Calendar immediately
  const { data: existingEvents } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', state)

  if (existingEvents?.length) {
    try {
      const { refreshAccessToken, createGoogleEvent } = await import('@/lib/utils/googleCalendar')
      const accessToken = await refreshAccessToken(tokens.refresh_token)

      for (const evt of existingEvents) {
        if (evt.google_event_id) continue  // already synced
        try {
          const gEvt = await createGoogleEvent(accessToken, 'primary', evt)
          await supabase
            .from('calendar_events')
            .update({ google_event_id: gEvt.id })
            .eq('id', evt.id)
        } catch (syncErr) {
          console.warn(`Failed to sync event ${evt.id}:`, syncErr.message)
        }
      }
    } catch (e) {
      console.warn('Initial sync failed (non-fatal):', e.message)
    }
  }

  return NextResponse.redirect(`${appUrl}/calendar?google_connected=1`)
}
