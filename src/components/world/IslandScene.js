'use client'

import { TREE_STAGES } from '@/lib/world/worldModel'

// Pixel-art island. 320×200 viewBox, crisp edges; every object is a few rects.
const W = 320
const H = 200
const CX = 160
const CY = 116

const GREENS = ['#3fae5a', '#2f9e6e', '#5bbf4a', '#3a9a3f', '#4cb89a', '#6cc04a']
const DRY = ['#b8863b', '#a8742e']
const ROOFS = ['#d9534f', '#3987e5', '#c98500', '#9085e9', '#d55181', '#199e70']

const pos = (o, world) => {
  const rx = 132 * world.size
  const ry = 62 * world.size
  return { x: Math.round(CX + o.u * rx * 0.86), y: Math.round(CY + o.v * ry * 0.78) }
}

function Tree({ t, x, y, onPick, picked }) {
  if (t.stump) {
    return <g onClick={() => onPick(t)} className="wd-obj"><title>{`${t.name} · stopped`}</title><rect x={x - 3} y={y - 3} width={6} height={3} fill="#7a5230" /><rect x={x - 2} y={y - 4} width={4} height={1} fill="#a87a4a" /></g>
  }
  const k = [0.35, 0.55, 0.75, 1, 1.25, 1.55][t.stage]
  const leaf = t.dry ? DRY[Math.floor(t.seed * DRY.length)] : GREENS[Math.floor(t.seed * GREENS.length)]
  const dark = t.dry ? '#8a5a22' : 'rgba(0,0,0,0.18)'
  const trunkH = Math.max(2, Math.round(6 * k))
  const r = Math.max(2, Math.round(7 * k))
  const top = y - trunkH - r * 2
  return (
    <g onClick={() => onPick(t)} className={`wd-obj ${picked ? 'is-picked' : ''}`}>
      <title>{`${t.name} · ${TREE_STAGES[t.stage].name} · ${t.count} check-ins${t.dry ? ' · dry: not done in 7+ days' : ''}`}</title>
      <rect x={x - Math.round(r * 0.9)} y={y - 1} width={Math.round(r * 1.8)} height={2} fill="rgba(0,0,0,0.18)" />
      <rect x={x - 1} y={y - trunkH} width={2 + (t.stage >= 4 ? 1 : 0)} height={trunkH} fill="#7a5230" />
      {t.stage === 0 ? (
        <rect x={x - 1} y={y - 3} width={2} height={2} fill={leaf} />
      ) : (
        <>
          <rect x={x - r} y={top + r * 0.5} width={r * 2} height={r * 1.4} fill={leaf} />
          <rect x={x - r * 0.7} y={top} width={r * 1.4} height={r * 2} fill={leaf} />
          <rect x={x - r} y={top + r * 1.4} width={r * 2} height={Math.max(1, r * 0.5)} fill={dark} />
          {t.stage >= 4 && <rect x={x - r * 1.25} y={top + r * 0.8} width={r * 2.5} height={r * 0.8} fill={leaf} />}
          {t.bloom && !t.dry && [[-0.5, 0.4], [0.3, 0.2], [0.1, 0.9], [-0.2, 1.1], [0.55, 0.85]].slice(0, 2 + Math.min(3, t.stage)).map(([a, b], i) => (
            <rect key={i} x={Math.round(x + a * r)} y={Math.round(top + b * r)} width={2} height={2} fill={i % 2 ? '#ffd166' : '#ff8fb1'} />
          ))}
        </>
      )}
    </g>
  )
}

function House({ h, x, y, night, onPick, picked }) {
  const roof = ROOFS[Math.floor(h.seed * ROOFS.length)]
  return (
    <g onClick={() => onPick(h)} className={`wd-obj ${picked ? 'is-picked' : ''}`}>
      <title>{`${h.name} · built ${h.built}`}</title>
      <rect x={x - 6} y={y - 1} width={12} height={2} fill="rgba(0,0,0,0.18)" />
      <rect x={x - 5} y={y - 7} width={10} height={7} fill="#efe3c8" />
      <polygon points={`${x - 7},${y - 7} ${x},${y - 12} ${x + 7},${y - 7}`} fill={roof} />
      <rect x={x - 3} y={y - 5} width={2} height={2} fill={night ? '#ffd166' : '#6b8fb5'} />
      <rect x={x + 1} y={y - 4} width={2} height={4} fill="#8a5a3a" />
    </g>
  )
}

function Landmark({ l, x, y, onPick, picked }) {
  const tip = l.kind === 'landmark' ? `${l.name} · completed ${l.completed}` : l.kind === 'ruin' ? `${l.name} · failed` : `${l.name} · ${l.progress}% built${l.deadline ? ` · deadline ${l.deadline}` : ''}${l.late ? ' · past deadline' : ''}`
  if (l.kind === 'landmark') {
    return (
      <g onClick={() => onPick(l)} className={`wd-obj ${picked ? 'is-picked' : ''}`}>
        <title>{tip}</title>
        <rect x={x - 9} y={y - 1} width={18} height={3} fill="rgba(0,0,0,0.2)" />
        <rect x={x - 7} y={y - 6} width={14} height={6} fill="#cfd6e4" />
        <rect x={x - 5} y={y - 26} width={10} height={20} fill="#e8edf6" />
        <rect x={x - 5} y={y - 26} width={2} height={20} fill="#b9c3d6" />
        <rect x={x - 6} y={y - 29} width={12} height={3} fill="#cfd6e4" />
        <rect x={x - 1} y={y - 19} width={2} height={3} fill="#3987e5" />
        <rect x={x} y={y - 41} width={1} height={12} fill="#8a8fa0" />
        <rect className="wd-flag" x={x + 1} y={y - 41} width={7} height={4} fill="#ffd166" />
      </g>
    )
  }
  if (l.kind === 'ruin') {
    return (
      <g onClick={() => onPick(l)} className={`wd-obj ${picked ? 'is-picked' : ''}`}>
        <title>{tip}</title>
        <rect x={x - 7} y={y - 5} width={14} height={5} fill="#8b8f9c" />
        <rect x={x - 5} y={y - 11} width={4} height={6} fill="#9ca0ad" />
        <rect x={x + 2} y={y - 8} width={3} height={3} fill="#9ca0ad" />
      </g>
    )
  }
  const h = Math.max(3, Math.round((l.progress / 100) * 20))
  return (
    <g onClick={() => onPick(l)} className={`wd-obj ${picked ? 'is-picked' : ''}`}>
      <title>{tip}</title>
      <rect x={x - 8} y={y - 1} width={16} height={2} fill="rgba(0,0,0,0.18)" />
      <rect x={x - 6} y={y - h} width={12} height={h} fill="#e3d5b5" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={x - 7} y={y - 6 - i * 6} width={14} height={1} fill={l.late ? '#e5484d' : '#c98500'} opacity={0.9} />)}
      <rect x={x - 7} y={y - 25} width={1} height={25} fill={l.late ? '#e5484d' : '#c98500'} />
      <rect x={x + 6} y={y - 25} width={1} height={25} fill={l.late ? '#e5484d' : '#c98500'} />
      {/* crane */}
      <rect x={x + 10} y={y - 30} width={1} height={30} fill="#f0b429" />
      <rect x={x + 2} y={y - 30} width={14} height={1} fill="#f0b429" />
      <rect className="wd-hook" x={x + 4} y={y - 29} width={1} height={6} fill="#8a8fa0" />
    </g>
  )
}

function Boat({ i }) {
  const spots = [[34, 160], [282, 150], [60, 70], [262, 64], [22, 112], [298, 108]]
  const [x, y] = spots[i]
  return (
    <g className="wd-boat" style={{ animationDelay: `${i * 0.7}s` }}>
      <rect x={x - 5} y={y} width={10} height={2} fill="#7a5230" />
      <rect x={x - 4} y={y + 2} width={8} height={1} fill="#5c3d22" />
      <rect x={x} y={y - 8} width={1} height={8} fill="#5c3d22" />
      <polygon points={`${x + 1},${y - 8} ${x + 6},${y - 2} ${x + 1},${y - 2}`} fill="#f4f4f4" />
    </g>
  )
}

/** The island on `world` (from buildWorld). onPick(obj) when an object is tapped. */
export default function IslandScene({ world, onPick = () => {}, picked, compact = false }) {
  const { night, dusk, weather, fog } = world
  const sky = night ? ['#0b1430', '#1b2a52'] : dusk ? ['#f08a5d', '#f6c177'] : weather === 'rain' ? ['#5b6b80', '#8494a8'] : weather === 'cloudy' ? ['#8fb3d9', '#c3d7ea'] : ['#5fb4f0', '#a9dcf7']
  const sea = night ? ['#0e2a4a', '#081a33'] : weather === 'rain' ? ['#3d6283', '#2c4b68'] : ['#2f8fd0', '#1f6fb0']
  const rx = Math.round(132 * world.size)
  const ry = Math.round(62 * world.size)

  const objs = [
    ...world.trees.map((t) => ({ o: t, ...pos(t, world) })),
    ...world.houses.map((h) => ({ o: h, ...pos(h, world) })),
    ...world.landmarks.map((l) => ({ o: l, ...pos(l, world) })),
  ].sort((a, b) => a.y - b.y)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`wd-scene ${compact ? 'is-compact' : ''}`} shapeRendering="crispEdges" role="img"
      aria-label={`Island on ${world.asOf}: ${world.stats.trees} trees, ${world.stats.houses} houses, ${world.stats.landmarks} landmarks, ${weather}${fog ? ', foggy' : ''}`}>
      <defs>
        <linearGradient id="wd-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient>
        <linearGradient id="wd-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={sea[0]} /><stop offset="1" stopColor={sea[1]} /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#wd-sky)" />
      <rect y={52} width={W} height={H - 52} fill="url(#wd-sea)" />
      {/* sun / moon */}
      {night ? (
        <>
          <circle cx={268} cy={20} r={7} fill="#f4f1de" shapeRendering="auto" /><circle cx={272} cy={17} r={6} fill={sky[0]} shapeRendering="auto" />
          {[[30, 12], [80, 26], [140, 10], [200, 22], [230, 8], [110, 36], [300, 30]].map(([a, b], i) => <rect key={i} className="wd-star" style={{ animationDelay: `${i * 0.4}s` }} x={a} y={b} width={1} height={1} fill="#fff" />)}
        </>
      ) : weather !== 'rain' && <rect x={258} y={12} width={16} height={16} fill={dusk ? '#ffb347' : '#ffd84d'} />}
      {/* waves */}
      {[[20, 70], [90, 92], [250, 84], [40, 180], [210, 186], [290, 170], [140, 192]].map(([a, b], i) => <rect key={i} className="wd-wave" style={{ animationDelay: `${i * 0.5}s` }} x={a} y={b} width={8} height={1} fill="rgba(255,255,255,0.45)" />)}
      {Array.from({ length: world.boats }, (_, i) => <Boat key={i} i={i} />)}

      {/* island */}
      <ellipse cx={CX} cy={CY + 4} rx={rx + 8} ry={ry + 6} fill="rgba(255,255,255,0.25)" />
      <ellipse cx={CX} cy={CY + 3} rx={rx + 3} ry={ry + 3} fill="#e9d29a" />
      <ellipse cx={CX} cy={CY} rx={rx - 4} ry={ry - 3} fill={night ? '#2e6b3a' : '#5cae4f'} />
      <ellipse cx={CX - rx * 0.25} cy={CY - ry * 0.2} rx={rx * 0.45} ry={ry * 0.4} fill={night ? '#357a42' : '#68bb58'} />

      {objs.map(({ o, x, y }) => (
        o.kind === 'tree' ? <Tree key={o.id} t={o} x={x} y={y} onPick={onPick} picked={picked === o.id} />
          : o.kind === 'house' ? <House key={o.id} h={o} x={x} y={y} night={night} onPick={onPick} picked={picked === o.id} />
            : <Landmark key={o.id} l={o} x={x} y={y} onPick={onPick} picked={picked === o.id} />
      ))}

      {/* weather */}
      {(weather === 'cloudy' || weather === 'rain') && [[40, 18, 1], [150, 28, 1.3], [230, 16, 0.9]].map(([a, b, k], i) => (
        <g key={i} className="wd-cloud" style={{ animationDelay: `${i * 3}s` }} fill={weather === 'rain' ? '#9aa5b5' : '#ffffff'} opacity={0.92}>
          <rect x={a} y={b + 4} width={30 * k} height={8} /><rect x={a + 6 * k} y={b} width={16 * k} height={6} />
        </g>
      ))}
      {weather === 'rain' && Array.from({ length: 36 }, (_, i) => <rect key={i} className="wd-rain" style={{ animationDelay: `${(i % 9) * 0.11}s` }} x={(i * 37) % W} y={(i * 23) % 120} width={1} height={5} fill="rgba(210,225,255,0.7)" />)}
      {fog && <rect className="wd-fog" width={W} height={H} fill="#cfd6e4" />}
    </svg>
  )
}
