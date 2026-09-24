/**
 * POST /api/google/sync-event
 * Called after a calendar event is created/updated/deleted in Supabase.
 * Mirrors the change to Google Calendar and stores the google_event_id back in Supabase.
 *
 * Body: { action: 'create' | 'update' | 'delete', event: {...}, userId: string }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  refreshAccessToken,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from '@/lib/utils/googleCalendar'

export async function POST(request) {
  const { action, event, userId } = await request.json()

  if (!action || !userId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Get the user's Google tokens from their profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('google_refresh_token, google_calendar_id')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.google_refresh_token) {
    // Not connected to Google — silently skip (not an error)
    return NextResponse.json({ skipped: true, reason: 'not_connected' })
  }

  let accessToken
  try {
    accessToken = await refreshAccessToken(profile.google_refresh_token)
  } catch (e) {
    return NextResponse.json({ error: 'Token refresh failed', detail: e.message }, { status: 502 })
  }

  const calendarId = profile.google_calendar_id || 'primary'

  try {
    if (action === 'create') {
      const gEvt = await createGoogleEvent(accessToken, calendarId, event)
      // Store the google_event_id back so we can update/delete it later
      await supabase
        .from('calendar_events')
        .update({ google_event_id: gEvt.id })
        .eq('id', event.id)
      return NextResponse.json({ success: true, googleEventId: gEvt.id })
    }

    if (action === 'update') {
      if (!event.google_event_id) {
        // Was never synced — create it instead
        const gEvt = await createGoogleEvent(accessToken, calendarId, event)
        await supabase
          .from('calendar_events')
          .update({ google_event_id: gEvt.id })
          .eq('id', event.id)
        return NextResponse.json({ success: true, googleEventId: gEvt.id })
      }
      await updateGoogleEvent(accessToken, calendarId, event.google_event_id, event)
      return NextResponse.json({ success: true })
    }

    if (action === 'delete') {
      if (event.google_event_id) {
        await deleteGoogleEvent(accessToken, calendarId, event.google_event_id)
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error(`Google sync failed [${action}]:`, e.message)
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
