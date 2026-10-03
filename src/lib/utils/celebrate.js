// Lightweight, dependency-free celebration effects: confetti bursts + haptic taps.
// A single fixed canvas is created lazily and removed when the last particle dies.

const PALETTE = ['#9B8CFF', '#FF7AC6', '#6FD3FF', '#3DDC97', '#FFB547', '#FFFFFF']
const WINTER_PALETTE = ['#FFFFFF', '#E6F6FF', '#8FD3FF', '#7DE8E0', '#B9A8FF', '#C4B5FD']

function seasonalPalette() {
  return document.documentElement.dataset.season === 'winter' ? WINTER_PALETTE : PALETTE
}

let canvas = null
let ctx = null
let particles = []
let frame = 0

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function ensureCanvas() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '2000',
  })
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
  resize()
  window.addEventListener('resize', resize)
}

function resize() {
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function teardown() {
  window.removeEventListener('resize', resize)
  canvas?.remove()
  canvas = null
  ctx = null
  frame = 0
}

function tick() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  particles = particles.filter(p => p.life > 0)
  for (const p of particles) {
    p.vx *= 0.985
    p.vy = p.vy * 0.985 + p.gravity
    p.x += p.vx
    p.y += p.vy
    p.rot += p.vr
    p.life -= 1
    const alpha = Math.min(1, p.life / 30)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.fillStyle = p.color
    if (p.shape === 'circle') {
      ctx.beginPath()
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Flat ribbon that "flips" as it spins
      ctx.scale(1, Math.cos(p.rot * 2))
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    }
    ctx.restore()
  }
  if (particles.length) frame = requestAnimationFrame(tick)
  else teardown()
}

/**
 * Fire a confetti burst.
 * @param {{ x?: number, y?: number, count?: number, spread?: number, power?: number, colors?: string[] }} opts
 *   x / y are viewport fractions (0–1). Defaults to the centre of the screen.
 */
export function confetti({ x = 0.5, y = 0.5, count = 70, spread = Math.PI * 2, power = 9, colors, angle = -Math.PI / 2 } = {}) {
  if (typeof window === 'undefined' || prefersReducedMotion()) return
  ensureCanvas()
  colors = colors || seasonalPalette()
  const ox = x * window.innerWidth
  const oy = y * window.innerHeight
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread
    const v = power * (0.45 + Math.random() * 0.75)
    particles.push({
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      gravity: 0.22 + Math.random() * 0.08,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: colors[(Math.random() * colors.length) | 0],
      shape: Math.random() > 0.65 ? 'circle' : 'ribbon',
      life: 70 + Math.random() * 50,
    })
  }
  if (!frame) frame = requestAnimationFrame(tick)
}

/** Short haptic tick on devices that support it. */
export function haptic(pattern = 12) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern)
  } catch {}
}

let lastLocalBurst = 0

/** Burst at a viewport pixel position — used for taps on completion controls. */
export function celebrateAt(clientX, clientY) {
  if (typeof window === 'undefined') return
  lastLocalBurst = Date.now()
  haptic(14)
  confetti({ x: clientX / window.innerWidth, y: clientY / window.innerHeight, count: 42, spread: Math.PI * 0.9, power: 9 })
}

/**
 * Small win (XP gain): a quick upward pop near the toast. Skipped when the
 * user just got a burst at their tap point, so one action = one celebration.
 */
export function celebrateSmall(x = 0.85, y = 0.9) {
  haptic(12)
  if (Date.now() - lastLocalBurst < 4000) return
  confetti({ x, y, count: 34, spread: Math.PI / 2.2, power: 10 })
}

/** Big win (level up): two side cannons plus a centre bloom. */
export function celebrateBig() {
  haptic([18, 40, 28])
  confetti({ x: 0.1, y: 0.85, count: 80, spread: Math.PI / 3, power: 15, angle: -Math.PI / 3 })
  confetti({ x: 0.9, y: 0.85, count: 80, spread: Math.PI / 3, power: 15, angle: (-2 * Math.PI) / 3 })
  setTimeout(() => confetti({ x: 0.5, y: 0.4, count: 90, power: 8 }), 220)
}
