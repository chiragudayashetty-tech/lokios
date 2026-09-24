/**
 * Google Calendar API utility
 * Handles token refresh and all CRUD operations against the Google Calendar API
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

/**
 * Refresh an expired access token using the stored refresh token.
 * Returns a fresh access token string.
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
 * Build the Google Calendar event body from a local event row.
 */
function toGoogleEvent(event) {
  const body = {
    summary: event.title,
    description: event.description || '',
    location: event.location || '',
  }

  if (event.start_time) {
    body.start = { dateTime: new Date(event.start_time).toISOString(), timeZone: 'Asia/Kolkata' }
    body.end   = event.end_time
      ? { dateTime: new Date(event.end_time).toISOString(), timeZone: 'Asia/Kolkata' }
      : { dateTime: new Date(new Date(event.start_time).getTime() + 60 * 60 * 1000).toISOString(), timeZone: 'Asia/Kolkata' }
  } else {
    // All-day event fallback
    const d = event.event_date || event.start_time?.split('T')[0]
    body.start = { date: d }
    body.end   = { date: d }
  }

  return body
}

/**
 * Create a new event in Google Calendar.
 * Returns the created Google event (including its id).
 */
export async function createGoogleEvent(accessToken, calendarId = 'primary', event) {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toGoogleEvent(event)),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(`Create event failed: ${data.error?.message || JSON.stringify(data)}`)
  return data
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateGoogleEvent(accessToken, calendarId = 'primary', googleEventId, event) {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toGoogleEvent(event)),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(`Update event failed: ${data.error?.message || JSON.stringify(data)}`)
  return data
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteGoogleEvent(accessToken, calendarId = 'primary', googleEventId) {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    throw new Error(`Delete event failed: ${data.error?.message || res.status}`)
  }
}

/**
 * High-level helper: get a fresh access token from a Supabase profile row,
 * call the provided action fn(accessToken), and return the result.
 * Handles token refresh automatically.
 */
export async function withGoogleAuth(profile, actionFn) {
  if (!profile?.google_refresh_token) return null
  const accessToken = await refreshAccessToken(profile.google_refresh_token)
  return actionFn(accessToken, profile.google_calendar_id || 'primary')
}
