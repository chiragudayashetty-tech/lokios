import { redirect } from 'next/navigation'

// Brain dump now lives in Tasks → Inbox.
export default function BrainDumpPage() {
  redirect('/tasks')
}
