/**
 * POST /api/google/sync-all
 * Full Two-Way Synchronization:
 * 1. Pushes all Tasks with due dates to Google Calendar
 * 2. Pushes all Goals with deadlines to Google Calendar
 * 3. Pushes all Calendar Events to Google Calendar
 * 4. Imports external Google Calendar events into Loki OS calendar_events
 *
 * Body: { userId: string }
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  refreshAccessToken,
  upsertGoogleEvent,
  fetchGoogleEvents,
  getGoogleEventId,
  taskToGoogleBody,
  goalToGoogleBody,
  eventToGoogleBody,
} from '@/lib/utils/googleCalendar'

export async function POST(request) {
  let userId
  try {
    const body = await request.json().catch(() => ({}))
    userId = body.userId
  } catch {}

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
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
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  let accessToken
  try {
    accessToken = await refreshAccessToken(profile.google_refresh_token)
  } catch (err) {
    return NextResponse.json({ error: 'Token refresh failed', details: err.message }, { status: 401 })
  }

  const calendarId = profile.google_calendar_id || 'primary'
  let pushedTasks = 0
  let pushedGoals = 0
  let pushedEvents = 0
  let importedGoogleEvents = 0
  const errors = []

  // 1. Push Tasks with due_date
  try {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .not('due_date', 'is', null)
      .neq('status', 'cancelled')

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        try {
          const gId = getGoogleEventId('task', task.id)
          const body = taskToGoogleBody(task)
          await upsertGoogleEvent(accessToken, calendarId, gId, body)
          pushedTasks++
        } catch (e) {
          errors.push(`Task ${task.title}: ${e.message}`)
        }
      }
    }
  } catch (e) {
    errors.push(`Fetch tasks error: ${e.message}`)
  }

  // 2. Push Goals with deadline
  try {
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .not('deadline', 'is', null)
      .neq('status', 'cancelled')

    if (goals && goals.length > 0) {
      for (const goal of goals) {
        try {
          const gId = getGoogleEventId('goal', goal.id)
          const body = goalToGoogleBody(goal)
          await upsertGoogleEvent(accessToken, calendarId, gId, body)
          pushedGoals++
        } catch (e) {
          errors.push(`Goal ${goal.title}: ${e.message}`)
        }
      }
    }
  } catch (e) {
    errors.push(`Fetch goals error: ${e.message}`)
  }

  // 3. Push Calendar Events
  try {
    const { data: events } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)

    if (events && events.length > 0) {
      for (const evt of events) {
        // If event was originally imported from Google (has google_event_id without loki prefix), skip re-pushing
        if (evt.google_event_id && !evt.google_event_id.startsWith('lokievent')) {
          continue
        }
        try {
          const gId = getGoogleEventId('event', evt.id)
          const body = eventToGoogleBody(evt)
          await upsertGoogleEvent(accessToken, calendarId, gId, body)
          pushedEvents++
        } catch (e) {
          errors.push(`Event ${evt.title}: ${e.message}`)
        }
      }
    }
  } catch (e) {
    errors.push(`Fetch events error: ${e.message}`)
  }

  // 4. Import External Google Calendar Events into Loki OS
  try {
    // Look back 90 days, forward 365 days
    const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const timeMax = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    const gEvents = await fetchGoogleEvents(accessToken, calendarId, { timeMin, timeMax })

    const { data: existingLocalEvents } = await supabase
      .from('calendar_events')
      .select('id, google_event_id')
      .eq('user_id', userId)

    const existingGoogleIds = new Set((existingLocalEvents || []).map(e => e.google_event_id).filter(Boolean))

    for (const gItem of gEvents) {
      // Skip items that Loki OS created
      if (
        gItem.id.startsWith('lokitask') ||
        gItem.id.startsWith('lokigoal') ||
        gItem.id.startsWith('lokievent')
      ) {
        continue
      }

      // Check if already in Supabase
      if (existingGoogleIds.has(gItem.id)) {
        continue
      }

      const startTime = gItem.start?.dateTime || (gItem.start?.date ? `${gItem.start.date}T00:00:00Z` : new Date().toISOString())
      const endTime = gItem.end?.dateTime || (gItem.end?.date ? `${gItem.end.date}T23:59:59Z` : null)

      const { error: insertErr } = await supabase
        .from('calendar_events')
        .insert({
          user_id: userId,
          title: gItem.summary || '(Untitled Event)',
          description: gItem.description || '',
          location: gItem.location || '',
          start_time: startTime,
          end_time: endTime,
          google_event_id: gItem.id,
        })

      if (!insertErr) {
        importedGoogleEvents++
        existingGoogleIds.add(gItem.id)
      }
    }
  } catch (e) {
    errors.push(`Import external events error: ${e.message}`)
  }

  return NextResponse.json({
    success: true,
    summary: {
      pushedTasks,
      pushedGoals,
      pushedEvents,
      importedGoogleEvents,
    },
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  })
}
