import ReportView from '@/components/report/ReportView'
import '../report.css'

export const metadata = { title: 'Report · ChiragOS' }

/** /report?from=YYYY-MM-DD&to=YYYY-MM-DD&sections=a,b&theme=light|dark&print=1 (#42) */
export default async function ReportPage({ searchParams }) {
  const sp = await searchParams
  const pick = (k) => (typeof sp?.[k] === 'string' ? sp[k] : undefined)
  // Parsed on the client so "today" uses the viewer's timezone
  return <ReportView search={{ from: pick('from'), to: pick('to'), sections: pick('sections'), theme: pick('theme'), print: pick('print') }} />
}
