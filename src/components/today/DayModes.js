'use client'

import { useEffect, useState } from 'react'
import { Moon, Palmtree, X } from 'lucide-react'
import { getSettings, saveSettings, onSettingsChange } from '@/lib/settings'
import { getLocalDateStr, EXTEND_UNTIL_HOUR } from '@/lib/utils/dates'
import { vacationStatus, vacationDays, claimVacation, cancelVacation, VACATION } from '@/lib/utils/vacation'

const fmtD = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const yesterdayOf = (d) => { const y = new Date(d); y.setDate(y.getDate() - 1); return y }

/** Extend-day button and the vacation bank, shown on Today. */
export default function DayModes({ userId, level, today, onChange }) {
  const [settings, setSettings] = useState(getSettings)
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => onSettingsChange(setSettings), [])
  const run = async (fn) => {
    setBusy(true)
    try { await fn(); onChange?.() } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  const now = new Date()
  const hour = now.getHours()
  const calendarToday = getLocalDateStr(new Date(now.getTime() + 10000)) // plain calendar date, ignores extend
  const extended = settings.extendedDay && settings.extendedDay === today
  // Evening: extend tonight. Before 04:00: reopen yesterday, but only if its misses were not failed yet.
  const reopenable = hour < EXTEND_UNTIL_HOUR && (() => { try { return localStorage.getItem('daily_ops_autofail_ran_today') !== calendarToday } catch { return true } })()
  const extendTarget = hour >= 18 ? calendarToday : reopenable ? getLocalDateStr(new Date(yesterdayOf(now).getTime() + 10000)) : null

  const vac = vacationStatus(level, settings)
  const booked = vacationDays(settings).filter((d) => d >= today)
  const onVacation = booked.includes(today)

  return (
    <section className="dg-card dm-card">
      {extended ? (
        <div className="dm-row">
          <span><Moon size={15} /> <b>Extended day</b> · {fmtD(today)} stays open until {EXTEND_UNTIL_HOUR}:00 AM</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => saveSettings({ extendedDay: '' }, userId))}>End day now</button>
        </div>
      ) : extendTarget ? (
        <div className="dm-row">
          <span><Moon size={15} /> Working late? Keep {extendTarget === calendarToday ? 'today' : `${fmtD(extendTarget)}`} open until {EXTEND_UNTIL_HOUR}:00 AM — nothing resets.</span>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => saveSettings({ extendedDay: extendTarget }, userId))}>Extend day</button>
        </div>
      ) : null}

      <div className="dm-row">
        <span><Palmtree size={15} /> <b>Vacation</b> · {vac.available} day{vac.available === 1 ? '' : 's'} in the bank{vac.waiting ? ` (+${vac.waiting} waiting)` : ''} · next at level {vac.nextAtLevel}</span>
        {!onVacation && vac.available > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => confirm('Spend a vacation day on today? Focus is blocked and nothing costs XP. It cannot be returned.') && run(() => claimVacation(today, level, userId))}>Take today off</button>
        )}
      </div>
      {vac.available > 0 && (
        <div className="dg-btns">
          <input type="date" className="input dg-time" min={today} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Vacation date" />
          <button type="button" className="td-pill" disabled={busy || !pick} onClick={() => run(async () => { await claimVacation(pick, level, userId); setPick('') })}>Book day</button>
        </div>
      )}
      {booked.length > 0 && (
        <ul className="dg-list">{booked.map((d) => (
          <li key={d}><span>{fmtD(d)}{d === today ? ' · today' : ''}</span>
            {d > today && <button type="button" className="tl-icon" disabled={busy} onClick={() => run(() => cancelVacation(d, userId))} aria-label="Return day"><X size={12} /></button>}</li>
        ))}</ul>
      )}
      <p className="dg-rules">1 vacation day per {VACATION.levelsPerDay} levels, max {VACATION.maxBank} in the bank. A vacation day blocks focus, never costs XP and doesn&apos;t break the streak. Extend keeps the day open until {EXTEND_UNTIL_HOUR}:00 AM at most.</p>
    </section>
  )
}
