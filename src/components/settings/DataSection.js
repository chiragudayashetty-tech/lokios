'use client'

import { useState } from 'react'
import { Database, Download, Upload, Trash2, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react'
import { Section, Row } from './controls'
import { DATA_TABLES, exportAll, exportTable, toCsv, download, validateImport, importAll, deleteAll } from '@/lib/utils/dataPortability'
import { getLocalDateStr } from '@/lib/utils/dates'

const CONFIRM_PHRASE = 'DELETE ALL'
const label = (t) => t.replace(/_/g, ' ')

/** Export (JSON / CSV), validated import and typed-confirmation delete-all. */
export default function DataSection({ user }) {
  const [busy, setBusy] = useState(null) // 'export' | 'csv' | 'import' | 'delete'
  const [progress, setProgress] = useState(null)
  const [msg, setMsg] = useState(null)
  const [csvTable, setCsvTable] = useState('habit_logs')
  const [pending, setPending] = useState(null) // validated import awaiting confirmation
  const [phrase, setPhrase] = useState('')
  const userId = user?.id
  const onProgress = ({ table, done, total }) => setProgress(`${label(table)} · ${done + 1}/${total}`)
  const run = async (kind, fn) => {
    setBusy(kind); setMsg(null)
    try { await fn() } catch (e) { setMsg({ ok: false, text: e?.message || String(e) }) }
    setBusy(null); setProgress(null)
  }

  const doExport = () => run('export', async () => {
    const data = await exportAll(userId, onProgress)
    const rows = Object.values(data.tables).reduce((s, r) => s + r.length, 0)
    download(`chiragos-export-${getLocalDateStr()}.json`, JSON.stringify(data, null, 2))
    setMsg({ ok: true, text: `Exported ${rows.toLocaleString()} rows from ${Object.keys(data.tables).length} tables${data.skipped.length ? ` (${data.skipped.length} not in this database)` : ''}.` })
  })
  const doCsv = () => run('csv', async () => {
    const rows = await exportTable(userId, csvTable)
    if (!rows.length) { setMsg({ ok: false, text: `No rows in ${label(csvTable)}.` }); return }
    download(`chiragos-${csvTable}-${getLocalDateStr()}.csv`, toCsv(rows), 'text/csv')
    setMsg({ ok: true, text: `Exported ${rows.length.toLocaleString()} ${label(csvTable)} rows.` })
  })
  const pickFile = async (file) => {
    if (!file) return
    setMsg(null); setPending(null)
    const res = validateImport(await file.text())
    if (!res.ok) setMsg({ ok: false, text: res.errors.slice(0, 4).join(' ') })
    else if (!res.summary.length) setMsg({ ok: false, text: 'That export has no rows.' })
    else setPending(res)
  }
  const doImport = () => run('import', async () => {
    const results = await importAll(userId, pending.data, onProgress)
    const written = results.reduce((s, r) => s + r.written, 0)
    const failed = results.filter((r) => r.error)
    setPending(null)
    setMsg({ ok: !failed.length, text: `Imported ${written.toLocaleString()} rows.${failed.length ? ` Skipped: ${failed.map((f) => `${label(f.table)} (${f.error})`).join(', ')}.` : ''} Reloading…` })
    setTimeout(() => window.location.reload(), 1600)
  })
  const doDelete = () => run('delete', async () => {
    const results = await deleteAll(userId, onProgress)
    const failed = results.filter((r) => r.error)
    try { Object.keys(localStorage).filter((k) => k.startsWith('lokios_') && k !== 'lokios_settings' && k !== 'lokios_cached_user').forEach((k) => localStorage.removeItem(k)) } catch {}
    setPhrase('')
    setMsg({ ok: !failed.length, text: failed.length ? `Some tables could not be cleared: ${failed.map((f) => label(f.table)).join(', ')}.` : 'All your data was deleted. Reloading…' })
    if (!failed.length) setTimeout(() => window.location.assign('/dashboard'), 1600)
  })

  return (
    <Section id="data" icon={Database} color="var(--warning)" title="Data">
      <Row label="Export everything" hint="One JSON file with every table, fetched 1,000 rows at a time. Google tokens are never included.">
        <button type="button" className="btn btn-secondary btn-sm" onClick={doExport} disabled={!!busy || !userId}><FileJson size={14} /> {busy === 'export' ? 'Exporting…' : 'Download JSON'}</button>
      </Row>
      <Row label="Export a table as CSV" hint="Opens in Sheets or Excel">
        <select className="select settings-date" value={csvTable} onChange={(e) => setCsvTable(e.target.value)} aria-label="Table to export">
          {DATA_TABLES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </select>
        <button type="button" className="btn btn-secondary btn-sm" onClick={doCsv} disabled={!!busy || !userId}><FileSpreadsheet size={14} /> {busy === 'csv' ? '…' : 'CSV'}</button>
      </Row>
      <Row label="Import" hint="A ChiragOS JSON export. Rows are matched by id, so importing twice doesn't duplicate.">
        <label className={`btn btn-secondary btn-sm ${busy ? 'is-disabled' : ''}`}>
          <Upload size={14} /> Choose file
          <input type="file" accept="application/json,.json" hidden disabled={!!busy} onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </Row>
      {pending && (
        <div className="set-import">
          <b>Ready to import</b>
          <ul>{pending.summary.map((x) => <li key={x.table}>{label(x.table)} <span>{x.rows.toLocaleString()}</span></li>)}</ul>
          <div className="set-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPending(null)} disabled={!!busy}>Cancel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={doImport} disabled={!!busy}><Download size={14} /> {busy === 'import' ? 'Importing…' : `Import ${pending.summary.reduce((s, x) => s + x.rows, 0).toLocaleString()} rows`}</button>
          </div>
        </div>
      )}
      <div className="set-danger">
        <div className="settings-row-text">
          <span className="settings-label"><AlertTriangle size={13} /> Delete all data</span>
          <span className="settings-hint">Removes every habit, task, log, mission, journal entry and all XP. Your account and settings stay. This can&apos;t be undone — export first.</span>
        </div>
        <div className="set-danger-form">
          <input className="input" value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={`Type ${CONFIRM_PHRASE}`} aria-label={`Type ${CONFIRM_PHRASE} to confirm`} autoComplete="off" />
          <button type="button" className="btn btn-danger btn-sm" onClick={doDelete} disabled={phrase !== CONFIRM_PHRASE || !!busy || !userId}><Trash2 size={14} /> {busy === 'delete' ? 'Deleting…' : 'Delete everything'}</button>
        </div>
      </div>
      {progress && <p className="set-hint" role="status">{progress}</p>}
      {msg && <p className={`cal-notice ${msg.ok ? 'is-ok' : 'is-bad'}`} role="status">{msg.text}</p>}
    </Section>
  )
}
