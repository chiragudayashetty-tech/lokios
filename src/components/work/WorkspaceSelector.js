'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus, Building2, Check, Users } from 'lucide-react'
import useWork from '@/lib/hooks/useWork'

export default function WorkspaceSelector() {
  const { currentWorkspace, workspaces, switchWorkspace, createWorkspace } = useWork()
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')

  const handleCreate = async () => {
    if (!newWorkspaceName.trim()) return
    await createWorkspace({ name: newWorkspaceName, icon: '🏢' })
    setNewWorkspaceName('')
    setIsCreating(false)
  }

  return (
    <div style={{ position: 'relative', fontFamily: 'var(--font-body)' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          width: '280px',
          transition: 'var(--transition-base)',
          boxShadow: 'var(--shadow-md)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px'
        }}>
          {currentWorkspace?.icon || <Building2 size={18} color="var(--text-secondary)" />}
        </div>
        
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontWeight: '600',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            fontSize: '14px'
          }}>
            {currentWorkspace?.name || 'Select Workspace'}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--text-muted)',
            fontSize: '11px',
            marginTop: '2px'
          }}>
            <Users size={10} />
            <span>{currentWorkspace?.members_count || 1} Members</span>
          </div>
        </div>
        
        <ChevronDown size={16} style={{ color: 'var(--text-secondary)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: '100%',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(32px)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '8px',
              zIndex: 'var(--z-modal)',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            {workspaces.map(workspace => (
              <button
                key={workspace.id}
                onClick={() => {
                  switchWorkspace(workspace)
                  setIsOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: currentWorkspace?.id === workspace.id ? 'var(--bg-active)' : 'transparent',
                  border: currentWorkspace?.id === workspace.id ? '1px solid var(--accent-secondary)' : '1px solid transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'var(--transition-base)'
                }}
                onMouseEnter={(e) => {
                  if (currentWorkspace?.id !== workspace.id) {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentWorkspace?.id !== workspace.id) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <div style={{ fontSize: '16px' }}>{workspace.icon || '🏢'}</div>
                <div style={{ flex: 1, fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '13px', letterSpacing: '0.5px' }}>
                  {workspace.name}
                </div>
                {currentWorkspace?.id === workspace.id && <Check size={14} color="var(--accent-secondary)" />}
                <div style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)'
                }}>
                  {workspace.role || 'Owner'}
                </div>
              </button>
            ))}

            <div style={{ height: '1px', background: 'var(--border-color)', margin: '8px 0' }} />

            {isCreating ? (
              <div style={{ padding: '8px' }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Workspace Name..."
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    outline: 'none',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleCreate}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: 'var(--accent-secondary)',
                      color: 'var(--accent-primary)',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setIsCreating(false)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  border: '1px dashed var(--glass-border)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'var(--transition-base)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)'
                  e.currentTarget.style.borderColor = 'var(--text-secondary)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)'
                  e.currentTarget.style.borderColor = 'var(--glass-border)'
                }}
              >
                <Plus size={16} />
                <span style={{ fontSize: '13px' }}>New Workspace</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
