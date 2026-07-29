'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useWork from '@/lib/hooks/useWork'
import { FileText, Image as ImageIcon, Film, Link as LinkIcon, File, X, UploadCloud, Plus } from 'lucide-react'

export default function AttachmentManager({ attachableType, attachableId }) {
  const { getAttachments, createAttachment, deleteAttachment, currentWorkspace } = useWork()
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  useEffect(() => {
    if (attachableType && attachableId) {
      loadAttachments()
    }
  }, [attachableType, attachableId])

  const loadAttachments = async () => {
    setLoading(true)
    try {
      const data = await getAttachments(attachableType, attachableId)
      setAttachments(data || [])
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    // In real implementation: upload files to Supabase Storage
    // Here we just simulate with a file name
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      addMockAttachment(file.name, file.type, file.size)
    }
  }

  const handleAddLink = async (e) => {
    e.preventDefault()
    if (!linkUrl) return
    await createAttachment({
      workspace_id: currentWorkspace?.id,
      attachable_type: attachableType,
      attachable_id: attachableId,
      file_name: linkUrl,
      file_url: linkUrl,
      file_type: 'link',
      file_size: 0
    })
    setLinkUrl('')
    setLinkMode(false)
    loadAttachments()
  }

  const addMockAttachment = async (name, type, size) => {
    let simplifiedType = 'other'
    if (type.includes('image')) simplifiedType = 'image'
    else if (type.includes('video')) simplifiedType = 'video'
    else if (type.includes('pdf')) simplifiedType = 'pdf'
    
    await createAttachment({
      workspace_id: currentWorkspace?.id,
      attachable_type: attachableType,
      attachable_id: attachableId,
      file_name: name,
      file_url: '#', // mock URL
      file_type: simplifiedType,
      file_size: size
    })
    loadAttachments()
  }

  const getIcon = (type) => {
    switch(type) {
      case 'pdf': return <FileText size={20} color="#EF4444" />
      case 'image': return <ImageIcon size={20} color="#3B82F6" />
      case 'video': return <Film size={20} color="#A855F7" />
      case 'link': return <LinkIcon size={20} color="#10B981" />
      default: return <File size={20} color="#9CA3AF" />
    }
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '1rem' }}>Attachments</h3>
        <button onClick={() => setLinkMode(!linkMode)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <LinkIcon size={12} /> Add Link
        </button>
      </div>

      {linkMode && (
        <form onSubmit={handleAddLink} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input required type="url" placeholder="https://..." value={linkUrl} onChange={e => setLinkUrl(e.target.value)} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }} />
          <button type="submit" style={{ background: 'var(--bg-active)', color: 'var(--accent-primary)', border: '1px solid var(--accent-secondary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Add</button>
        </form>
      )}

      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragOver ? 'var(--accent-secondary)' : 'var(--border-color)'}`,
          background: isDragOver ? 'rgba(168,85,247,0.05)' : 'transparent',
          borderRadius: 'var(--radius-sm)', padding: '24px', textAlign: 'center',
          marginBottom: '16px', transition: 'var(--transition-base)', cursor: 'pointer'
        }}
        onClick={() => {
          // Trigger hidden file input in real implementation
        }}
      >
        <UploadCloud size={32} color={isDragOver ? 'var(--accent-secondary)' : 'var(--text-muted)'} style={{ margin: '0 auto 12px' }} />
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Drag & drop files here, or <span style={{ color: 'var(--accent-secondary)' }}>browse</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <AnimatePresence>
          {attachments.map(att => (
            <motion.div
              key={att.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)', transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                {getIcon(att.file_type)}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <a href={att.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                    {att.file_name}
                  </a>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {formatSize(att.file_size)} • {new Date(att.created_at || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => { if(confirm('Delete attachment?')) { deleteAttachment(att.id).then(loadAttachments) } }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {attachments.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px' }}>
            No attachments yet. Drop files or paste links.
          </div>
        )}
      </div>
    </div>
  )
}
