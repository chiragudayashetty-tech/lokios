import { Database } from 'lucide-react'
import { ROUND2_MIGRATION } from '@/lib/utils/schema'

/** One-line hint shown in place of a feature whose table / column isn't there yet. */
export default function SchemaHint({ feature = 'This feature', file = ROUND2_MIGRATION, style }) {
  return (
    <p className="schema-hint" style={style}>
      <Database size={14} aria-hidden />
      <span>{feature} needs a database update — run <code>{file}</code> in the Supabase SQL editor.</span>
    </p>
  )
}
