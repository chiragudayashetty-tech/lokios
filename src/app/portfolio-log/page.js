'use client'

import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import HudPanel from '@/components/ui/HudPanel'
import { getLocalDateStr } from '@/lib/utils/dates'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProfile } from '@/lib/hooks/useProfile'
import { useOS } from '@/lib/context/OSContext'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Briefcase, Code, Terminal, Database, Shield, Plus, ExternalLink, 
  Image as ImageIcon, Link as LinkIcon, Edit2, Save, FileText, Clock, 
  ChevronDown, ChevronUp, Trash2, BookOpen, Star, Sparkles, Search, Filter, Book,
  Check, Trophy, Printer, RefreshCw
} from 'lucide-react'

export default function ProofOfWork() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { xp: { awardXP, deductXP } } = useOS()

  // Active tab: 'timeline' | 'reviews' | 'books' | 'projects' | 'resume'
  const [activeTab, setActiveTab] = useState('timeline')
  const [expandedReview, setExpandedReview] = useState(null)
  const [expandedLogId, setExpandedLogId] = useState(null)
  const [expandedBookId, setExpandedBookId] = useState(null)
  const [showAllResumeLogs, setShowAllResumeLogs] = useState(false)

  // Executive Resume Bullet Point Parser (Strips raw markdown section headers)
  const parseResumeHighlights = (description) => {
    if (!description) return []
    const cleanText = description.replace(/\r\n/g, '\n')
    const highlights = []

    // Extract What Went Well / Achievements
    const wentWellMatch = cleanText.match(/###\s*What went well\??([\s\S]*?)(?=###|$)/i)
    if (wentWellMatch && wentWellMatch[1]) {
      const points = wentWellMatch[1]
        .split(/\n+/)
        .map(s => s.replace(/^###\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/^[\-\*\•]\s*/, '').trim())
        .filter(s => s.length > 8 && !s.toLowerCase().startsWith('what went well'))
      highlights.push(...points)
    }

    // Extract Priorities / Key Wins
    const prioritiesMatch = cleanText.match(/###\s*Priorities for Next Week[\s\S]*?(?=\n\n|$)/i)
    if (prioritiesMatch && prioritiesMatch[0]) {
      const points = prioritiesMatch[0]
        .split('\n')
        .map(s => s.replace(/^###\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/\[DONE\]/g, '✓').replace(/\[FAILED\]/g, '').trim())
        .filter(s => s.length > 8 && !s.startsWith('###'))
      highlights.push(...points)
    }

    // Fallback: If no markdown section headers found
    if (highlights.length === 0) {
      const cleanLines = cleanText
        .split(/\n+/)
        .map(s => s.replace(/^###\s*/, '').replace(/^\d+[\.\)]\s*/, '').replace(/^[\-\*\•]\s*/, '').trim())
        .filter(s => s.length > 8)
      return cleanLines.slice(0, 4)
    }

    return Array.from(new Set(highlights)).slice(0, 5)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab')) {
      setActiveTab(params.get('tab'))
    }
  }, [])

  // DATA STATES
  const [logs, setLogs] = useState([])
  const [projects, setProjects] = useState([])
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState(null)
  const [newMediaUrl, setNewMediaUrl] = useState('')

  // Edit Log State
  const [editingLogId, setEditingLogId] = useState(null)
  const [editLogForm, setEditLogForm] = useState({})

  // New Log Form State
  const [showAddLog, setShowAddLog] = useState(false)
  const [newLog, setNewLog] = useState({ title: '', description: '', type: 'project_work', duration: '', duration_unit: 'hours', mediaUrl: '' })

  // New Project Form State
  const [showAddProject, setShowAddProject] = useState(false)
  const [newProj, setNewProj] = useState({ title: '', description: '', status: 'active', tech_stack: '' })

  // BOOKS COMPLETED STATE
  const [showAddBook, setShowAddBook] = useState(false)
  const [bookSearch, setBookSearch] = useState('')
  const [bookCategoryFilter, setBookCategoryFilter] = useState('all')
  const [xpToast, setXpToast] = useState(null)

  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    category: 'Business',
    rating: 5,
    date_completed: getLocalDateStr(),
    cover_url: '',
    takeaways: ''
  })

  const [editingBookId, setEditingBookId] = useState(null)
  const [editBookForm, setEditBookForm] = useState({})

  useEffect(() => {
    if (!user) return
    fetchData()
  }, [user])

  const fetchData = async () => {
    const supabase = createClient()
    try {
      const [logsRes, projRes, booksRes] = await Promise.all([
        supabase.from('work_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('books_completed').select('*').eq('user_id', user.id).order('date_completed', { ascending: false })
      ])

      if (logsRes.data) setLogs(logsRes.data)
      if (projRes.data) setProjects(projRes.data)
      
      if (booksRes.data) {
        setBooks(booksRes.data)
        if (typeof window !== 'undefined') localStorage.setItem('lokios_books_completed_cache', JSON.stringify(booksRes.data))
      } else if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('lokios_books_completed_cache')
        if (cached) setBooks(JSON.parse(cached))
      }
    } catch (err) {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('lokios_books_completed_cache')
        if (cached) setBooks(JSON.parse(cached))
      }
    } finally {
      setLoading(false)
    }
  }

  // LOG HANDLERS
  const startEditLog = (log) => {
    setEditingLogId(log.id)
    setEditLogForm({
      title: log.title || '',
      type: log.type || 'other',
      description: log.description || '',
      duration: log.duration_hours || '',
      duration_unit: 'hours'
    })
  }

  const saveEditLog = async (id) => {
    const supabase = createClient()
    await supabase.from('work_logs').update({
      title: editLogForm.title,
      type: editLogForm.type,
      description: editLogForm.description,
      duration_hours: editLogForm.duration ? parseFloat(editLogForm.duration) * (editLogForm.duration_unit === 'days' ? 24 : 1) : null
    }).eq('id', id)
    setEditingLogId(null)
    fetchData()
  }

  const handleDeleteLog = async (id) => {
    if (confirm("Are you sure you want to delete this work log?")) {
      const supabase = createClient()
      await supabase.from('work_logs').delete().eq('id', id)
      setLogs(prev => prev.filter(l => l.id !== id))
      deductXP(2, 'work_log', id, 'Deleted Work Log')
    }
  }

  const handleAddMedia = async (logId, currentMedia) => {
    if (!newMediaUrl.trim()) return
    const supabase = createClient()
    const updatedMedia = [...(currentMedia || []), newMediaUrl]
    
    const { error } = await supabase.from('work_logs').update({ media_urls: updatedMedia }).eq('id', logId)
    if (!error) {
      setLogs(prev => prev.map(l => l.id === logId ? { ...l, media_urls: updatedMedia } : l))
      setNewMediaUrl('')
      setEditingId(null)
    }
  }

  const handleCreateLog = async (e) => {
    e.preventDefault()
    if (!newLog.title.trim()) return
    const supabase = createClient()
    const parsedDuration = newLog.duration ? parseFloat(newLog.duration) : null
    const duration_hours = parsedDuration ? (newLog.duration_unit === 'days' ? parsedDuration * 24 : parsedDuration) : null

    const payload = {
      user_id: user.id,
      title: newLog.title,
      description: newLog.description,
      type: newLog.type,
      duration_hours: duration_hours,
      date: getLocalDateStr()
    }

    if (newLog.mediaUrl.trim()) {
      payload.media_urls = [newLog.mediaUrl.trim()]
    }

    const { data, error } = await supabase.from('work_logs').insert([payload]).select()
    
    if (error) {
      alert(`UPLOAD FAILED: ${error.message}\n\nPlease let the AI know what this error says!`)
      return
    }

    if (data) {
      setLogs([data[0], ...logs])
      setShowAddLog(false)
      setNewLog({ title: '', description: '', type: 'project_work', duration: '', duration_unit: 'hours', mediaUrl: '' })
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!newProj.title.trim()) return
    const supabase = createClient()
    const { data, error } = await supabase.from('projects').insert([{
      user_id: user.id,
      title: newProj.title,
      description: newProj.description,
      status: newProj.status,
      tech_stack: newProj.tech_stack.split(',').map(s => s.trim()).filter(Boolean)
    }]).select()
    
    if (data) {
      setProjects([data[0], ...projects])
      setShowAddProject(false)
      setNewProj({ title: '', description: '', status: 'active', tech_stack: '' })
    }
  }

  // ----------------------------------------------------
  // BOOK HANDLERS (+10 XP REWARD PER COMPLETED BOOK)
  // ----------------------------------------------------
  const handleCreateBook = async (e) => {
    e.preventDefault()
    if (!newBook.title.trim() || !user) return

    const payload = {
      user_id: user.id,
      title: newBook.title.trim(),
      author: newBook.author.trim() || 'Unknown Author',
      category: newBook.category || 'Business',
      rating: parseInt(newBook.rating) || 5,
      date_completed: newBook.date_completed || getLocalDateStr(),
      cover_url: newBook.cover_url.trim() || '',
      takeaways: newBook.takeaways.trim() || ''
    }

    const updated = [payload, ...books].sort((a, b) => (b.date_completed || '').localeCompare(a.date_completed || ''))
    setBooks(updated)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_books_completed_cache', JSON.stringify(updated))

    try {
      const supabase = createClient()
      await supabase.from('books_completed').insert([payload])
    } catch (err) {}

    awardXP(10, `Completed Book: ${payload.title}`)
    setXpToast(`+10 XP: Completed "${payload.title}"`)
    setTimeout(() => setXpToast(null), 3500)

    setShowAddBook(false)
    setNewBook({
      title: '',
      author: '',
      category: 'Business',
      rating: 5,
      date_completed: getLocalDateStr(),
      cover_url: '',
      takeaways: ''
    })
  }

  const startEditBook = (book) => {
    setEditingBookId(book.id || book.title)
    setEditBookForm({
      title: book.title || '',
      author: book.author || '',
      category: book.category || 'Business',
      rating: book.rating || 5,
      date_completed: book.date_completed || getLocalDateStr(),
      cover_url: book.cover_url || '',
      takeaways: book.takeaways || ''
    })
  }

  const saveEditBook = async (bookId) => {
    const updatedBooks = books.map(b => {
      if ((b.id && b.id === bookId) || b.title === editBookForm.title) {
        return { ...b, ...editBookForm }
      }
      return b
    })

    setBooks(updatedBooks)
    if (typeof window !== 'undefined') localStorage.setItem('lokios_books_completed_cache', JSON.stringify(updatedBooks))

    try {
      const supabase = createClient()
      if (bookId) {
        await supabase.from('books_completed').update(editBookForm).eq('id', bookId)
      }
    } catch (err) {}

    setEditingBookId(null)
  }

  const handleDeleteBook = async (bookId, title) => {
    if (confirm(`Are you sure you want to remove "${title}" from your completed books archive?`)) {
      const filtered = books.filter(b => (b.id ? b.id !== bookId : b.title !== title))
      setBooks(filtered)
      if (typeof window !== 'undefined') localStorage.setItem('lokios_books_completed_cache', JSON.stringify(filtered))

      try {
        if (bookId) {
          const supabase = createClient()
          await supabase.from('books_completed').delete().eq('id', bookId)
        }
      } catch (err) {}

      deductXP(10, 'book', bookId, `Removed Book: ${title}`)
      setXpToast(`-10 XP: Removed "${title}"`)
      setTimeout(() => setXpToast(null), 3500)
    }
  }

  // Filtered books
  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      const matchesSearch = (b.title || '').toLowerCase().includes(bookSearch.toLowerCase()) ||
                            (b.author || '').toLowerCase().includes(bookSearch.toLowerCase()) ||
                            (b.takeaways || '').toLowerCase().includes(bookSearch.toLowerCase())
      const matchesCategory = bookCategoryFilter === 'all' || (b.category || 'Business').toLowerCase() === bookCategoryFilter.toLowerCase()
      return matchesSearch && matchesCategory
    })
  }, [books, bookSearch, bookCategoryFilter])

  // Book stats
  const avgBookRating = useMemo(() => {
    if (books.length === 0) return '0.0'
    const sum = books.reduce((acc, b) => acc + (parseInt(b.rating) || 5), 0)
    return (sum / books.length).toFixed(1)
  }, [books])

  if (loading) return <AppShell><div className="flex-center h-full"><span className="typewriter-text">ACCESSING ARCHIVES...</span></div></AppShell>

  return (
    <AppShell>
      {/* Floating XP Toast */}
      <AnimatePresence>
        {xpToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[99999] bg-amber text-black font-mono font-bold text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-amber/40"
          >
            <Sparkles size={15} />
            <span>{xpToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="page-container max-w-5xl">
        <header className="page-header flex-between flex-wrap gap-4">
          <div>
            <h1 className="page-title flex items-center gap-3"><Terminal className="text-amber" /> PORTFOLIO ENGINE</h1>
            <p className="page-subtitle">Proof of work, books completed, project history, and auto-generated resume.</p>
          </div>
        </header>

        {/* TABS */}
        <div className="tab-list mb-6">
          <button className={`tab-item ${activeTab === 'timeline' ? 'active tab-active' : ''}`} onClick={() => setActiveTab('timeline')}>
            TIMELINE LOGS
          </button>
          <button className={`tab-item ${activeTab === 'reviews' ? 'active tab-active' : ''}`} onClick={() => setActiveTab('reviews')}>
            WEEKLY REVIEWS
          </button>
          <button className={`tab-item ${activeTab === 'books' ? 'active tab-active' : ''}`} onClick={() => setActiveTab('books')}>
            BOOKS COMPLETED ({books.length})
          </button>
          <button className={`tab-item ${activeTab === 'projects' ? 'active tab-active' : ''}`} onClick={() => setActiveTab('projects')}>
            PROJECTS
          </button>
          <button className={`tab-item ${activeTab === 'resume' ? 'active tab-active' : ''}`} onClick={() => setActiveTab('resume')}>
            RESUME (AUTO-GEN)
          </button>
        </div>

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div className="flex-col gap-6">
            <div className="flex justify-end">
              <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setShowAddLog(!showAddLog)}>
                <Plus size={16} /> ADD LOG
              </button>
            </div>

            <AnimatePresence>
              {showAddLog && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <HudPanel label="NEW WORK LOG" className="border-amber mb-6">
                    <form onSubmit={handleCreateLog} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">TITLE</label>
                        <input type="text" className="input font-mono text-sm" value={newLog.title} onChange={e => setNewLog({...newLog, title: e.target.value})} required />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">TYPE</label>
                        <select className="select font-mono text-sm" value={newLog.type} onChange={e => setNewLog({...newLog, type: e.target.value})}>
                          <option value="project_work">PROJECT WORK</option>
                          <option value="content">CONTENT CREATION</option>
                          <option value="meeting">MEETING / SALES</option>
                          <option value="learning">LEARNING</option>
                          <option value="other">OTHER</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-mono text-xs text-muted mb-1 block">DESCRIPTION</label>
                        <textarea className="textarea font-mono text-sm h-20" value={newLog.description} onChange={e => setNewLog({...newLog, description: e.target.value})} />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">DURATION</label>
                        <div className="flex gap-2">
                          <input type="text" inputMode="decimal" className="input font-mono text-sm" style={{ flex: 1, minWidth: '60px' }} value={newLog.duration} onChange={e => setNewLog({...newLog, duration: e.target.value})} placeholder="0" />
                          <select className="select font-mono text-sm" style={{ width: '120px', flexShrink: 0 }} value={newLog.duration_unit} onChange={e => setNewLog({...newLog, duration_unit: e.target.value})}>
                            <option value="hours">HOURS</option>
                            <option value="days">DAYS</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">ATTACH LINK / IMAGE URL</label>
                        <input type="url" className="input font-mono text-sm" value={newLog.mediaUrl} onChange={e => setNewLog({...newLog, mediaUrl: e.target.value})} placeholder="https://..." />
                      </div>
                      <div className="flex items-end justify-end md:col-span-2 mt-2">
                        <button type="submit" className="btn btn-primary w-full md:w-auto">SAVE LOG</button>
                      </div>
                    </form>
                  </HudPanel>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-col gap-0 border-l border-border-strong ml-4 pl-6 relative">
              {logs.filter(l => !l.title?.startsWith('Weekly Debrief')).map((log) => (
                <div key={log.id} className="relative pb-8 group">
                  <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-border-color border border-border-strong group-hover:bg-amber transition-colors z-10" />
                  
                  <div className="bg-tertiary border border-border-color p-4 hover:border-amber transition-colors">
                    {editingLogId === log.id ? (
                      <div className="flex-col gap-3">
                        <input type="text" className="input font-mono text-sm py-1" value={editLogForm.title} onChange={e=>setEditLogForm({...editLogForm, title: e.target.value})} />
                        <select className="select font-mono text-sm py-1" value={editLogForm.type} onChange={e=>setEditLogForm({...editLogForm, type: e.target.value})}>
                          <option value="project_work">PROJECT WORK</option>
                          <option value="content">CONTENT CREATION</option>
                          <option value="meeting">MEETING / SALES</option>
                          <option value="learning">LEARNING</option>
                          <option value="other">OTHER</option>
                        </select>
                        <textarea className="textarea font-mono text-sm py-1" value={editLogForm.description} onChange={e=>setEditLogForm({...editLogForm, description: e.target.value})} rows={2} />
                        <div className="flex gap-2">
                          <input type="text" inputMode="decimal" className="input font-mono text-sm py-1" style={{ flex: 1, minWidth: '60px' }} value={editLogForm.duration} onChange={e => setEditLogForm({...editLogForm, duration: e.target.value})} placeholder="Duration" />
                          <select className="select font-mono text-sm py-1" style={{ width: '120px', flexShrink: 0 }} value={editLogForm.duration_unit} onChange={e => setEditLogForm({...editLogForm, duration_unit: e.target.value})}>
                            <option value="hours">HOURS</option>
                            <option value="days">DAYS</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => saveEditLog(log.id)} className="btn btn-primary btn-sm">SAVE</button>
                          <button onClick={() => setEditingLogId(null)} className="btn btn-ghost btn-sm">CANCEL</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div 
                          onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                          className="cursor-pointer select-none"
                        >
                          <div className="flex-between mb-2">
                            <span className="font-mono text-xs text-amber font-semibold">{String(log.date || '')}</span>
                            <span className="badge">{String(log.type || 'OTHER').replace('_', ' ').toUpperCase()}</span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="font-display text-xl uppercase tracking-wider text-primary break-words flex-1">{log.title}</h3>
                            <button type="button" className="p-1 text-muted hover:text-primary transition-colors shrink-0">
                              {expandedLogId === log.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </div>

                          <div className="font-mono text-[10px] text-muted flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {log.duration_hours ? (log.duration_hours >= 24 && log.duration_hours % 24 === 0 ? `${log.duration_hours / 24} DAYS` : `${log.duration_hours} HOURS`) : 'NO DURATION LOGGED'}
                            </span>
                            {Array.isArray(log.media_urls) && log.media_urls.length > 0 && (
                              <span className="text-amber font-semibold">[{log.media_urls.length} PROOF ATTACHED]</span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Accordion */}
                        <AnimatePresence>
                          {expandedLogId === log.id && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="mt-4 pt-3 border-t border-border-color flex flex-col gap-3 font-mono text-xs">
                                {log.description && (
                                  <p className="text-secondary whitespace-pre-wrap leading-relaxed">{log.description}</p>
                                )}
                                
                                {Array.isArray(log.media_urls) && log.media_urls.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {log.media_urls.map((url, idx) => (
                                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-mono text-[10px] text-amber hover:text-primary transition-colors bg-bg-primary border border-amber/40 px-2 py-1 rounded">
                                        <ExternalLink size={10} /> PROOF {idx + 1}
                                      </a>
                                    ))}
                                  </div>
                                )}

                                <div className="flex justify-between items-center border-t border-border-color/60 pt-3 mt-2">
                                  <div className="flex gap-3">
                                    <button onClick={() => startEditLog(log)} className="font-mono text-[10px] text-muted hover:text-amber flex items-center gap-1">
                                      <Edit2 size={10} /> EDIT LOG
                                    </button>
                                    <button onClick={() => setEditingId(editingId === log.id ? null : log.id)} className="font-mono text-[10px] text-muted hover:text-primary flex items-center gap-1">
                                      <Plus size={10} /> ADD PROOF
                                    </button>
                                  </div>
                                  <button onClick={() => handleDeleteLog(log.id)} className="font-mono text-[10px] text-danger hover:text-danger/80 flex items-center gap-1">
                                    <Trash2 size={10} /> DELETE
                                  </button>
                                </div>

                                {editingId === log.id && (
                                  <div className="mt-2 flex gap-2">
                                    <input type="url" placeholder="https://..." className="input font-mono text-xs flex-1 py-1" value={newMediaUrl} onChange={e => setNewMediaUrl(e.target.value)} />
                                    <button onClick={() => handleAddMedia(log.id, log.media_urls)} className="btn btn-primary btn-sm flex items-center gap-1">
                                      <Save size={12} /> SAVE
                                    </button>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {logs.filter(l => !l.title?.startsWith('Weekly Debrief')).length === 0 && <div className="font-mono text-sm text-muted py-8">NO WORK LOGS ARCHIVED.</div>}
            </div>
          </div>
        )}

        {/* WEEKLY REVIEWS TAB */}
        {activeTab === 'reviews' && (
          <div className="flex-col gap-6">
            <div className="flex-col gap-0 border-l border-border-strong ml-4 pl-6 relative">
              {logs.filter(l => l.title?.startsWith('Weekly Debrief')).map((log, idx, arr) => (
                <div key={log.id} className="relative pb-8 group">
                  <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-border-color border border-border-strong group-hover:bg-amber transition-colors z-10" />
                  
                  <div className="bg-tertiary border border-border-color p-4 hover:border-amber transition-colors cursor-pointer" onClick={() => setExpandedReview(expandedReview === log.id ? null : log.id)}>
                    <div className="flex-between mb-2">
                      <span className="font-mono text-xs text-amber">{String(log.date || '')}</span>
                      <span className="badge badge-amber">WEEKLY DEBRIEF</span>
                    </div>
                    
                    <h3 className="font-display text-xl uppercase tracking-wider text-primary mb-0">WEEK {arr.length - idx}</h3>
                    
                    {expandedReview === log.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 border-t border-border-color pt-4">
                        <h4 className="font-display text-lg uppercase tracking-wider text-secondary mb-4">{log.title}</h4>
                        {log.description && (
                          <div className="prose prose-invert prose-sm max-w-none font-mono text-sm text-secondary">
                            {log.description.split('\n').map((line, i) => {
                              if (line.startsWith('### ')) {
                                return <h4 key={i} className="text-amber mt-4 mb-2 font-display tracking-widest uppercase">{line.replace('### ', '')}</h4>
                              }
                              return <div key={i} className="min-h-[1.5em]">{line}</div>
                            })}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </div>
              ))}
              {logs.filter(l => l.title?.startsWith('Weekly Debrief')).length === 0 && <div className="font-mono text-sm text-muted py-8">NO WEEKLY REVIEWS ARCHIVED YET.</div>}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BOOKS COMPLETED TAB */}
        {/* ========================================================================= */}
        {activeTab === 'books' && (
          <div className="space-y-6">
            {/* STATS HEADER */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <HudPanel className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] text-muted uppercase block">BOOKS READ</span>
                  <span className="font-display text-2xl text-amber font-bold">{books.length}</span>
                </div>
                <BookOpen size={24} className="text-amber opacity-60" />
              </HudPanel>

              <HudPanel className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] text-muted uppercase block">AVG RATING</span>
                  <span className="font-display text-2xl text-warning font-bold">{avgBookRating} ⭐</span>
                </div>
                <Star size={24} className="text-warning opacity-60" />
              </HudPanel>

              <HudPanel className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] text-muted uppercase block">XP REWARDS</span>
                  <span className="font-display text-2xl text-success font-bold">+{books.length * 10} XP</span>
                </div>
                <Sparkles size={24} className="text-success opacity-60" />
              </HudPanel>
            </div>

            {/* CONTROLS BAR: SEARCH, FILTER, ADD BOOK */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-tertiary border border-border-color rounded-xl">
              <div className="flex flex-1 items-center gap-2 bg-secondary border border-border-color rounded-lg px-3 py-1.5" style={{ background: '#121520' }}>
                <Search size={14} className="text-muted flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search books, authors, notes..."
                  value={bookSearch}
                  onChange={(e) => setBookSearch(e.target.value)}
                  className="w-full bg-transparent font-mono text-xs text-primary focus:outline-none placeholder:text-muted"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={bookCategoryFilter}
                  onChange={(e) => setBookCategoryFilter(e.target.value)}
                  className="bg-secondary border border-border-color rounded-lg px-3 py-1.5 font-mono text-xs text-primary focus:outline-none"
                  style={{ background: '#121520', color: '#fff' }}
                >
                  <option value="all">ALL GENRES</option>
                  <option value="Business">Business / Startup</option>
                  <option value="Philosophy">Philosophy / Mindset</option>
                  <option value="Technical">Technical / Skills</option>
                  <option value="Biography">Biography / History</option>
                  <option value="Fiction">Fiction</option>
                  <option value="Other">Other</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowAddBook(!showAddBook)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold uppercase rounded-lg shadow-md transition-all shrink-0 active:scale-95"
                >
                  <Plus size={16} />
                  <span>ADD BOOK</span>
                </button>
              </div>
            </div>

            {/* ADD BOOK FORM MODAL */}
            <AnimatePresence>
              {showAddBook && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <HudPanel label="LOG COMPLETED BOOK (+10 XP)" className="border-amber p-5 space-y-4">
                    <form onSubmit={handleCreateBook} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="font-mono text-xs text-amber uppercase font-bold block mb-1">Book Title *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Atomic Habits"
                            value={newBook.title}
                            onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                            className="w-full bg-secondary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                            style={{ background: '#141824', color: '#fff' }}
                          />
                        </div>

                        <div>
                          <label className="font-mono text-xs text-muted uppercase font-bold block mb-1">Author</label>
                          <input
                            type="text"
                            placeholder="e.g. James Clear"
                            value={newBook.author}
                            onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                            className="w-full bg-secondary border border-border-color rounded-lg p-2.5 font-mono text-sm text-primary focus:outline-none focus:border-amber"
                            style={{ background: '#141824', color: '#fff' }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="font-mono text-xs text-muted uppercase font-bold block mb-1">Genre / Category</label>
                          <select
                            value={newBook.category}
                            onChange={(e) => setNewBook({ ...newBook, category: e.target.value })}
                            className="w-full bg-secondary border border-border-color rounded-lg p-2.5 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                            style={{ background: '#141824', color: '#fff' }}
                          >
                            <option value="Business">Business / Startup</option>
                            <option value="Philosophy">Philosophy / Mindset</option>
                            <option value="Technical">Technical / Skills</option>
                            <option value="Biography">Biography / History</option>
                            <option value="Fiction">Fiction</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-mono text-xs text-muted uppercase font-bold block mb-1">Rating</label>
                          <select
                            value={newBook.rating}
                            onChange={(e) => setNewBook({ ...newBook, rating: parseInt(e.target.value) })}
                            className="w-full bg-secondary border border-border-color rounded-lg p-2.5 font-mono text-xs text-warning font-bold focus:outline-none focus:border-amber"
                            style={{ background: '#141824' }}
                          >
                            <option value={5}>⭐⭐⭐⭐⭐ (5/5 Exceptional)</option>
                            <option value={4}>⭐⭐⭐⭐ (4/5 Great)</option>
                            <option value={3}>⭐⭐⭐ (3/5 Good)</option>
                            <option value={2}>⭐⭐ (2/5 Average)</option>
                            <option value={1}>⭐ (1/5 Poor)</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-mono text-xs text-muted uppercase font-bold block mb-1">Completion Date</label>
                          <input
                            type="date"
                            value={newBook.date_completed}
                            onChange={(e) => setNewBook({ ...newBook, date_completed: e.target.value })}
                            className="w-full bg-secondary border border-border-color rounded-lg p-2 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                            style={{ background: '#141824', color: '#fff' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-mono text-xs text-muted uppercase font-bold block mb-1">Cover Image URL (Optional)</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          value={newBook.cover_url}
                          onChange={(e) => setNewBook({ ...newBook, cover_url: e.target.value })}
                          className="w-full bg-secondary border border-border-color rounded-lg p-2.5 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                          style={{ background: '#141824', color: '#fff' }}
                        />
                      </div>

                      <div>
                        <label className="font-mono text-xs text-muted uppercase font-bold block mb-1">Key Takeaways & Summary</label>
                        <textarea
                          rows={3}
                          placeholder="Main lessons, action items, or core concepts..."
                          value={newBook.takeaways}
                          onChange={(e) => setNewBook({ ...newBook, takeaways: e.target.value })}
                          className="w-full bg-secondary border border-border-color rounded-xl p-3 font-mono text-xs text-primary focus:outline-none focus:border-amber"
                          style={{ background: '#141824', color: '#fff' }}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddBook(false)}
                          className="px-4 py-2 bg-secondary border border-border-color rounded-xl font-mono text-xs text-muted hover:text-primary transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-amber hover:bg-amber-hover text-black font-mono text-xs font-bold uppercase rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
                        >
                          <Save size={15} />
                          <span>Save Book (+10 XP)</span>
                        </button>
                      </div>
                    </form>
                  </HudPanel>
                </motion.div>
              )}
            </AnimatePresence>

            {/* BOOKS GRID ARCHIVE */}
            {filteredBooks.length === 0 ? (
              <div className="font-mono text-sm text-muted text-center py-12 bg-tertiary border border-border-color rounded-xl">
                NO BOOKS FOUND IN ARCHIVE.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBooks.map((book, idx) => {
                  const isEditing = editingBookId === (book.id || book.title)
                  const isExpanded = expandedBookId === (book.id || book.title)

                  return (
                    <div
                      key={book.id || idx}
                      className="p-4 rounded-xl bg-tertiary border border-border-color hover:border-amber/60 transition-all flex flex-col justify-between space-y-3 group"
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editBookForm.title}
                            onChange={(e) => setEditBookForm({ ...editBookForm, title: e.target.value })}
                            className="w-full bg-secondary border border-border-color rounded p-2 font-mono text-xs text-primary"
                          />
                          <input
                            type="text"
                            value={editBookForm.author}
                            onChange={(e) => setEditBookForm({ ...editBookForm, author: e.target.value })}
                            className="w-full bg-secondary border border-border-color rounded p-2 font-mono text-xs text-primary"
                          />
                          <textarea
                            rows={3}
                            value={editBookForm.takeaways}
                            onChange={(e) => setEditBookForm({ ...editBookForm, takeaways: e.target.value })}
                            className="w-full bg-secondary border border-border-color rounded p-2 font-mono text-xs text-primary"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => saveEditBook(book.id)}
                              className="px-3 py-1 bg-amber text-black font-mono text-xs font-bold rounded"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingBookId(null)}
                              className="px-3 py-1 bg-secondary text-muted font-mono text-xs rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-3">
                            {/* Book Cover Preview or Stylized Book Spine */}
                            {book.cover_url ? (
                              <img
                                src={book.cover_url}
                                alt={book.title}
                                className="w-14 h-20 object-cover rounded-lg border border-border-color shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-20 rounded-lg bg-amber/10 border border-amber/30 flex flex-col items-center justify-center p-1 text-center shrink-0">
                                <Book size={20} className="text-amber mb-1" />
                                <span className="font-mono text-[8px] text-amber font-bold leading-tight truncate max-w-full">
                                  {book.category}
                                </span>
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[10px] text-amber font-bold uppercase">
                                  {book.category || 'Business'}
                                </span>
                                <span className="font-mono text-[10px] text-muted">
                                  {book.date_completed}
                                </span>
                              </div>

                              <h3 className="font-display text-base uppercase tracking-wider text-primary truncate mt-0.5">
                                {book.title}
                              </h3>
                              <p className="font-mono text-xs text-secondary italic truncate">
                                by {book.author || 'Unknown'}
                              </p>

                              {/* Star Rating Display */}
                              <div className="flex items-center gap-1 mt-1.5 text-warning font-mono text-xs font-bold">
                                {'★'.repeat(book.rating || 5)}{'☆'.repeat(5 - (book.rating || 5))}
                                <span className="text-muted text-[10px] ml-1">({book.rating || 5}/5)</span>
                              </div>
                            </div>
                          </div>

                          {/* Key Takeaways & Expand Accordion */}
                          {book.takeaways && (
                            <div className="pt-2 border-t border-border-subtle/50">
                              <div
                                onClick={() => setExpandedBookId(isExpanded ? null : (book.id || book.title))}
                                className="flex items-center justify-between cursor-pointer text-muted hover:text-primary transition-colors font-mono text-[10px] uppercase font-bold"
                              >
                                <span>Key Takeaways & Notes</span>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <p className="font-mono text-xs text-secondary whitespace-pre-wrap leading-relaxed mt-2 p-2.5 rounded bg-secondary/40 border border-border-subtle">
                                      {book.takeaways}
                                    </p>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Card Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-border-subtle/40">
                            <div className="flex items-center gap-2 font-mono text-[10px]">
                              <button
                                type="button"
                                onClick={() => startEditBook(book)}
                                className="text-muted hover:text-amber transition-colors flex items-center gap-1"
                              >
                                <Edit2 size={10} /> EDIT
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteBook(book.id, book.title)}
                              className="text-danger/70 hover:text-danger transition-colors font-mono text-[10px] flex items-center gap-1"
                            >
                              <Trash2 size={10} /> DELETE
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* PROJECTS TAB */}
        {activeTab === 'projects' && (
          <div className="flex-col gap-6">
            <div className="flex justify-end">
              <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={() => setShowAddProject(!showAddProject)}>
                <Plus size={16} /> ADD PROJECT
              </button>
            </div>

            <AnimatePresence>
              {showAddProject && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <HudPanel label="NEW PROJECT" className="border-info mb-6">
                    <form onSubmit={handleCreateProject} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">PROJECT TITLE</label>
                        <input type="text" className="input font-mono text-sm" value={newProj.title} onChange={e => setNewProj({...newProj, title: e.target.value})} required />
                      </div>
                      <div>
                        <label className="font-mono text-xs text-muted mb-1 block">STATUS</label>
                        <select className="select font-mono text-sm" value={newProj.status} onChange={e => setNewProj({...newProj, status: e.target.value})}>
                          <option value="idea">IDEA</option>
                          <option value="active">ACTIVE</option>
                          <option value="paused">PAUSED</option>
                          <option value="completed">COMPLETED</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-mono text-xs text-muted mb-1 block">DESCRIPTION</label>
                        <textarea className="textarea font-mono text-sm h-20" value={newProj.description} onChange={e => setNewProj({...newProj, description: e.target.value})} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="font-mono text-xs text-muted mb-1 block">TECH STACK / SKILLS (COMMA SEPARATED)</label>
                        <input type="text" className="input font-mono text-sm" value={newProj.tech_stack} onChange={e => setNewProj({...newProj, tech_stack: e.target.value})} placeholder="React, Node.js, Marketing..." />
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button type="submit" className="btn btn-primary w-full md:w-auto">SAVE PROJECT</button>
                      </div>
                    </form>
                  </HudPanel>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((proj) => (
                <div key={proj.id} className="bg-tertiary border border-border-color p-5 hover:border-info transition-colors flex-col h-full group">
                  <div className="flex-between mb-3">
                    <h3 className="font-display text-2xl uppercase tracking-wider text-primary group-hover:text-info transition-colors">{proj.title}</h3>
                    <span className={`badge ${proj.status === 'active' ? 'badge-amber' : proj.status === 'completed' ? 'badge-success' : ''}`}>
                      {String(proj.status || 'UNKNOWN').toUpperCase()}
                    </span>
                  </div>
                  <p className="font-mono text-sm text-secondary mb-4 flex-1">{proj.description}</p>
                  
                  {Array.isArray(proj.tech_stack) && proj.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-auto">
                      {proj.tech_stack.map((tech, idx) => (
                        <span key={idx} className="font-mono text-[10px] text-muted bg-bg-primary px-2 py-1 border border-border-strong">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {projects.length === 0 && <div className="font-mono text-sm text-muted col-span-2 py-8 text-center">NO PROJECTS ARCHIVED.</div>}
            </div>
          </div>
        )}

        {/* RESUME TAB (EXECUTIVE MASTER RESUME) */}
        {activeTab === 'resume' && (
          <div className="space-y-6">
            {/* Executive Action Bar (Hidden when printing PDF) */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-tertiary border border-border-color rounded-2xl print:hidden">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber" />
                <span className="font-display text-xs uppercase tracking-widest text-primary font-bold">
                  EXECUTIVE PORTFOLIO RESUME
                </span>
                <span className="font-mono text-[10px] text-muted hidden sm:inline">
                  • Real-time Live Sync
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAllResumeLogs(!showAllResumeLogs)}
                  className="px-3 py-1.5 rounded-lg border border-border-color bg-secondary hover:bg-hover text-secondary font-mono text-xs uppercase font-semibold transition-colors"
                >
                  {showAllResumeLogs ? 'Show Compact View' : `Show All (${logs.length} Weeks)`}
                </button>

                <button
                  type="button"
                  onClick={fetchData}
                  className="p-2 rounded-lg border border-border-color bg-secondary hover:bg-hover text-secondary transition-colors"
                  title="Refresh Intel Data"
                >
                  <RefreshCw size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary btn-sm flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold"
                >
                  <Printer size={14} /> EXPORT / PRINT PDF
                </button>
              </div>
            </div>

            {/* Resume Main Document Card */}
            <HudPanel className="bg-bg-primary border-amber/50 print:border-none p-6 sm:p-10 space-y-8 max-w-4xl mx-auto shadow-2xl">
              
              {/* Operator Identity Header */}
              <div className="text-center border-b border-border-color pb-8 space-y-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-amber font-bold">
                  SAGA OPERATOR DOSSIER
                </div>
                <h1 className="font-display text-4xl sm:text-5xl uppercase tracking-widest text-primary font-bold">
                  {profile?.full_name || 'CHIRAG SHETTY'}
                </h1>
                <p className="font-mono text-xs sm:text-sm text-amber uppercase tracking-widest font-semibold">
                  FOUNDER & OPERATOR • SYSTEM ARCHITECT
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2 font-mono text-xs text-muted">
                  <span className="px-3 py-1 rounded-full bg-secondary border border-border-color text-primary font-bold">
                    SAGA V: The King
                  </span>
                  <span>•</span>
                  <span className="text-cyan font-bold">LEVEL {profile?.level || 1}</span>
                  <span>•</span>
                  <span className="text-amber font-bold">{(profile?.total_xp || 0).toLocaleString()} XP</span>
                  <span>•</span>
                  <span className="text-success font-bold">{profile?.current_rank || 'E'} RANK</span>
                </div>
              </div>

              {/* KPI Metrics Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs text-center">
                <div className="p-3 rounded-xl bg-tertiary border border-border-subtle">
                  <span className="text-muted text-[9px] uppercase tracking-wider block font-bold mb-1">Discipline Level</span>
                  <span className="text-cyan font-display text-xl font-bold">LVL {profile?.level || 1}</span>
                </div>
                <div className="p-3 rounded-xl bg-tertiary border border-border-subtle">
                  <span className="text-muted text-[9px] uppercase tracking-wider block font-bold mb-1">Total XP Earned</span>
                  <span className="text-amber font-display text-xl font-bold">{(profile?.total_xp || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-xl bg-tertiary border border-border-subtle">
                  <span className="text-muted text-[9px] uppercase tracking-wider block font-bold mb-1">Literature Completed</span>
                  <span className="text-success font-display text-xl font-bold">{books.length} Books</span>
                </div>
                <div className="p-3 rounded-xl bg-tertiary border border-border-subtle">
                  <span className="text-muted text-[9px] uppercase tracking-wider block font-bold mb-1">Shipped Projects</span>
                  <span className="text-primary font-display text-xl font-bold">{projects.length} Systems</span>
                </div>
              </div>

              {/* Core Competencies & Skills */}
              <div className="space-y-3">
                <h2 className="font-display text-lg uppercase tracking-wider text-amber border-b border-border-color pb-2 flex items-center gap-2">
                  <Terminal size={18} /> CORE COMPETENCIES & DISCIPLINE PILLARS
                </h2>
                <div className="flex flex-wrap gap-2 font-mono text-xs">
                  {[
                    'Video Production & Post-Editing', 'Premiere Pro & AutoCut',
                    'System Architecture & Full-Stack JS', 'Next.js & Supabase Engine',
                    'Content Operations & Directing', 'High-Focus Deep Execution',
                    'Weekly Debriefing & Iteration', 'Productivity OS Architecture'
                  ].map((skill, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-lg bg-tertiary border border-border-color text-primary font-semibold">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Parsed Executive Accomplishments (Replaces raw markdown text wall!) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border-color pb-2">
                  <h2 className="font-display text-lg uppercase tracking-wider text-amber flex items-center gap-2">
                    <Briefcase size={18} /> OPERATIONAL MILESTONES & WEEKLY ACCOMPLISHMENTS
                  </h2>
                  <span className="font-mono text-[10px] text-muted">
                    {showAllResumeLogs ? `Showing All ${logs.length} Weeks` : `Recent Top ${Math.min(5, logs.length)} Weeks`}
                  </span>
                </div>

                <div className="space-y-4">
                  {(showAllResumeLogs ? logs : logs.slice(0, 5)).map(log => {
                    const highlights = parseResumeHighlights(log.description || log.notes || '')
                    
                    return (
                      <div key={log.id} className="p-4 rounded-xl bg-tertiary/70 border border-border-color space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/50 pb-2">
                          <h3 className="font-mono text-sm font-bold text-primary uppercase">
                            {log.title}
                          </h3>
                          {log.date && (
                            <span className="font-mono text-[10px] text-amber font-semibold px-2 py-0.5 rounded bg-amber/10 border border-amber/30">
                              {log.date}
                            </span>
                          )}
                        </div>

                        {highlights.length > 0 ? (
                          <ul className="space-y-1.5 font-mono text-xs text-secondary pl-1">
                            {highlights.map((point, pIdx) => (
                              <li key={pIdx} className="flex items-start gap-2 leading-relaxed">
                                <span className="text-success shrink-0 mt-0.5"><Check size={12} strokeWidth={3} /></span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="font-mono text-xs text-secondary leading-relaxed">
                            {log.description ? log.description.replace(/###/g, '').trim() : 'Executed operational directive with verified proof.'}
                          </p>
                        )}
                      </div>
                    )
                  })}

                  {logs.length === 0 && (
                    <p className="font-mono text-xs text-muted text-center py-6">No operational debriefs logged yet.</p>
                  )}
                </div>
              </div>

              {/* Literature & Knowledge Intake (Books Completed) */}
              {books.length > 0 && (
                <div className="space-y-3">
                  <h2 className="font-display text-lg uppercase tracking-wider text-amber border-b border-border-color pb-2 flex items-center gap-2">
                    <BookOpen size={18} /> LITERATURE & KNOWLEDGE INTAKE ({books.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                    {books.map((b, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-tertiary border border-border-color space-y-1">
                        <div className="text-primary font-bold uppercase">{b.title}</div>
                        <div className="text-muted text-[10px]">by {b.author || 'Unknown'} • <span className="text-cyan">{b.category}</span></div>
                        <div className="text-amber font-bold text-[11px] pt-1">
                          {'★'.repeat(b.rating || 5)} <span className="text-muted text-[10px] font-normal ml-1">({b.date_completed})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Systems & Projects */}
              <div className="space-y-3">
                <h2 className="font-display text-lg uppercase tracking-wider text-amber border-b border-border-color pb-2 flex items-center gap-2">
                  <Database size={18} /> SHIPPED PROJECTS & SYSTEM BUILD-OUTS
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map(proj => (
                    <div key={proj.id} className="p-4 rounded-xl border border-border-color bg-tertiary space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-mono text-sm text-primary font-bold uppercase">{proj.title}</h3>
                        <span className="font-mono text-[9px] text-success uppercase px-2 py-0.5 rounded bg-success/10 border border-success/30">
                          {proj.status || 'ACTIVE'}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-secondary leading-relaxed">{proj.description}</p>
                      {Array.isArray(proj.tech_stack) && proj.tech_stack.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {proj.tech_stack.map((t, i) => (
                            <span key={i} className="font-mono text-[9px] bg-bg-primary px-2 py-0.5 border border-border-strong text-muted rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {projects.length === 0 && <p className="font-mono text-xs text-muted">Awaiting project data.</p>}
                </div>
              </div>

              {/* Resume Footer */}
              <div className="border-t border-border-color pt-6 flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] text-muted">
                <div>AUTHENTICATED DOSSIER • GENERATED BY CHIRAG OS EXECUTIVE ENGINE</div>
                <div className="flex items-center gap-3">
                  <span>CONFIDENTIAL</span>
                  <span>•</span>
                  <span>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
              </div>

            </HudPanel>
          </div>
        )}

      </div>
    </AppShell>
  )
}
