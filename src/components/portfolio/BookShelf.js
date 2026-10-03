'use client'

import { useEffect, useState } from 'react'
import { Star, BookOpen } from 'lucide-react'

const CACHE_KEY = 'lokios_book_covers'
const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} } }

/** Cover URL: the stored one, else Open Library (search by title + author, cached per device). */
function useCover(book) {
  const key = `${book.title}|${book.author || ''}`.toLowerCase()
  const [url, setUrl] = useState(book.cover_url || null)
  useEffect(() => {
    if (book.cover_url) return
    const cache = readCache()
    if (key in cache) { setUrl(cache[key]); return } // eslint-disable-line react-hooks/set-state-in-effect -- cached cover
    let cancelled = false
    const q = new URLSearchParams({ title: book.title, limit: '1', fields: 'cover_i' })
    if (book.author) q.set('author', book.author)
    fetch(`https://openlibrary.org/search.json?${q}`).then((r) => r.json()).then((d) => {
      const id = d?.docs?.[0]?.cover_i
      const found = id ? `https://covers.openlibrary.org/b/id/${id}-M.jpg` : null
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), [key]: found })) } catch {}
      if (!cancelled) setUrl(found)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [book.cover_url, book.title, book.author, key])
  return url
}

function BookSpine({ book, open, onToggle }) {
  const cover = useCover(book)
  const rating = Math.max(0, Math.min(5, parseInt(book.rating, 10) || 0))
  return (
    <button type="button" className={`bk ${open ? 'is-open' : ''}`} onClick={onToggle} aria-expanded={open} aria-label={`${book.title}${book.author ? ` by ${book.author}` : ''}`}>
      <span className="bk-cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <span className="bk-fallback"><BookOpen size={20} /><em>{book.title}</em></span>}</span>
      <span className="bk-title">{book.title}</span>
      {book.author && <span className="bk-author">{book.author}</span>}
      <span className="bk-stars" aria-label={`${rating} of 5 stars`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={11} className={i < rating ? 'is-on' : ''} />)}</span>
    </button>
  )
}

/** Portfolio → Books (#38): a shelf of covers with ratings and takeaways. */
export default function BookShelf({ books }) {
  const [open, setOpen] = useState(null)
  const sorted = [...books].sort((a, b) => String(b.date_completed || '').localeCompare(String(a.date_completed || '')))
  const sel = sorted.find((b) => b.id === open)
  const avg = books.length ? (books.reduce((s, b) => s + (parseInt(b.rating, 10) || 0), 0) / books.length).toFixed(1) : '–'
  const thisYear = books.filter((b) => String(b.date_completed || '').startsWith(String(new Date().getFullYear()))).length
  return (
    <section className="pf-card bk-shelf-card">
      <div className="pf-card-head"><BookOpen size={15} /> Shelf <span className="arena-hint ml-auto">{books.length} books · {thisYear} this year · avg {avg}★</span></div>
      {sorted.length === 0 ? <p className="ms-muted">No books yet — add one below.</p> : (
        <div className="bk-shelf">{sorted.map((b) => <BookSpine key={b.id} book={b} open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)} />)}</div>
      )}
      {sel && (
        <div className="bk-detail">
          <b>{sel.title}</b>{sel.author && <span> · {sel.author}</span>}
          {sel.date_completed && <span className="bk-date"> · finished {new Date(`${sel.date_completed}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          {sel.takeaways ? <p>{sel.takeaways}</p> : <p className="ms-muted">No takeaways written.</p>}
        </div>
      )}
    </section>
  )
}
