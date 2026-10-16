'use client'

import { useCallback, useEffect, useState } from 'react'
import { Fuel, Moon, Target, Package, AlertTriangle, Check, X, Trash2 } from 'lucide-react'
import { useOSSlice } from '@/lib/context/OSContext'
import { getLocalDateStr } from '@/lib/utils/dates'
import { loadDiscipline, logPlay, deletePlay, setLightsOut, overdraftPenalty, FUEL, STAKES, LIGHTS_GRACE_MIN, SHIP } from '@/lib/games/discipline'

const fmtM = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`)
const fmtD = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const daysTo = (ds) => Math.round((new Date(`${ds}T12:00:00`) - new Date(`${getLocalDateStr()}T12:00:00`)) / 86400000)

function FuelTank({ fuel, userId, onChange, compact }) {
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // minutes awaiting an overdraft confirm
  const [custom, setCustom] = useState('')
  const pct = fuel.earned ? Math.round((fuel.balance / FUEL.tankCap) * 100) : 0
  const play = async (m, force = false) => {
    if (!m || m <= 0) return
    if (m > fuel.balance && !force) { setConfirm(m); return }
    setBusy(true); setConfirm(null)
    try { await logPlay(userId, m, fuel.balance); setCustom(''); onChange() } catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  const t = fuel.today
  return (
    <section className="dg-card">
      <div className="dg-head"><Fuel size={15} /> Fuel tank <span className="dg-hint">earned play time · resets Monday</span></div>
      <div className="dg-tank"><span style={{ width: `${Math.min(100, pct)}%` }} className={fuel.balance < 30 ? 'is-low' : ''} /></div>
      <div className="dg-row">
        <b className="dg-big">{fmtM(fuel.balance)}</b><span>left · earned {fmtM(fuel.earned)} · played {fmtM(fuel.played)} this week</span>
      </div>
      {!compact && t && (
        <p className="dg-sub">Today +{t.earned}m{t.raw > t.earned ? ` (capped at ${FUEL.dailyCap}m)` : ''}: habits {t.habits}m · tasks {t.tasks}m · work {t.work}m{t.perfect ? ` · perfect day ${t.perfect}m` : ''}</p>
      )}
      {fuel.overdraft > 0 && <p className="dg-warn"><AlertTriangle size={13} /> {fuel.overdraft}m played on an empty tank this week</p>}
      {confirm ? (
        <div className="dg-confirm">
          <p><AlertTriangle size={14} /> Only {fmtM(fuel.balance)} in the tank. Playing {fmtM(confirm)} costs <b>−{overdraftPenalty(confirm - fuel.balance)} XP</b>.</p>
          <div className="dg-btns">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>Don&apos;t play</button>
            <button type="button" className="btn btn-sm dg-danger" onClick={() => play(confirm, true)} disabled={busy}>Play anyway</button>
          </div>
        </div>
      ) : (
        <div className="dg-btns">
          {[30, 60, 90].map((m) => <button key={m} type="button" className={`td-pill ${m > fuel.balance ? 'is-over' : ''}`} onClick={() => play(m)} disabled={busy || !userId}>Played {fmtM(m)}</button>)}
          <input className="input dg-min" type="number" min="5" step="5" inputMode="numeric" placeholder="min" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button type="button" className="td-pill" onClick={() => play(parseInt(custom, 10))} disabled={busy || !custom}>Log</button>
        </div>
      )}
      {!compact && fuel.sessions.length > 0 && (
        <ul className="dg-list">{fuel.sessions.slice(-4).reverse().map((s) => (
          <li key={s.id}><span>{fmtD(s.date)} · {fmtM(s.minutes)}{s.overdraft ? <em className="is-bad"> · {s.overdraft}m overdraft</em> : ''}</span>
            <button type="button" className="tl-icon" onClick={async () => { await deletePlay(userId, s); onChange() }} aria-label="Remove session"><Trash2 size={12} /></button></li>
        ))}</ul>
      )}
      {!compact && <p className="dg-rules">Earn: habit +{FUEL.habit}m · task +{FUEL.task}m · work hour +{FUEL.workHour}m · perfect day +{FUEL.perfectDay}m (max {FUEL.dailyCap}m/day, tank {fmtM(FUEL.tankCap)}). Playing past the tank: −{FUEL.penaltyPerMin} XP/min, at least −{FUEL.penaltyMin}, at most −{FUEL.penaltyMax}.</p>}
    </section>
  )
}

function LightsOut({ data, userId, onChange }) {
  const today = getLocalDateStr()
  const [target, setTarget] = useState('23:30')
  const [stake, setStake] = useState(50)
  const [busy, setBusy] = useState(false)
  const p = data.pledgeToday
  const last = data.lastPledge
  const wins = data.pledgeHistory.filter((x) => x.status === 'won').length
  const save = async () => {
    setBusy(true)
    try { await setLightsOut(userId, today, target, stake); onChange() } catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  return (
    <section className="dg-card">
      <div className="dg-head"><Moon size={15} /> Lights-out bet <span className="dg-hint">{data.pledgeHistory.length ? `${wins}/${data.pledgeHistory.length} nights won` : 'pledge tonight’s bedtime'}</span></div>
      {last && (
        <p className={`dg-result ${last.status === 'won' ? 'is-good' : 'is-bad'}`}>
          {last.status === 'won' ? <Check size={13} /> : <X size={13} />} {fmtD(last.date)}: pledged {last.target}, {last.actual ? `in bed ${last.actual}` : 'no sleep logged'} → {last.status === 'won' ? `+${last.stake}` : `−${last.stake}`} XP
        </p>
      )}
      {p ? (
        <p className="dg-row"><b className="dg-big">{p.target}</b><span>tonight · {p.stake} XP at stake · settles when you log sleep</span></p>
      ) : (
        <>
          <div className="dg-btns">
            <input type="time" className="input dg-time" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Lights-out time" />
            {STAKES.map((s) => <button key={s} type="button" className={`td-pill ${stake === s ? 'is-on' : ''}`} onClick={() => setStake(s)}>{s} XP</button>)}
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !userId}>Pledge lights-out by {target}</button>
        </>
      )}
      <p className="dg-rules">In bed within {LIGHTS_GRACE_MIN} min of the pledge (from your sleep log) wins the stake; later, or no sleep logged, loses it.</p>
    </section>
  )
}

function EstimateDuel({ cal }) {
  return (
    <section className="dg-card">
      <div className="dg-head"><Target size={15} /> Estimate duel <span className="dg-hint">set an estimate on a task, log real time when done</span></div>
      {!cal ? <p className="dg-sub">No duels yet. Add an estimate to a task; when you complete it you’ll be asked how long it really took. Within 20% = +25 XP, within 50% = +10.</p> : (
        <>
          <p className="dg-row"><b className="dg-big">{cal.median}×</b><span>{cal.median > 1.1 ? `you underestimate — things take ${cal.median}× your guess` : cal.median < 0.9 ? `you overestimate — things take ${cal.median}× your guess` : 'your estimates are on point'} · {cal.hitRate}% bullseyes · last {cal.n}</span></p>
          <ul className="dg-list">{cal.recent.map((t) => <li key={t.id}><span>{t.title}</span><em>{t.estimate_minutes}m → {t.actual_minutes}m</em></li>)}</ul>
          {cal.median > 1.1 && <p className="dg-sub">Tip: multiply your next estimate by {cal.median} before you set the deadline.</p>}
        </>
      )}
    </section>
  )
}

function ShipPledges({ ships }) {
  return (
    <section className="dg-card">
      <div className="dg-head"><Package size={15} /> Ship-day pledges <span className="dg-hint">a mission’s deadline is the promise</span></div>
      {!ships.length ? <p className="dg-sub">No active mission has a deadline. Set one to pledge a ship day.</p> : (
        <ul className="dg-list">{ships.slice(0, 5).map((s) => {
          const d = daysTo(s.deadline)
          return <li key={s.id}><span>{s.title}</span><em className={d < 0 ? 'is-bad' : d <= 2 ? 'is-warn' : ''}>{fmtD(s.deadline)} · {d < 0 ? `${-d}d late` : d === 0 ? 'today' : `${d}d`}{s.pushes ? ` · pushed ${s.pushes}×` : ''}</em></li>
        })}</ul>
      )}
      <p className="dg-rules">Moving a deadline later: −{SHIP.push} XP each time. Shipping on the day: +{SHIP.onTime} XP (+{SHIP.onTimeAfterPush} if it was pushed).</p>
    </section>
  )
}

/** The four discipline games. `compact` (Today) shows the fuel tank and lights-out only. */
export default function DisciplineGames({ compact = false }) {
  const { user } = useOSSlice('auth')
  const [data, setData] = useState(null)
  const refresh = useCallback(() => { if (user?.id) loadDiscipline(user.id).then(setData).catch(() => {}) }, [user?.id])
  useEffect(() => {
    refresh()
    const on = () => refresh()
    window.addEventListener('lokios:xp-changed', on)
    return () => window.removeEventListener('lokios:xp-changed', on)
  }, [refresh])
  if (!data) return null
  return (
    <div className={`dg ${compact ? 'is-compact' : ''}`}>
      {data.needsMigration && <p className="dg-warn"><AlertTriangle size={13} /> Run <code>supabase/migrations/20261017_discipline_games.sql</code> in Supabase to turn on the fuel tank and lights-out bet.</p>}
      <div className="dg-grid">
        <FuelTank fuel={data.fuel} userId={user?.id} onChange={refresh} compact={compact} />
        <LightsOut data={data} userId={user?.id} onChange={refresh} />
        {!compact && <EstimateDuel cal={data.calibration} />}
        {!compact && <ShipPledges ships={data.ships} />}
      </div>
    </div>
  )
}
