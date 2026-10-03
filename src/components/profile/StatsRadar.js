'use client'

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts'

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return <div className="chart-tip"><b>{d.label} · Lv. {d.level}</b><span>{d.xp.toLocaleString()} XP</span></div>
}

/** Six character stats as a radar (levels on the main XP curve). */
export default function StatsRadar({ stats, height = 260 }) {
  const max = Math.max(5, ...stats.map((s) => s.level))
  return (
    <div className="chart-box" role="img" aria-label={`Character stats: ${stats.map((s) => `${s.label} level ${s.level}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={stats} outerRadius="72%">
          <PolarGrid stroke="rgba(255,255,255,0.1)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }} />
          <PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
          <Tooltip content={<Tip />} />
          <Radar dataKey="level" stroke="var(--accent-primary)" strokeWidth={2} fill="var(--accent-primary)" fillOpacity={0.28} dot={{ r: 3, fill: 'var(--accent-primary)' }} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
      <ul className="radar-legend">
        {stats.map((s) => <li key={s.id}><span>{s.label}</span><b>Lv. {s.level}</b></li>)}
      </ul>
    </div>
  )
}
