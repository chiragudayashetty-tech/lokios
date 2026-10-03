'use client'

import { Printer } from 'lucide-react'

export default function PrintButton({ label = 'Print / save as PDF' }) {
  return <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}><Printer size={15} /> {label}</button>
}
