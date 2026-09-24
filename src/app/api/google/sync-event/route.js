/**
 * POST /api/google/sync-event
 * Called after a single event, task, or goal is created/updated/deleted.
 * Mirrors the change to Google Calendar in real-time.
 *
 * Body: {
 *   action: 'create' | 'update' | 'delete',
 *   itemType: 'event' | 'task' | 'goal',
 *   item: { id, title, ... },
 *   userId: string
 * }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  refreshAccessToken,
  upsertGoogleEvent,
  deleteGoogleEvent,
  getGoogleEventId,
  taskToGoogleBody,
  goalToGoogleBody,
  eventToGoogleBody,
} from '@/lib/utils/googleCalendar'

export async function POST(request) {
  try {
    const { action, itemType = 'event', item, userId } = await request.json()

    if (!action || !item || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('google_refresh_token, google_calendar_id')
      .eq('id', userId)
      .single()

    if (!profile?.google_refresh_token) {
      return NextResponse.json({ skipped: true, reason: 'not_connected' })
    }

    let accessToken
    try {
      accessToken = await refreshAccessToken(profile.google_refresh_token)
    } catch (e) {
      return NextResponse.json({ error: 'Token refresh failed', detail: e.message }, { status: 502 })
    }

    const calendarId = profile.google_calendar_id || 'primary'
    const googleId = getGoogleEventId(itemType, item.id)

    if (action === 'delete') {
      await deleteGoogleEvent(accessToken, calendarId, googleId)
      return NextResponse.json({ success: true, deleted: googleId })
    }

    // Determine body based on itemType
    let body
    if (itemType === 'task') {
      if (!item.due_date || item.status === 'cancelled') {
        // If due date was cleared or cancelled, delete from Google Calendar
        await deleteGoogleEvent(accessToken, calendarId, googleId)
        return NextResponse.json({ success: true, removed: googleId })
      }
      body = taskToGoogleBody(item)
    } else if (itemType === 'goal') {
      if (!item.deadline || item.status === 'cancelled') {
        await deleteGoogleEvent(accessToken, calendarId, googleId)
        return NextResponse.json({ success: true, removed: googleId })
      }
      body = goalToGoogleBody(item)
    } else {
      body = eventToGoogleBody(item)
    }

    await upsertGoogleEvent(accessToken, calendarId, googleId, body)
    return NextResponse.json({ success: true, googleId })
  } catch (err) {
    console.error('Google sync-event error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
