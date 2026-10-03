'use client'

import { Palette, Check } from 'lucide-react'
import { Section, Row, Segmented, Toggle } from './controls'
import { SEASONS, ACCENTS, DEFAULT_THEME, resolveSeason } from '@/lib/theme/userTheme'

/** Theme picker (#34): applied live by OSContext, no reload. */
export default function AppearanceSection({ s, update }) {
  const theme = { ...DEFAULT_THEME, ...(s.theme || {}) }
  const set = (patch) => update({ theme: { ...theme, ...patch } })
  const winter = resolveSeason(theme) === 'winter'
  return (
    <Section id="appearance" icon={Palette} title="Appearance">
      <Row label="Season" hint={SEASONS.find((x) => x.id === theme.season)?.hint} stack>
        <Segmented label="Season" value={theme.season} options={SEASONS} onChange={(v) => set({ season: v })} />
      </Row>
      <Row label="Accent" hint={theme.accent === 'level' ? 'Shifts as you level up' : 'Fixed colour, whatever your level'} stack>
        <div className="set-swatches" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={theme.accent === a.id} aria-label={a.label} title={a.label}
              className={`set-swatch ${theme.accent === a.id ? 'is-on' : ''} ${a.color ? '' : 'is-level'}`}
              style={a.color ? { '--sw': a.color, '--sw2': a.color2 } : undefined} onClick={() => set({ accent: a.id })}>
              {theme.accent === a.id && <Check size={14} />}
            </button>
          ))}
          <span className="set-swatch-label">{ACCENTS.find((a) => a.id === theme.accent)?.label}</span>
        </div>
      </Row>
      <Row label="Snowfall" hint={winter ? 'Falling snow behind the app' : 'Only shown during the winter season'}>
        <Toggle label="Snowfall" checked={theme.snow !== false && winter} disabled={!winter} onChange={(v) => set({ snow: v })} />
      </Row>
      <Row label="Motion" hint={theme.motion === 'auto' ? 'Follows your device setting' : theme.motion === 'reduced' ? 'Animations off' : 'All animations on'}>
        <Segmented label="Motion" value={theme.motion} options={[{ id: 'auto', label: 'Auto' }, { id: 'reduced', label: 'Reduced' }, { id: 'full', label: 'Full' }]} onChange={(v) => set({ motion: v })} />
      </Row>
      <Row label="Density" hint="Compact fits more on screen">
        <Segmented label="Density" value={theme.density} options={[{ id: 'comfortable', label: 'Comfortable' }, { id: 'compact', label: 'Compact' }]} onChange={(v) => set({ density: v })} />
      </Row>
    </Section>
  )
}
