'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Edit2, Pause, Play, Trash2, X, RotateCcw, Quote, Repeat, History, Flag, ListChecks, Zap, AlertTriangle, CalendarDays } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import Ring from '@/components/ui/Ring'
import SchemaHint from '@/components/ui/SchemaHint'
import ConfirmModal from '@/components/ui/ConfirmModal'
import GoalTree from '@/components/goals/GoalTree'
import MissionForm from '@/components/goals/MissionForm'
import { Cover } from '@/components/goals/MissionCard'
import { CompleteMissionModal, FailMissionModal, missionPayout } from '@/components/goals/MissionModals'
import { useOS, useOSSlice } from '@/lib/context/OSContext'
import { useMilestones, addMilestone, updateMilestone, deleteMilestone, reorderMilestones, setMilestoneDone } from '@/lib/hooks/useMilestones'
import { getLocalDateStr, parseTaskNotes } from '@/lib/utils/dates'
import { emitGame } from '@/lib/utils/gamification'
import { progressOf, milestonesOf, tasksOf, typeLabel, countdown, deadlineOf } from '@/lib/utils/missions'
import { habitsScheduledOn } from '@/lib/utils/xpRules'

const fmt = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const CLOSED = { isOpen: false }

export default function MissionDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useOSSlice('auth')
  const { goals = [], loading, updateGoal, completeGoal, undoCompleteGoal, togglePauseGoal } = useOSSlice('goals')
  const { tasks = [], addTask } = useOSSlice('tasks')
  const { habits = [], monthLogs = [], cycleHabitState } = useOSSlice('habits')
  const { completeOperation, failMission, undoFailMission, deleteMission, syncMissionProgress } = useOS()
  const milestones = useMilestones()
  const today = getLocalDateStr()

  const [editing, setEditing] = useState(0)
  const [completing, setCompleting] = useState(null)
  const [failing, setFailing] = useState(null)
  const [confirm, setConfirm] = useState(CLOSED)
  const [busyTask, setBusyTask] = useState(null)
  const [whyDraft, setWhyDraft] = useState(null)

  const goal = goals.find((g) => g.id === id)
  const ms = useMemo(() => milestonesOf(id, milestones.list), [id, milestones.list])
  const ts = useMemo(() => tasksOf(id, tasks), [id, tasks])
  const progress = goal ? progressOf(goal, milestones.list, tasks) : 0
  const linkedHabits = habits.filter((h) => h.goal_id === id && h.is_active !== false)
  const extras = goal ? 'why' in goal : true

  const activity = useMemo(() => {
    if (!goal) return []
    const items = []
    for (const t of ts) if (t.status === 'completed' && t.completed_at) items.push({ at: t.completed_at, icon: ListChecks, text: `Task done: ${t.title}` })
    for (const m of ms) if (m.done_at) items.push({ at: m.done_at, icon: Flag, text: `Milestone reached: ${m.title}` })
    if (goal.completed_at && goal.status === 'completed') items.push({ at: goal.completed_at, icon: Check, text: 'Mission completed' })
    if (goal.created_at) items.push({ at: goal.created_at, icon: Zap, text: 'Mission created' })
    return items.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  }, [goal, ts, ms])

  if (!goal) {
    if (loading) return <AppShell><WinterLoader label="Loading mission" /></AppShell>
    return (
      <AppShell>
        <div className="page-container ms-detail">
          <Link href="/goals" className="ms-back"><ArrowLeft size={15} /> Missions</Link>
          <div className="tb-empty ms-empty"><p>This mission doesn&apos;t exist any more.</p></div>
        </div>
      </AppShell>
    )
  }

  const active = !['completed', 'failed', 'cancelled'].includes(goal.status)
  const cd = countdown(goal, today)
  const pay = missionPayout(goal, today)
  const { cleanDesc, completionNote, failureNote } = parseTaskNotes(goal.description)

  const toggleTask = async (task) => {
    if (busyTask) return
    setBusyTask(task.id)
    try { await completeOperation(task.id) } finally { setBusyTask(null) }
  }

  const addTaskTo = async (title, milestoneId) => {
    const payload = { title, goal_id: id, type: 'custom', difficulty: 'MEDIUM', category: goal.category === 'business' ? 'beyond_tatva' : 'personal_mission', status: 'pending' }
    if (milestoneId) payload.milestone_id = milestoneId
    const res = await addTask(payload)
    if (!res?.error) await syncMissionProgress(id, [...tasks, res.data])
    return res
  }

  const submitComplete = async (g, url, note, xp) => {
    const res = await completeGoal(g.id, url, false, note)
    setCompleting(null)
    if (res) emitGame('mission-complete', { title: g.title, xp })
  }

  const remove = () => setConfirm({
    isOpen: true,
    title: 'Delete mission?',
    message: `"${goal.title}" and its milestones will be deleted. Linked tasks stay on your board.`,
    danger: true,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    onConfirm: async () => { setConfirm(CLOSED); if (await deleteMission(goal.id, true)) router.push('/goals') },
    onCancel: () => setConfirm(CLOSED),
  })

  const saveWhy = async () => {
    if (whyDraft === null) return
    const next = whyDraft.trim() || null
    setWhyDraft(null)
    if (next !== (goal.why || null)) await updateGoal(goal.id, { why: next })
  }

  return (
    <AppShell>
      <div className="page-container ms-detail">
        <Link href="/goals" className="ms-back"><ArrowLeft size={15} /> Missions</Link>

        <section className={`ms-hero ms-band--${goal.cover && !/\p{Extended_Pictographic}/u.test(goal.cover) ? goal.cover : 'violet'}`}>
          <div className="ms-hero-main">
            <Ring value={progress / 100} size={104} stroke={9} gradient={goal.status !== 'completed'} color="var(--success)" label={`${progress}% complete`}>
              <b className="ms-hero-pct">{progress}%</b>
              <span className="ms-hero-lbl">complete</span>
            </Ring>
            <div className="ms-hero-text">
              <div className="ms-hero-chips">
                <Cover goal={goal} size="sm" />
                <span className={`ms-type ms-type--${goal.type}`}>{typeLabel(goal)}</span>
                {goal.status === 'paused' && <span className="ms-type is-paused"><Pause size={10} /> Paused</span>}
                {goal.status === 'completed' && <span className="ms-cd is-done"><Check size={11} /> Completed {goal.completed_at ? fmt(goal.completed_at) : ''}</span>}
                {(goal.status === 'failed' || goal.status === 'cancelled') && <span className="ms-cd is-urgent"><X size={11} /> Failed</span>}
              </div>
              <h1 className="ms-hero-title">{goal.title}</h1>
              <div className="ms-hero-meta">
                {deadlineOf(goal) && <span className={cd?.urgent ? 'is-urgent' : ''}><CalendarDays size={13} /> {fmt(`${deadlineOf(goal)}T12:00:00`)}{cd ? ` · ${cd.text}` : ''}</span>}
                <span><Zap size={13} /> {goal.status === 'completed' ? 'Paid' : 'Pays'} +{active ? pay.net : pay.base} XP</span>
              </div>
            </div>
          </div>
          <div className="ms-hero-actions">
            {active && <button type="button" className="btn btn-primary" onClick={() => setCompleting(goal)}><Check size={16} /> Complete</button>}
            {goal.status === 'completed' && <button type="button" className="btn btn-secondary" onClick={() => undoCompleteGoal(goal.id)}><RotateCcw size={15} /> Reopen</button>}
            {(goal.status === 'failed' || goal.status === 'cancelled') && <button type="button" className="btn btn-secondary" onClick={() => undoFailMission(goal.id)}><RotateCcw size={15} /> Restore</button>}
            <button type="button" className="tl-icon" onClick={() => setEditing((n) => n + 1)} title="Edit" aria-label="Edit mission"><Edit2 size={15} /></button>
            {active && <button type="button" className="tl-icon" onClick={() => togglePauseGoal(goal.id, goal.status)} title={goal.status === 'paused' ? 'Resume' : 'Pause'} aria-label={goal.status === 'paused' ? 'Resume mission' : 'Pause mission'}>{goal.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}</button>}
            {active && <button type="button" className="tl-icon is-danger" onClick={() => setFailing(goal)} title="Mark failed" aria-label="Mark failed"><X size={15} /></button>}
            <button type="button" className="tl-icon is-danger" onClick={remove} title="Delete" aria-label="Delete mission"><Trash2 size={15} /></button>
          </div>
        </section>

        <section className="ms-panel ms-why-card">
          <div className="ms-panel-head"><Quote size={15} /> Why it matters</div>
          {extras ? (
            <textarea
              className="ms-why-input"
              rows={2}
              value={whyDraft ?? goal.why ?? ''}
              onChange={(e) => setWhyDraft(e.target.value)}
              onBlur={saveWhy}
              placeholder="Write the reason you'll want to read on a bad day…"
              aria-label="Why it matters"
            />
          ) : <SchemaHint feature="Why it matters and covers" />}
          {cleanDesc && <p className="ms-desc">{cleanDesc}</p>}
          {completionNote && <p className="tl-note is-ok"><Check size={13} /> <span>{completionNote}</span></p>}
          {failureNote && <p className="tl-note is-bad"><AlertTriangle size={13} /> <span>{failureNote}</span></p>}
        </section>

        <section className="ms-panel">
          <div className="ms-panel-head"><Flag size={15} /> Roadmap</div>
          {milestones.missing ? (
            <SchemaHint feature="Milestones" />
          ) : (
            <GoalTree
              key={milestones.loaded ? 'loaded' : 'loading'}
              goal={goal}
              progress={progress}
              milestones={ms}
              tasks={ts}
              onToggleTask={toggleTask}
              busyTask={busyTask}
              onAddMilestone={(m) => addMilestone(user?.id, id, m)}
              onToggleMilestone={(m, done) => setMilestoneDone(user?.id, goal, m, done)}
              onUpdateMilestone={updateMilestone}
              onDeleteMilestone={(m) => deleteMilestone(user?.id, m.id)}
              onReorder={reorderMilestones}
              onAddTask={addTaskTo}
            />
          )}
        </section>

        <div className="ms-two">
          <section className="ms-panel">
            <div className="ms-panel-head"><Repeat size={15} /> Supporting habits</div>
            {linkedHabits.length === 0 ? (
              <p className="ms-muted">No habits linked yet — pick this mission in a habit&apos;s “Supports mission” field.</p>
            ) : (
              <ul className="ms-habits">
                {linkedHabits.map((h) => {
                  const scheduled = habitsScheduledOn([h], today).length > 0
                  const doneToday = monthLogs.some((l) => l.habit_id === h.id && l.date === today && (!l.status || l.status === 'completed'))
                  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return getLocalDateStr(d) })
                  return (
                    <li key={h.id} className="ms-habit">
                      <button type="button" className={`gt-check gt-check--lg ${doneToday ? 'is-on' : ''}`} disabled={!scheduled} onClick={() => cycleHabitState?.(h.id, today, doneToday ? 'none' : 'completed')} data-celebrate={doneToday ? undefined : ''} aria-label={doneToday ? `Undo ${h.title}` : `Complete ${h.title}`}>
                        {doneToday && <Check size={13} strokeWidth={3} />}
                      </button>
                      <span className="ms-habit-title">{h.title}{!scheduled && <em> · rest day</em>}</span>
                      <span className="ms-habit-week" aria-label="Last 7 days">
                        {week.map((d) => <i key={d} className={monthLogs.some((l) => l.habit_id === h.id && l.date === d && (!l.status || l.status === 'completed')) ? 'is-on' : ''} />)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="ms-panel">
            <div className="ms-panel-head"><History size={15} /> Activity</div>
            {activity.length === 0 ? <p className="ms-muted">Nothing yet.</p> : (
              <ol className="ms-activity">
                {activity.slice(0, 20).map((a, i) => {
                  const Icon = a.icon
                  return <li key={i}><Icon size={13} /><span>{a.text}</span><time>{fmt(a.at)}</time></li>
                })}
              </ol>
            )}
          </section>
        </div>

        <MissionForm
          key={`edit_${editing}`}
          open={editing > 0}
          goal={goal}
          extras={extras}
          onClose={() => setEditing(0)}
          onSave={async (payload) => {
            const res = await updateGoal(goal.id, payload)
            return res ? { data: res } : { error: new Error('Could not save the mission') }
          }}
        />
        <CompleteMissionModal goal={completing} today={today} onClose={() => setCompleting(null)} onSubmit={submitComplete} />
        <FailMissionModal goal={failing} onClose={() => setFailing(null)} onSubmit={async (g, reason) => { await failMission(g.id, reason?.trim() || null); setFailing(null) }} />
        <ConfirmModal {...confirm} />
      </div>
    </AppShell>
  )
}
