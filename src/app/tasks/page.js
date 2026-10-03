'use client'

import { useMemo, useState } from 'react'
import { Plus, Search, LayoutGrid, List, Target, AlertTriangle, Clock, Sun, TrendingUp, X } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import WinterLoader from '@/components/ui/WinterLoader'
import ConfirmModal from '@/components/ui/ConfirmModal'
import SchemaHint from '@/components/ui/SchemaHint'
import TaskBoard from '@/components/tasks/TaskBoard'
import TaskList from '@/components/tasks/TaskList'
import TaskDrawer from '@/components/tasks/TaskDrawer'
import { CompleteTaskModal, FailTaskModal, NewTaskSheet } from '@/components/tasks/TaskModals'
import { useOS, useOSSlice } from '@/lib/context/OSContext'
import { useIsPhone } from '@/lib/hooks/useMediaQuery'
import { useLocalPref } from '@/lib/hooks/useLocalPref'
import { getLocalDateStr } from '@/lib/utils/dates'
import { emitGame } from '@/lib/utils/gamification'
import { PRIORITIES, categoryLabel, columnOf, sortColumn, dueForColumn, dueOf, isOpen, weekEndOf, daysBetween } from '@/lib/utils/taskBoard'

const VIEW_KEY = 'lokios_tasks_view'
const CLOSED_CONFIRM = { isOpen: false }

export default function TasksPage() {
  const {
    tasks = [], loading, error, fetchTasks, addTask, patchTask, reorderTasks, boardSchema,
    pushTaskToTomorrow, undoCompleteTask,
  } = useOSSlice('tasks')
  const { goals = [] } = useOSSlice('goals')
  const { completeOperation, deleteOperation, failOperation, undoFailOperation } = useOS()
  const phone = useIsPhone()
  const today = getLocalDateStr()

  const [view, changeView] = useLocalPref(VIEW_KEY, 'board', ['board', 'list'])
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState(null)
  const [prFilter, setPrFilter] = useState(null)
  const [goalFilter, setGoalFilter] = useState('')
  const [openId, setOpenId] = useState(null)
  const [proofTask, setProofTask] = useState(null)
  const [failTask, setFailTask] = useState(null)
  const [newTask, setNewTask] = useState(null) // { due_date } preset when open
  const [confirmModal, setConfirmModal] = useState(CLOSED_CONFIRM)

  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals])

  // ── Filters ───────────────────────────────────────────────────────────────
  const categories = useMemo(() => [...new Set(tasks.filter(isOpen).map(categoryLabel))].sort(), [tasks])
  const linkedGoals = useMemo(() => goals.filter((g) => tasks.some((t) => t.goal_id === g.id && isOpen(t))), [goals, tasks])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks.filter((t) => {
      if (catFilter && categoryLabel(t) !== catFilter) return false
      if (prFilter && (t.difficulty || 'MEDIUM').toUpperCase() !== prFilter) return false
      if (goalFilter && t.goal_id !== goalFilter) return false
      if (q && !`${t.title} ${t.description || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, query, catFilter, prFilter, goalFilter])
  const filtering = !!(query || catFilter || prFilter || goalFilter)

  // ── Metrics ───────────────────────────────────────────────────────────────
  const open = tasks.filter(isOpen)
  const overdueCount = open.filter((t) => dueOf(t) && dueOf(t) < today).length
  const dueTodayCount = open.filter((t) => dueOf(t) === today).length
  const doneWeek = tasks.filter((t) => t.status === 'completed' && t.completed_at && daysBetween(getLocalDateStr(new Date(t.completed_at)), today) < 7).length

  // ── Actions ───────────────────────────────────────────────────────────────
  const askConfirm = (cfg) => {
    setConfirmModal({
      isOpen: true,
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      ...cfg,
      onConfirm: async () => { setConfirmModal(CLOSED_CONFIRM); await cfg.onConfirm?.() },
      onCancel: async () => { setConfirmModal(CLOSED_CONFIRM); await cfg.onCancel?.() },
    })
  }

  const requestComplete = (task) => setProofTask(task)

  const submitComplete = async (task, url, note) => {
    await completeOperation(task.id, url, note)
    setProofTask(null)
    if (openId === task.id) setOpenId(null)
  }

  const push = async (task) => {
    const res = await pushTaskToTomorrow(task.id)
    if (res) emitGame('toast', { icon: 'calendar', title: 'Pushed to tomorrow', sub: task.title, tone: 'accent' })
  }

  const remove = (task) => {
    const archived = task.status === 'completed' || task.status === 'cancelled'
    askConfirm({
      title: 'Delete task?',
      message: `"${task.title}" will be permanently deleted.`,
      danger: true,
      confirmText: 'Delete',
      onConfirm: async () => {
        if (!archived) { await deleteOperation(task.id, true); setOpenId(null); return }
        askConfirm({
          title: 'Refund the XP too?',
          message: 'Remove the XP this task earned (or cost) from your total?',
          danger: true,
          confirmText: 'Remove XP',
          cancelText: 'Keep XP',
          onConfirm: async () => { await deleteOperation(task.id, true); setOpenId(null) },
          onCancel: async () => { await deleteOperation(task.id, false); setOpenId(null) },
        })
      },
    })
  }

  /** A card was dropped: column decides the due date, position the order inside it. */
  const moveTask = async (id, col, beforeId) => {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const weekEnd = weekEndOf(today)
    const from = columnOf(task, today, weekEnd)
    if (col === 'done') { if (task.status !== 'completed') setProofTask(task); return }

    let current = task
    if (from === 'done') {
      const reopened = await undoCompleteTask(id)
      if (!reopened) return
      current = reopened
    }
    if (from !== col) {
      const due = dueForColumn(col, current, tasks, today)
      if ((due || null) !== (dueOf(current) || null)) {
        const res = await patchTask(id, { due_date: due })
        if (res?.error) { emitGame('toast', { icon: 'alert', title: 'Could not move task', sub: res.error.message, tone: 'danger' }); return }
        current = res.data
      }
      if (col === 'week' && due === today) emitGame('toast', { icon: 'calendar', title: 'The week is over', sub: 'Moved to Today instead', tone: 'accent' })
    }

    if (boardSchema === false) return
    const landed = columnOf(current, today, weekEnd)
    const siblings = sortColumn(tasks.filter((t) => t.id !== id && columnOf(t, today, weekEnd) === landed), landed, today)
    let at = beforeId ? siblings.findIndex((t) => t.id === beforeId) : -1
    if (at < 0) at = siblings.length
    const ordered = [...siblings.slice(0, at), current, ...siblings.slice(at)]
    const orders = ordered.map((t, i) => ({ id: t.id, position: (i + 1) * 10 })).filter((o) => (tasks.find((t) => t.id === o.id)?.position ?? null) !== o.position)
    await reorderTasks(orders)
  }

  const addFromColumn = (col) => setNewTask({ due_date: dueForColumn(col, null, tasks, today) || '', n: Date.now() })
  const openTask = (task) => setOpenId(task.id)
  const drawerTask = openId ? tasks.find((t) => t.id === openId) : null

  if (error) {
    return (
      <AppShell>
        <div className="flex-center h-full flex-col gap-4 text-center">
          <AlertTriangle size={40} className="text-danger" />
          <h2 className="page-title">Couldn&apos;t load tasks</h2>
          <p className="text-muted">{error}</p>
          <button type="button" onClick={fetchTasks} className="btn btn-primary">Try again</button>
        </div>
      </AppShell>
    )
  }
  if (loading && !tasks.length) return <AppShell><WinterLoader label="Loading tasks" /></AppShell>

  return (
    <AppShell>
      <div className="page-container tasks-page" style={{ maxWidth: 1400 }}>
        <header className="tk-head">
          <div>
            <h1 className="page-title flex items-center gap-3"><Target className="text-amber" /> Tasks</h1>
            <p className="page-subtitle">Plan the day, drag the rest, prove the work.</p>
          </div>
          <div className="tk-head-actions">
            <div className="tk-view" role="tablist" aria-label="View">
              <button type="button" role="tab" aria-selected={view === 'board'} className={view === 'board' ? 'is-on' : ''} onClick={() => changeView('board')}><LayoutGrid size={14} /> Board</button>
              <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => changeView('list')}><List size={14} /> List</button>
            </div>
            <button type="button" className="btn btn-primary tk-add" onClick={() => setNewTask({ due_date: today, n: Date.now() })}><Plus size={16} /> Task</button>
          </div>
        </header>

        <div className="tk-stats">
          <div><Clock size={14} /><b>{open.length}</b><span>Open</span></div>
          <div className={overdueCount ? 'is-bad' : ''}><AlertTriangle size={14} /><b>{overdueCount}</b><span>Overdue</span></div>
          <div><Sun size={14} /><b>{dueTodayCount}</b><span>Due today</span></div>
          <div className="is-good"><TrendingUp size={14} /><b>{doneWeek}</b><span>Done · 7d</span></div>
        </div>

        <div className="tk-filters">
          <label className="tk-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={13} /></button>}
          </label>
          <div className="tk-chips">
            {Object.entries(PRIORITIES).filter(([k]) => k !== 'NONE').map(([k, p]) => (
              <button key={k} type="button" className={`tk-chip ${prFilter === k ? 'is-on' : ''}`} style={{ '--pr': p.color }} onClick={() => setPrFilter(prFilter === k ? null : k)}>
                <i /> {p.label}
              </button>
            ))}
            {categories.map((c) => (
              <button key={c} type="button" className={`tk-chip ${catFilter === c ? 'is-on' : ''}`} onClick={() => setCatFilter(catFilter === c ? null : c)}>{c}</button>
            ))}
            {linkedGoals.length > 0 && (
              <select className={`tk-chip tk-chip-select ${goalFilter ? 'is-on' : ''}`} value={goalFilter} onChange={(e) => setGoalFilter(e.target.value)} aria-label="Filter by mission">
                <option value="">Any mission</option>
                {linkedGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            )}
            {filtering && <button type="button" className="tk-chip is-clear" onClick={() => { setQuery(''); setCatFilter(null); setPrFilter(null); setGoalFilter('') }}>Clear</button>}
          </div>
        </div>

        {boardSchema === false && <SchemaHint feature="Card order, subtasks and estimates" />}

        {view === 'board' ? (
          <TaskBoard
            tasks={filtered}
            today={today}
            goalsById={goalsById}
            phone={phone}
            onOpen={openTask}
            onComplete={requestComplete}
            onPush={push}
            onMove={moveTask}
            onAdd={addFromColumn}
          />
        ) : (
          <TaskList
            tasks={filtered}
            today={today}
            goalsById={goalsById}
            onOpen={openTask}
            onComplete={requestComplete}
            onPush={push}
            onFail={setFailTask}
            onDelete={remove}
            onUndoComplete={(t) => undoCompleteTask(t.id)}
            onUndoFail={(t) => undoFailOperation(t.id)}
            onAdd={addFromColumn}
          />
        )}

        <TaskDrawer
          key={openId || 'none'}
          task={drawerTask}
          goals={goals}
          today={today}
          schemaReady={boardSchema}
          onClose={() => setOpenId(null)}
          patchTask={patchTask}
          onComplete={requestComplete}
          onFail={setFailTask}
          onDelete={remove}
          onPush={push}
          onReopen={(t) => undoCompleteTask(t.id)}
        />

        <NewTaskSheet
          key={newTask ? `new_${newTask.n}` : 'closed'}
          open={!!newTask}
          preset={newTask}
          goals={goals}
          today={today}
          schemaReady={boardSchema}
          onClose={() => setNewTask(null)}
          onCreate={addTask}
        />

        <CompleteTaskModal task={proofTask} today={today} onClose={() => setProofTask(null)} onSubmit={submitComplete} />
        <FailTaskModal task={failTask} onClose={() => setFailTask(null)} onSubmit={async (t, reason) => { await failOperation(t.id, reason); setFailTask(null) }} />
        <ConfirmModal {...confirmModal} />
      </div>
    </AppShell>
  )
}
