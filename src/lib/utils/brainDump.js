// Brain dump inbox (#39): pure helpers. Works before the round-2 columns exist
// by mapping the legacy status / topic fields and parsing #tags from the text.

export const KINDS = ['inbox', 'note', 'idea', 'archived']
export const STALE_DAYS = 14

const TAG_RE = /(^|\s)#([\p{L}\p{N}_-]{1,32})/gu

/** "Call Ramesh #school #urgent" → { text: 'Call Ramesh', tags: ['school', 'urgent'] } */
export function parseCapture(raw) {
  const tags = []
  const text = String(raw || '').replace(TAG_RE, (m, pre, tag) => {
    const t = tag.toLowerCase()
    if (!tags.includes(t)) tags.push(t)
    return pre
  }).replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
  return { text, tags }
}

export function tagsOf(item) {
  if (Array.isArray(item?.tags) && item.tags.length) return item.tags
  return parseCapture(item?.content).tags
}

/** Text without inline #tags (legacy rows keep them in the content). */
export const textOf = (item) => (Array.isArray(item?.tags) && item.tags.length ? item.content : parseCapture(item?.content).text || item?.content || '')

/** Kind of an item: the column when present, else derived from the legacy status. */
export function kindOf(item) {
  if (item?.kind && KINDS.includes(item.kind)) return item.kind
  const s = item?.status
  if (!s || s === 'inbox' || s === 'active') return 'inbox'
  if (s === 'idea' || item?.type === 'idea') return 'idea'
  if (s === 'note') return 'note'
  return 'archived' // done / organized / converted / discarded
}

export const isTrashed = (item) => item?.status === 'discarded' || item?.converted_to === 'trash'

export function ageDays(item, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(item?.created_at || now).getTime()) / 86400000))
}

export const ageLabel = (item, now) => {
  const d = ageDays(item, now)
  if (d === 0) {
    const h = Math.floor((now - new Date(item.created_at).getTime()) / 3600000)
    return h < 1 ? 'now' : `${h}h`
  }
  return d < 7 ? `${d}d` : d < 60 ? `${Math.floor(d / 7)}w` : `${Math.floor(d / 30)}mo`
}

/** First line, trimmed — used as a task / mission title. */
export const titleOf = (item) => textOf(item).split('\n')[0].slice(0, 140).trim()
