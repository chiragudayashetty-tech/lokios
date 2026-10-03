'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, RefreshCw, X, Link2, CalendarRange, LayoutGrid, List } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import SchemaHint from '@/components/ui/SchemaHint'
import WeekGrid from '@/components/calendar/WeekGrid'
import UnscheduledPanel from '@/components/calendar/UnscheduledPanel'
import MonthView from '@/components/calendar/MonthView'
import AgendaView from '@/components/calendar/AgendaView'
import EventSheet from '@/components/calendar/EventSheet'
import { useOS, useOSSlice } from '@/lib/context/OSContext'
import { useCalendarRange } from '@/lib/hooks/useCalendarRange'
import { useIsPhone } from '@/lib/hooks/useMediaQuery'
import { useLocalPref } from '@/lib/hooks/useLocalPref'
import { getLocalDateStr, getStartOfWeek } from '@/lib/utils/dates'
import { emitGame } from '@/lib/utils/gamification'
import { atMinutes, nextFreeSlot, durationMin, categoryForTask, CATEGORIES } from '@/lib/utils/calendarBlocks'
import { formatTimeOf } from '@/lib/utils/appDate'

const SYNC_KEY = 'lokios_gcal_last_sync'
const shiftDays = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return getLocalDateStr(d) }

function useSyncStamp() {
  const [stamp, setStamp] = useLocalPref(SYNC_KEY, '')
  return [stamp ? new Date(stamp) : null, (d) => setStamp(d.toISOString())]
}

export default function CalendarPage() {
  const { user } = useOSSlice('auth')
  const { profile } = useOSSlice('profile')
  const { tasks = [] } = useOSSlice('tasks')
  const { goals = [] } = useOSSlice('goals')
  const { habits = [] } = useOSSlice('habits')
  const { completeOperation } = useOS()
  const phone = useIsPhone()
  const [view, setView] = useLocalPref('lokios_calendar_view', 'week', ['week', 'month', 'agenda'])
  const [anchor, setAnchor] = useState(() => getLocalDateStr())
  const [now, setNow] = useState(() => new Date())
  const [sheet, setSheet] = useState(null) // { event } | { draft }
  const [pickTask, setPickTask] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, markSynced] = useSyncStamp()
  const [notice, setNotice] = useState(null)
  const today = getLocalDateStr(now)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  // Google OAuth return
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('google_connected') || p.get('google_error')) {
      window.history.replaceState({}, '', '/calendar')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off message from the OAuth redirect
      setNotice(p.get('google_connected') ? { ok: true, msg: 'Google Calendar connected. Hit “Sync now” to pull your events.' } : { ok: false, msg: `Google connection failed: ${p.get('google_error')}` })
    }
  }, [])

  // Visible days / fetch range per view
  const days = useMemo(() => {
    if (phone) return [0, 1, 2].map((i) => shiftDays(anchor, i))
    const start = getLocalDateStr(getStartOfWeek(new Date(`${anchor}T12:00:00`)))
    return Array.from({ length: 7 }, (_, i) => shiftDays(start, i))
  }, [anchor, phone])
  const range = useMemo(() => {
    if (view === 'month') {
      const a = new Date(`${anchor}T12:00:00`)
      const first = getStartOfWeek(new Date(a.getFullYear(), a.getMonth(), 1))
      const from = getLocalDateStr(first)
      return [from, shiftDays(from, 41)]
    }
    if (view === 'agenda') return [anchor, shiftDays(anchor, 13)]
    return [days[0], days[days.length - 1]]
  }, [view, anchor, days])

  const cal = useCalendarRange(user?.id, range[0], range[1])
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const blockedTaskIds = useMemo(() => new Set(cal.events.filter((e) => e.task_id).map((e) => e.task_id)), [cal.events])
  const unscheduled = useMemo(() => tasks
    .filter((t) => !['completed', 'cancelled', 'failed'].includes(t.status) && !blockedTaskIds.has(t.id))
    .filter((t) => !t.due_date || String(t.due_date).slice(0, 10) <= range[1])
    .sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))), [tasks, blockedTaskIds, range])

  const step = view === 'month' ? 'month' : phone ? 3 : 7
  const go = (dir) => {
    if (step === 'month') { const d = new Date(`${anchor}T12:00:00`); d.setMonth(d.getMonth() + dir, 1); setAnchor(getLocalDateStr(d)) }
    else setAnchor(shiftDays(anchor, dir * (view === 'agenda' ? 14 : step)))
  }

  const title = (() => {
    const a = new Date(`${anchor}T12:00:00`)
    if (view === 'month') return a.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    const f = new Date(`${range[0]}T12:00:00`), t = new Date(`${range[1]}T12:00:00`)
    const sameMonth = f.getMonth() === t.getMonth()
    return `${f.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${t.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`
  })()

  // ── Actions ───────────────────────────────────────────────────────────────
  const createAt = async (day, minutes, taskId) => {
    if (taskId) {
      const task = tasksById.get(taskId)
      if (!task) return
      const start = atMinutes(day, minutes)
      const end = new Date(start.getTime() + (task.estimate_minutes || 60) * 60000)
      const res = await cal.addEvent({ title: task.title, start_time: start.toISOString(), end_time: end.toISOString(), task_id: task.id, category: categoryForTask(task) })
      if (res.error) {
        setNotice({ ok: false, msg: res.missing ? 'Time blocks need the round-2 database update.' : res.error.message })
        return
      }
      setPickTask(null)
      emitGame('toast', { icon: 'calendar', title: 'Time-blocked', sub: `${task.title} · ${formatTimeOf(start)}`, tone: 'accent' })
      return
    }
    const start = atMinutes(day, minutes)
    setSheet({ draft: { start, end: new Date(start.getTime() + 3600000) }, n: Date.now() })
  }

  const move = (ev, start, end) => cal.updateEvent(ev.id, { start_time: start.toISOString(), end_time: end.toISOString() })

  const roll = async (ev) => {
    const slot = nextFreeSlot(cal.events, durationMin(ev), new Date(), ev.id)
    if (!slot) { setNotice({ ok: false, msg: 'No free slot in the next 14 days.' }); return }
    await cal.updateEvent(ev.id, { start_time: slot.start.toISOString(), end_time: slot.end.toISOString(), completed: false })
    setSheet(null)
    emitGame('toast', { icon: 'calendar', title: 'Rolled forward', sub: `${ev.title} → ${slot.start.toLocaleDateString('en-US', { weekday: 'short' })} ${formatTimeOf(slot.start)}`, tone: 'accent' })
    if (getLocalDateStr(slot.start) > range[1]) setAnchor(getLocalDateStr(slot.start))
  }

  const sync = async () => {
    if (!profile?.id || syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/google/sync-all', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: profile.id }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) { markSynced(new Date()); cal.reload(); setNotice({ ok: true, msg: `Synced with Google Calendar${data.summary?.importedGoogleEvents ? ` · ${data.summary.importedGoogleEvents} events imported` : ''}.` }) }
      else setNotice({ ok: false, msg: data.error || 'Sync failed — try again.' })
    } catch {
      setNotice({ ok: false, msg: 'Network error during sync.' })
    } finally { setSyncing(false) }
  }

  const disconnect = async () => {
    if (!window.confirm('Disconnect Google Calendar? Events stop syncing.')) return
    const res = await fetch('/api/google/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: profile?.id }) })
    setNotice(res.ok ? { ok: true, msg: 'Google Calendar disconnected.' } : { ok: false, msg: 'Could not disconnect — try again.' })
    if (res.ok) setTimeout(() => window.location.reload(), 900)
  }

  const connected = !!profile?.google_refresh_token
  const sinceSync = lastSync ? Math.max(0, Math.round((now.getTime() - lastSync.getTime()) / 60000)) : null

  return (
    <AppShell>
      <div className="page-container cal-page" style={{ maxWidth: 1400 }}>
        <header className="tk-head">
          <div>
            <h1 className="page-title flex items-center gap-3"><CalendarDays className="text-amber" /> Calendar</h1>
            <p className="page-subtitle">Give every important task a slot.</p>
          </div>
          <div className="tk-head-actions cal-actions">
            <div className="tk-view" role="tablist" aria-label="View">
              <button type="button" role="tab" aria-selected={view === 'week'} className={view === 'week' ? 'is-on' : ''} onClick={() => setView('week')}><CalendarRange size={14} /> {phone ? '3-day' : 'Week'}</button>
              <button type="button" role="tab" aria-selected={view === 'month'} className={view === 'month' ? 'is-on' : ''} onClick={() => setView('month')}><LayoutGrid size={14} /> Month</button>
              <button type="button" role="tab" aria-selected={view === 'agenda'} className={view === 'agenda' ? 'is-on' : ''} onClick={() => setView('agenda')}><List size={14} /> Agenda</button>
            </div>
            <button type="button" className="btn btn-primary tk-add" onClick={() => { const s = new Date(); s.setMinutes(s.getMinutes() < 30 ? 30 : 60, 0, 0); setSheet({ draft: { start: s, end: new Date(s.getTime() + 3600000) }, n: Date.now() }) }}><Plus size={16} /> Event</button>
          </div>
        </header>

        <div className="cal-bar">
          <div className="cal-nav">
            <button type="button" className="tl-icon" onClick={() => go(-1)} aria-label="Previous"><ChevronLeft size={16} /></button>
            <button type="button" className="td-pill" onClick={() => setAnchor(getLocalDateStr())}>Today</button>
            <button type="button" className="tl-icon" onClick={() => go(1)} aria-label="Next"><ChevronRight size={16} /></button>
            <h2 className="cal-title">{title}</h2>
          </div>
          <div className="cal-sync">
            {connected ? (
              <>
                <span className="cal-chip is-on"><i /> Google · {sinceSync === null ? 'not synced yet' : sinceSync < 1 ? 'synced just now' : sinceSync < 60 ? `synced ${sinceSync}m ago` : `synced ${lastSync.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</span>
                <button type="button" className="td-pill" onClick={sync} disabled={syncing}><RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing…' : 'Sync now'}</button>
                <button type="button" className="tl-icon" onClick={disconnect} title="Disconnect Google" aria-label="Disconnect Google Calendar"><X size={14} /></button>
              </>
            ) : (
              <button type="button" className="cal-chip" onClick={() => profile?.id && (window.location.href = `/api/google/auth?userId=${profile.id}`)} disabled={!profile?.id}><i /> Connect Google Calendar</button>
            )}
            {profile?.calendar_token && <a className="cal-chip" href={`/api/calendar?token=${profile.calendar_token}`} target="_blank" rel="noopener noreferrer"><Link2 size={12} /> .ics</a>}
          </div>
        </div>

        {notice && (
          <div className={`cal-notice ${notice.ok ? 'is-ok' : 'is-bad'}`} role="status">
            <span>{notice.msg}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        )}
        {cal.blockColumns === false && <SchemaHint feature="Task time blocks, categories and block XP" />}

        {view === 'week' && (
          <div className="cal-layout">
            <div className="cal-grid-card">
              {pickTask && <div className="cal-picking">Tap a slot for <b>{pickTask.title}</b> <button type="button" className="td-link" onClick={() => setPickTask(null)}>Cancel</button></div>}
              <WeekGrid
                days={days}
                events={cal.events}
                tasksById={tasksById}
                habits={habits}
                logs={cal.logs}
                today={today}
                now={now}
                phone={phone}
                pickTask={pickTask}
                onCreateAt={createAt}
                onMove={move}
                onOpen={(ev) => setSheet({ event: ev, n: Date.now() })}
                onRoll={roll}
                onSwipe={(dir) => setAnchor(shiftDays(anchor, dir * 3))}
              />
              <div className="cal-legend">
                {CATEGORIES.map((c) => <span key={c.id}><i style={{ background: c.color }} /> {c.label}</span>)}
                <span><i className="is-now" /> Now</span>
              </div>
            </div>
            {cal.blockColumns !== false && (
              <UnscheduledPanel tasks={unscheduled} today={today} phone={phone} picking={pickTask} onPick={setPickTask} collapsedDefault={phone} />
            )}
          </div>
        )}
        {view === 'month' && (
          <MonthView anchor={new Date(`${anchor}T12:00:00`)} events={cal.events} tasks={tasks} goals={goals} today={today} onPickDay={(d) => { setAnchor(d); setView('week') }} />
        )}
        {view === 'agenda' && (
          <AgendaView from={range[0]} events={cal.events} tasks={tasks} goals={goals} today={today} onOpen={(ev) => setSheet({ event: ev, n: Date.now() })} />
        )}

        <EventSheet
          key={sheet ? `${sheet.event?.id || 'new'}_${sheet.n}` : 'closed'}
          open={!!sheet}
          event={sheet?.event}
          draft={sheet?.draft}
          tasks={tasks}
          blockColumns={cal.blockColumns}
          onClose={() => setSheet(null)}
          onSave={(payload) => (sheet?.event ? cal.updateEvent(sheet.event.id, payload) : cal.addEvent(payload))}
          onDelete={async (ev) => { await cal.deleteEvent(ev.id); setSheet(null) }}
          onCompleteTask={async (ev, task) => { await completeOperation(task.id); await cal.updateEvent(ev.id, { completed: true }); setSheet(null) }}
          onRoll={roll}
        />
      </div>
    </AppShell>
  )
}
