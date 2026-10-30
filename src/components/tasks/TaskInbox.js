'use client'

import { useMemo, useState } from 'react'
import { Inbox, ChevronDown } from 'lucide-react'
import CaptureBar from '@/components/braindump/CaptureBar'
import InboxStack from '@/components/braindump/InboxStack'
import { NewTaskSheet } from '@/components/tasks/TaskModals'
import { useOSSlice } from '@/lib/context/OSContext'
import { useLocalPref } from '@/lib/hooks/useLocalPref'
import { emitGame } from '@/lib/utils/gamification'
import { kindOf, textOf, titleOf } from '@/lib/utils/brainDump'

/** Brain dump, folded into Tasks: capture a thought, then turn it into a task, a mission idea, or trash it. */
export default function TaskInbox({ goals, today, schemaReady, addTask }) {
  const bd = useOSSlice('brainDump')
  const [pref, setPref] = useLocalPref('lokios_tasks_inbox', 'open', ['open', 'closed'])
  const open = pref === 'open'
  const [taskFrom, setTaskFrom] = useState(null)
  const [now] = useState(() => Date.now())
  const inbox = useMemo(() => (bd.items || []).filter((i) => kindOf(i) === 'inbox').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))), [bd.items])

  const toMission = async (item) => {
    const res = await bd.convertToMission(item.id, titleOf(item))
    if (!res?.error) emitGame('toast', { icon: 'target', title: 'Mission idea saved', sub: 'Draft mission (paused) in Goals', tone: 'accent' })
  }

  return (
    <section className="tk-inbox">
      <button type="button" className="tk-inbox-head" onClick={() => setPref(open ? 'closed' : 'open')} aria-expanded={open}>
        <Inbox size={15} /> <b>Inbox</b> {inbox.length > 0 && <span className="bd-badge">{inbox.length}</span>}
        <span className="tk-inbox-hint">dump a thought, sort it later</span>
        <ChevronDown size={15} style={{ marginLeft: 'auto', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <>
          <CaptureBar onCapture={(text) => bd.addItem(text, 'inbox')} />
          {inbox.length > 0 && (
            <InboxStack items={inbox} now={now} onTask={setTaskFrom} onTrash={(i) => bd.trashItem(i.id)} onMission={toMission} onOpen={setTaskFrom} onKeep={(i, kind) => bd.setKind(i.id, kind)} />
          )}
        </>
      )}
      <NewTaskSheet
        key={taskFrom ? `ibx_${taskFrom.id}` : 'closed'}
        open={!!taskFrom}
        preset={{ due_date: today }}
        goals={goals}
        today={today}
        schemaReady={schemaReady}
        initialTitle={taskFrom ? titleOf(taskFrom) : ''}
        initialNotes={taskFrom && textOf(taskFrom).includes('\n') ? textOf(taskFrom) : ''}
        onClose={() => setTaskFrom(null)}
        onCreate={async (payload) => {
          const res = await addTask(payload)
          if (!res?.error && taskFrom) {
            await bd.markConverted(taskFrom.id, `task:${res.data.id}`)
            emitGame('toast', { icon: 'check', title: 'Task created', sub: payload.title, tone: 'success' })
          }
          return res
        }}
      />
    </section>
  )
}
