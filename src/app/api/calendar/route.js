import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return new NextResponse("Missing token parameter. Add ?token=YOUR_TOKEN", { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Using service role key if available to bypass RLS for background sync, otherwise falls back to anon
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Look up user_id from profiles table using calendar_token
  const { data: profile } = await supabase.from('profiles').select('id').eq('calendar_token', token).single()
  
  if (!profile) {
    return new NextResponse("User not found.", { status: 404 })
  }
  
  const userId = profile.id

  const [eventsRes, tasksRes, goalsRes] = await Promise.all([
    supabase.from('calendar_events').select('*').eq('user_id', userId),
    supabase.from('tasks').select('*').eq('user_id', userId).not('due_date', 'is', null),
    supabase.from('goals').select('*').eq('user_id', userId).not('deadline', 'is', null)
  ])

  const events = eventsRes.data || []
  const tasks = tasksRes.data || []
  const goals = goalsRes.data || []

  // Generate ICS string
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ChiragOS//Tactical Command Center//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]

  const formatDate = (dateString, isAllDay = false) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    if (isAllDay) {
      return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    }
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }

  events.forEach(e => {
    ics.push('BEGIN:VEVENT')
    ics.push(`UID:evt-${e.id}@chiragos`)
    ics.push(`DTSTAMP:${formatDate(new Date())}`)
    ics.push(`DTSTART:${formatDate(e.start_time)}`)
    if (e.end_time) ics.push(`DTEND:${formatDate(e.end_time)}`)
    ics.push(`SUMMARY:${e.title}`)
    if (e.description) ics.push(`DESCRIPTION:${e.description.replace(/\n/g, '\\n')}`)
    if (e.location) ics.push(`LOCATION:${e.location}`)
    ics.push('END:VEVENT')
  })

  tasks.forEach(t => {
    ics.push('BEGIN:VEVENT')
    ics.push(`UID:tsk-${t.id}@chiragos`)
    ics.push(`DTSTAMP:${formatDate(new Date())}`)
    ics.push(`DTSTART;VALUE=DATE:${formatDate(t.due_date, true)}`)
    ics.push(`SUMMARY:[OPERATION] ${t.title}`)
    ics.push('END:VEVENT')
  })

  goals.forEach(g => {
    ics.push('BEGIN:VEVENT')
    ics.push(`UID:gol-${g.id}@chiragos`)
    ics.push(`DTSTAMP:${formatDate(new Date())}`)
    ics.push(`DTSTART:${formatDate(g.deadline)}`)
    ics.push(`SUMMARY:[DEADLINE] ${g.title}`)
    if (g.description) ics.push(`DESCRIPTION:${g.description.replace(/\n/g, '\\n')}`)
    ics.push('END:VEVENT')
  })

  ics.push('END:VCALENDAR')

  return new NextResponse(ics.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="chiragos_schedule.ics"'
    }
  })
}
