/**
 * Google Calendar API utility
 * Handles token refresh, deterministic event IDs, and two-way sync.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/**
 * Format IDs for Google Calendar:
 * Google requires IDs in base32hex: [a-v0-9], 5-1024 chars.
 * UUID without hyphens is hex (0-9, a-f), which is valid base32hex.
 */
export function getGoogleEventId(itemType, id) {
  const cleanId = String(id).replace(/-/g, '').toLowerCase()
  if (itemType === 'task') return `lokitask${cleanId}`
  if (itemType === 'goal') return `lokigoal${cleanId}`
  return `lokievent${cleanId}`
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Token refresh failed: ${data.error_description || data.error}`)
  return data.access_token
}

/**
 * Convert a local calendar_event into Google Calendar format
 */
export function eventToGoogleBody(event) {
  const body = {
    summary: event.title || '(Untitled Event)',
    description: event.description || '',
    location: event.location || '',
  }

  if (event.start_time) {
    body.start = { dateTime: new Date(event.start_time).toISOString(), timeZone: 'Asia/Kolkata' }
    body.end   = event.end_time
      ? { dateTime: new Date(event.end_time).toISOString(), timeZone: 'Asia/Kolkata' }
      : { dateTime: new Date(new Date(event.start_time).getTime() + 60 * 60 * 1000).toISOString(), timeZone: 'Asia/Kolkata' }
  } else {
    const d = event.event_date || (event.start_time ? event.start_time.split('T')[0] : new Date().toISOString().split('T')[0])
    body.start = { date: d }
    body.end   = { date: d }
  }

  return body
}

/**
 * Convert a Task into Google Calendar format
 */
export function taskToGoogleBody(task) {
  const d = task.due_date ? task.due_date.split('T')[0] : new Date().toISOString().split('T')[0]
  const isDone = task.status === 'completed'
  return {
    summary: `${isDone ? '✓ ' : ''}[OPERATION] ${task.title}`,
    description: [
      `Task: ${task.title}`,
      `Status: ${task.status?.toUpperCase()}`,
      task.category ? `Category: ${task.category}` : null,
      task.difficulty ? `Difficulty: ${task.difficulty}` : null,
      task.description ? `\nNotes:\n${task.description}` : null,
    ].filter(Boolean).join('\n'),
    start: { date: d },
    end:   { date: d },
  }
}

/**
 * Convert a Goal into Google Calendar format
 */
export function goalToGoogleBody(goal) {
  const d = goal.deadline ? goal.deadline.split('T')[0] : new Date().toISOString().split('T')[0]
  const isDone = goal.status === 'completed'
  return {
    summary: `${isDone ? '✓ ' : ''}[DEADLINE] ${goal.title}`,
    description: [
      `Strategic Goal: ${goal.title}`,
      `Status: ${goal.status?.toUpperCase()}`,
      goal.priority ? `Priority: ${goal.priority}` : null,
      goal.progress != null ? `Progress: ${goal.progress}%` : null,
      goal.description ? `\nDetails:\n${goal.description}` : null,
    ].filter(Boolean).join('\n'),
    start: { date: d },
    end:   { date: d },
  }
}

/**
 * Upsert an event into Google Calendar:
 * Attempts PUT with the deterministic ID. If 404 (doesn't exist), POSTs with the ID.
 */
export async function upsertGoogleEvent(accessToken, calendarId = 'primary', eventId, eventBody) {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  
  // Try update first
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventBody),
  })

  if (putRes.ok) {
    return await putRes.json()
  }

  // If 404, insert with specific id
  if (putRes.status === 404) {
    const postRes = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: eventId, ...eventBody }),
      }
    )
    const data = await postRes.json()
    if (!postRes.ok) {
      throw new Error(`Google Calendar create failed: ${data.error?.message || JSON.stringify(data)}`)
    }
    return data
  }

  const errData = await putRes.json().catch(() => ({}))
  throw new Error(`Google Calendar update failed: ${errData.error?.message || putRes.status}`)
}

/**
 * Delete an event from Google Calendar
 */
export async function deleteGoogleEvent(accessToken, calendarId = 'primary', eventId) {
  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    throw new Error(`Google Calendar delete failed: ${data.error?.message || res.status}`)
  }
  return true
}

/**
 * Fetch events from Google Calendar in a date range or recent/upcoming
 */
export async function fetchGoogleEvents(accessToken, calendarId = 'primary', options = {}) {
  const params = new URLSearchParams({
    maxResults: String(options.maxResults || 250),
    singleEvents: 'true',
    orderBy: 'startTime',
  })
  if (options.timeMin) params.set('timeMin', options.timeMin)
  if (options.timeMax) params.set('timeMax', options.timeMax)

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Google Calendar list failed: ${data.error?.message || JSON.stringify(data)}`)
  return data.items || []
}
