'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useWork from '@/lib/hooks/useWork'
import { Plus, X, GripHorizontal, LayoutGrid, BarChart2, Activity, PieChart, Clock, Target, Calendar } from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'

const WIDGET_TYPES = {
  output_trends: { icon: <Activity size={18} />, label: 'Output Trends' },
  deep_work_hours: { icon: <BarChart2 size={18} />, label: 'Deep Work Hours' },
  target_meters: { icon: <Target size={18} />, label: 'Active Targets' },
  session_heatmap: { icon: <Calendar size={18} />, label: 'Session Heatmap' },
  category_breakdown: { icon: <PieChart size={18} />, label: 'Category Time' },
  project_progress: { icon: <LayoutGrid size={18} />, label: 'Project Progress' }
}

const COLORS = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']

export default function DashboardBuilder() {
  const { dashboards, createDashboard, updateDashboard, deleteDashboard } = useWork()
  const [activeDashboard, setActiveDashboard] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '', is_default: false })

  useEffect(() => {
    if (dashboards && dashboards.length > 0 && !activeDashboard) {
      setActiveDashboard(dashboards[0])
    }
  }, [dashboards, activeDashboard])

  const handleCreateDashboard = async (e) => {
    e.preventDefault()
    const newDash = await createDashboard({
      ...formData,
      layout_config: { widgets: [] }
    })
    if (newDash) setActiveDashboard(newDash)
    setIsFormOpen(false)
    setFormData({ name: '', description: '', is_default: false })
  }

  const addWidget = async (type) => {
    if (!activeDashboard) return
    const newWidget = { id: `w_${Date.now()}`, type, w: 1, h: 1 }
    const updatedConfig = { ...activeDashboard.layout_config, widgets: [...(activeDashboard.layout_config?.widgets || []), newWidget] }
    const updated = await updateDashboard(activeDashboard.id, { layout_config: updatedConfig })
    if (updated) setActiveDashboard(updated)
    setShowPalette(false)
  }

  const removeWidget = async (id) => {
    if (!activeDashboard) return
    const updatedConfig = { 
      ...activeDashboard.layout_config, 
      widgets: activeDashboard.layout_config.widgets.filter(w => w.id !== id) 
    }
    const updated = await updateDashboard(activeDashboard.id, { layout_config: updatedConfig })
    if (updated) setActiveDashboard(updated)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', flex: 1 }}>
          {dashboards?.map(d => (
            <button
              key={d.id}
              onClick={() => setActiveDashboard(d)}
              style={{
                background: activeDashboard?.id === d.id ? 'var(--bg-active)' : 'var(--bg-secondary)',
                border: `1px solid ${activeDashboard?.id === d.id ? 'var(--accent-secondary)' : 'var(--border-color)'}`,
                color: activeDashboard?.id === d.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-display)', textTransform: 'uppercase', transition: 'var(--transition-base)'
              }}
            >
              {d.name}
            </button>
          ))}
          <button
            onClick={() => setIsFormOpen(true)}
            style={{
              background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-muted)',
              padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <Plus size={16} /> New Dashboard
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeDashboard && (
            <>
              <button 
                onClick={() => setEditMode(!editMode)}
                style={{
                  background: editMode ? 'var(--accent-secondary)' : 'var(--bg-secondary)',
                  color: 'var(--accent-primary)', border: '1px solid var(--border-color)',
                  padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer'
                }}
              >
                {editMode ? 'Save Layout' : 'Edit Layout'}
              </button>
              {editMode && (
                <button 
                  onClick={() => setShowPalette(true)}
                  style={{
                    background: 'var(--bg-active)', color: 'var(--accent-primary)', border: '1px solid var(--border-color)',
                    padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Plus size={16} /> Add Widget
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isFormOpen && (
        <form onSubmit={handleCreateDashboard} style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input required type="text" placeholder="Dashboard Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }} />
          <input type="text" placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: 'var(--radius-sm)', flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}><input type="checkbox" checked={formData.is_default} onChange={e => setFormData({...formData, is_default: e.target.checked})} /> Default</label>
          <button type="submit" style={{ background: 'var(--accent-secondary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Create</button>
          <button type="button" onClick={() => setIsFormOpen(false)} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={20}/></button>
        </form>
      )}

      {/* Grid Area */}
      <div style={{ flex: 1, minHeight: '400px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', alignContent: 'start' }}>
        <AnimatePresence>
          {activeDashboard?.layout_config?.widgets?.map(widget => (
            <motion.div
              key={widget.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)',
                height: '280px', display: 'flex', flexDirection: 'column', position: 'relative',
                boxShadow: 'var(--shadow-md)', overflow: 'hidden'
              }}
            >
              {/* Widget Header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  {WIDGET_TYPES[widget.type]?.icon}
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{WIDGET_TYPES[widget.type]?.label || widget.type}</span>
                </div>
                {editMode && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <GripHorizontal size={16} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                    <X size={16} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={() => removeWidget(widget.id)} />
                  </div>
                )}
              </div>
              {/* Widget Content */}
              <div style={{ flex: 1, padding: '16px', position: 'relative' }}>
                <WidgetRenderer type={widget.type} />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {(!activeDashboard?.layout_config?.widgets || activeDashboard.layout_config.widgets.length === 0) && !editMode && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <p>This dashboard is empty.</p>
            <button onClick={() => setEditMode(true)} style={{ marginTop: '10px', background: 'transparent', border: '1px solid var(--accent-secondary)', color: 'var(--accent-secondary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Edit Layout to Add Widgets</button>
          </div>
        )}
      </div>

      {/* Widget Palette Overlay */}
      <AnimatePresence>
        {showPalette && (
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, width: '320px',
              background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)',
              zIndex: 'var(--z-modal)', padding: '20px', display: 'flex', flexDirection: 'column',
              boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Add Widget</h3>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setShowPalette(false)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
              {Object.entries(WIDGET_TYPES).map(([type, info]) => (
                <div 
                  key={type} 
                  onClick={() => addWidget(type)}
                  style={{
                    padding: '16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                    transition: 'var(--transition-base)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div style={{ color: 'var(--accent-secondary)' }}>{info.icon}</div>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{info.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function WidgetRenderer({ type }) {
  // Mock data for display
  if (type === 'output_trends') {
    const data = [{ name: 'Mon', val: 4 }, { name: 'Tue', val: 3 }, { name: 'Wed', val: 5 }, { name: 'Thu', val: 2 }, { name: 'Fri', val: 6 }]
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} />
          <Line type="monotone" dataKey="val" stroke="var(--accent-secondary)" strokeWidth={3} dot={{ fill: 'var(--bg-primary)', r: 4, strokeWidth: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
  
  if (type === 'category_breakdown') {
    const data = [{ name: 'Dev', value: 400 }, { name: 'Design', value: 300 }, { name: 'Planning', value: 300 }]
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie data={data} innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'white' }} />
        </RechartsPieChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'deep_work_hours') {
    const data = [{ day: 'M', hrs: 2 }, { day: 'T', hrs: 4.5 }, { day: 'W', hrs: 3 }, { day: 'T', hrs: 5 }, { day: 'F', hrs: 2.5 }]
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
          <Bar dataKey="hrs" fill="var(--info)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
      Mock data for {type}
    </div>
  )
}
