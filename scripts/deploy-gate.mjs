// Vercel "Ignored Build Step" (vercel.json → ignoreCommand).
// Exit 1 = build, exit 0 = skip. Production deploys only on Saturdays (India time);
// preview deployments always build so changes can be tested during the week.
//
// Overrides:
// - put [deploy-now] in the commit message (or the PR title when merging) for an emergency fix
// - DEPLOY_GATE=off in the Vercel project's environment variables disables the freeze

const env = process.env.VERCEL_ENV
const message = process.env.VERCEL_GIT_COMMIT_MESSAGE || ''
const TZ = 'Asia/Kolkata'

// One-off: lets the bug fixes merged right after the freeze was added ship (until end of Sun 4 Oct 2026 IST).
const GRACE_UNTIL = new Date('2026-10-04T23:59:59+05:30')

const now = new Date()
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: TZ }).format(now)
const stamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(now)

function build(reason) { console.log(`✅ Building: ${reason}`); process.exit(1) }
function skip(reason) { console.log(`⏸  Skipping production deploy: ${reason}`); process.exit(0) }

if (env !== 'production') build(`${env || 'non-production'} deployment (previews are never frozen)`)
if (process.env.DEPLOY_GATE === 'off') build('DEPLOY_GATE=off')
if (/\[deploy-now\]/i.test(message)) build('[deploy-now] override in the commit message')
if (weekday === 'Saturday') build(`it's Saturday (${stamp} IST)`)
if (now <= GRACE_UNTIL) build('one-off grace window for the freeze rollout')
skip(`releases go out on Saturdays only — it's ${weekday} ${stamp} IST. Redeploy main on Saturday (Vercel → Deployments → ⋯ → Redeploy) or merge then.`)
