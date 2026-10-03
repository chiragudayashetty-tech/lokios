/**
 * POST /api/screen-time/import  (#44)
 * Headers: Authorization: Bearer <personal token from Settings → Integrations>
 * Body: { date?, total_hours, doom_scroll_minutes?, focus_hours?, streaming_hours?, categories? }
 * Upserts that day's screen_time_logs row (source 'import') and settles the day's
 * screen-time XP once (source id screen_time_<date>, re-imports replace it).
 */
import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { calculateScreenTimeXPPure } from '@/lib/utils/screenTimeScore'

const hours = z.coerce.number().min(0).max(24)
const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  total_hours: hours,
  doom_scroll_minutes: z.coerce.number().int().min(0).max(1440).optional().default(0),
  focus_hours: hours.optional().default(0),
  streaming_hours: hours.optional().default(0),
  categories: z.record(z.string().max(40), z.coerce.number().min(0).max(1440)).optional(),
})

// Best-effort rate limit: 10 requests / minute per token (per server instance)
const hits = new Map()
function limited(key) {
  const now = Date.now()
  const list = (hits.get(key) || []).filter((t) => now - t < 60000)
  list.push(now)
  hits.set(key, list)
  return list.length > 10
}

const tz = process.env.LOKIOS_TIMEZONE || 'Asia/Kolkata'
const todayIn = () => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
const json = (body, status = 200) => NextResponse.json(body, { status })

export async function POST(request) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return json({ error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY' }, 500)

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Missing bearer token' }, 401)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  if (limited(tokenHash)) return json({ error: 'Too many requests — max 10 per minute' }, 429)

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: tok, error: tokErr } = await sb.from('api_tokens').select('id, user_id').eq('token_hash', tokenHash).maybeSingle()
  if (tokErr) return json({ error: 'Token store unavailable — run the round-2 migration' }, 500)
  if (!tok) return json({ error: 'Invalid token' }, 401)

  let parsed
  try { parsed = Body.safeParse(await request.json()) } catch { return json({ error: 'Body must be JSON' }, 400) }
  if (!parsed.success) return json({ error: 'Invalid body', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, 400)
  const b = parsed.data
  const userId = tok.user_id
  const date = b.date || todayIn()

  const row = {
    user_id: userId,
    date,
    total_hours: b.total_hours,
    doom_scroll_minutes: b.doom_scroll_minutes,
    focus_hours: b.focus_hours,
    streaming_hours: b.streaming_hours,
    source: 'import',
    ...(b.categories ? { categories: b.categories } : {}),
  }
  const { data: existing } = await sb.from('screen_time_logs').select('id').eq('user_id', userId).eq('date', date).limit(1)
  const write = existing?.length
    ? await sb.from('screen_time_logs').update(row).eq('id', existing[0].id).select('id').single()
    : await sb.from('screen_time_logs').insert(row).select('id').single()
  if (write.error) return json({ error: `Could not save: ${write.error.message}` }, 500)

  // XP: same rule as manual logging; one ledger row per day, re-imports move the balance by the difference
  const { xpAmount, finalReason } = calculateScreenTimeXPPure(row)
  const sourceId = `screen_time_${date}`
  const { data: old } = await sb.from('xp_history').select('id, amount').eq('user_id', userId).eq('source_id', sourceId).limit(1)
  const prev = old?.[0]?.amount || 0
  const today = todayIn()
  const createdAt = date === today ? new Date().toISOString() : new Date(`${date}T12:00:00+05:30`).toISOString()
  if (old?.length) {
    if (xpAmount === 0) await sb.from('xp_history').delete().eq('id', old[0].id)
    else await sb.from('xp_history').update({ amount: xpAmount, description: `${finalReason} (auto-import)`, created_at: createdAt, occurred_on: date }).eq('id', old[0].id)
  } else if (xpAmount !== 0) {
    let ins = await sb.from('xp_history').insert({ user_id: userId, amount: xpAmount, source_type: 'screen_time', source_id: sourceId, description: `${finalReason} (auto-import)`, stat_category: 'discipline', created_at: createdAt, occurred_on: date })
    if (ins.error && /occurred_on/.test(ins.error.message || '')) {
      ins = await sb.from('xp_history').insert({ user_id: userId, amount: xpAmount, source_type: 'screen_time', source_id: sourceId, description: `${finalReason} (auto-import)`, stat_category: 'discipline', created_at: createdAt })
    }
  }
  const delta = xpAmount - prev
  if (delta !== 0) {
    const { data: prof } = await sb.from('profiles').select('total_xp').eq('id', userId).single()
    await sb.from('profiles').update({ total_xp: (prof?.total_xp || 0) + delta }).eq('id', userId)
  }
  await sb.from('api_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id)

  return json({ ok: true, date, xp: xpAmount, reason: finalReason })
}

export function GET() {
  return json({ usage: 'POST JSON { date?, total_hours, doom_scroll_minutes, focus_hours, streaming_hours, categories? } with Authorization: Bearer <token>' })
}
