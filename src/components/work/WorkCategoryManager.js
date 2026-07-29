'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, GripVertical, Settings, ChevronDown, Edit2, Archive, Hash, Clock, Percent, DollarSign, Target, Activity } from 'lucide-react'
import useWork from '@/lib/hooks/useWork'

export default function WorkCategoryManager() {
  const { categories, metrics, createCategory, updateCategory, createMetric, updateMetric } = useWork()
  const [expandedCat, setExpandedCat] = useState(null)
  const [isAddingCat, setIsAddingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('📁')
  const [newCatColor, setNewCatColor] = useState('#3B82F6')

  const [isAddingMetric, setIsAddingMetric] = useState(null) // categoryId
  const [newMetric, setNewMetric] = useState({ name: '', metric_type: 'Number', metric_group: 'Output', unit: '' })

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4']

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    await createCategory({
      name: newCatName,
      icon: newCatIcon,
      color: newCatColor,
      display_order: categories.length
    })
    setNewCatName('')
    setIsAddingCat(false)
  }

  const handleAddMetric = async (categoryId) => {
    if (!newMetric.name.trim()) return
    await createMetric({
      category_id: categoryId,
      name: newMetric.name,
      key: newMetric.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      metric_type: newMetric.metric_type,
      metric_group: newMetric.metric_group,
      unit: newMetric.unit,
      is_required: false
    })
    setNewMetric({ name: '', metric_type: 'Number', metric_group: 'Output', unit: '' })
    setIsAddingMetric(null)
  }

  const groupColors = {
    'Input': '#3B82F6',
    'Output': '#10B981',
    'Outcome': '#F59E0B',
    'Quality': '#8B5CF6'
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Number': return <Hash size={14} />
      case 'Currency': return <DollarSign size={14} />
      case 'Percentage': return <Percent size={14} />
      case 'Duration':
      case 'Time': return <Clock size={14} />
      case 'Distance': return <Activity size={14} />
      default: return <Target size={14} />
    }
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--text-primary)', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '2px', margin: 0, fontSize: '24px' }}>
          Categories & Metrics
        </h2>
        <button
          onClick={() => setIsAddingCat(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'var(--accent-secondary)',
            color: 'var(--accent-primary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            fontFamily: 'var(--font-body)'
          }}
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      <AnimatePresence>
        {isAddingCat && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', marginBottom: '16px' }}
          >
            <div style={{
              padding: '16px',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                style={{ width: '40px', textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-primary)' }}
                maxLength={2}
              />
              <input
                type="text"
                placeholder="Category Name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewCatColor(color)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: color,
                      border: newCatColor === color ? '2px solid white' : 'none',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
              <button onClick={handleAddCategory} style={{ padding: '8px 16px', background: 'var(--accent-secondary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setIsAddingCat(false)} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <AnimatePresence>
          {categories.filter(c => !c.is_archived).map(category => {
            const catMetrics = metrics.filter(m => m.category_id === category.id && !m.is_archived)
            const isExpanded = expandedCat === category.id

            return (
              <motion.div
                key={category.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => setExpandedCat(isExpanded ? null : category.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: category.color || 'var(--accent-secondary)' }} />
                  
                  <GripVertical size={16} color="var(--text-muted)" style={{ marginRight: '12px', cursor: 'grab' }} />
                  
                  <div style={{ fontSize: '20px', marginRight: '12px' }}>{category.icon}</div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontSize: '16px', letterSpacing: '1px', fontWeight: '600' }}>
                      {category.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {catMetrics.length} metrics configured
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); updateCategory(category.id, { is_archived: true }) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                      <Archive size={14} />
                    </button>
                    <ChevronDown size={18} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '8px', color: 'var(--text-secondary)' }} />
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}
                    >
                      <div style={{ padding: '16px' }}>
                        {['Input', 'Output', 'Outcome', 'Quality'].map(group => {
                          const groupMetrics = catMetrics.filter(m => m.metric_group === group)
                          if (groupMetrics.length === 0 && (!isAddingMetric || newMetric.metric_group !== group || isAddingMetric !== category.id)) return null

                          return (
                            <div key={group} style={{ marginBottom: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: groupColors[group] }} />
                                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
                                  {group} Metrics
                                </span>
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px' }}>
                                {groupMetrics.map(metric => (
                                  <div key={metric.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ color: 'var(--text-muted)', marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                                      {getTypeIcon(metric.metric_type)}
                                    </div>
                                    <div style={{ flex: 1, fontSize: '14px' }}>{metric.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 6px', background: 'var(--bg-secondary)', borderRadius: '4px', marginRight: '12px' }}>
                                      {metric.metric_type}
                                    </div>
                                    {metric.unit && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '12px' }}>Unit: {metric.unit}</div>}
                                    <button onClick={() => updateMetric(metric.id, { is_archived: true })} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}>
                                      <Archive size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}

                        {isAddingMetric === category.id ? (
                          <div style={{ padding: '12px', background: 'var(--bg-tertiary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)', marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input type="text" placeholder="Metric Name" value={newMetric.name} onChange={e => setNewMetric({...newMetric, name: e.target.value})} style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', color: 'white', fontSize: '13px' }} />
                            <select value={newMetric.metric_type} onChange={e => setNewMetric({...newMetric, metric_type: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', color: 'white', fontSize: '13px' }}>
                              {['Number', 'Decimal', 'Currency', 'Percentage', 'Duration', 'Time', 'Rating', 'Boolean'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <select value={newMetric.metric_group} onChange={e => setNewMetric({...newMetric, metric_group: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px', color: 'white', fontSize: '13px' }}>
                              {['Input', 'Output', 'Outcome', 'Quality'].map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <button onClick={() => handleAddMetric(category.id)} style={{ padding: '6px 12px', background: 'var(--accent-secondary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Save</button>
                            <button onClick={() => setIsAddingMetric(null)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsAddingMetric(category.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              background: 'transparent',
                              color: 'var(--text-secondary)',
                              border: '1px dashed var(--glass-border)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              fontSize: '13px',
                              marginTop: '16px',
                              width: '100%',
                              justifyContent: 'center'
                            }}
                          >
                            <Plus size={14} /> Add Metric
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
