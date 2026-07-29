'use client'

import React from 'react'
import { Star } from 'lucide-react'

export default function DynamicMetricForm({ metrics, values = {}, onChange, compact = false }) {
  const groups = ['Input', 'Output', 'Outcome', 'Quality']
  
  const handleInputChange = (metricKey, value) => {
    if (onChange) onChange(metricKey, value)
  }

  const renderInput = (metric) => {
    const value = values[metric.key] || ''
    
    const inputStyle = {
      width: '100%',
      background: 'var(--bg-input)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 12px',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box'
    }

    switch (metric.metric_type) {
      case 'Number':
      case 'Decimal':
        return (
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              step={metric.metric_type === 'Decimal' ? '0.01' : '1'}
              value={value}
              onChange={(e) => handleInputChange(metric.key, parseFloat(e.target.value))}
              style={inputStyle}
              placeholder="0"
            />
            {metric.unit && <span style={{ position: 'absolute', right: '12px', top: '9px', color: 'var(--text-muted)', fontSize: '12px' }}>{metric.unit}</span>}
          </div>
        )
      
      case 'Currency':
        return (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '8px', color: 'var(--text-muted)' }}>$</span>
            <input
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => handleInputChange(metric.key, parseFloat(e.target.value))}
              style={{ ...inputStyle, paddingLeft: '28px' }}
              placeholder="0.00"
            />
          </div>
        )
        
      case 'Percentage':
        return (
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              min="0"
              max="100"
              value={value}
              onChange={(e) => handleInputChange(metric.key, parseFloat(e.target.value))}
              style={inputStyle}
              placeholder="0"
            />
            <span style={{ position: 'absolute', right: '12px', top: '8px', color: 'var(--text-muted)' }}>%</span>
          </div>
        )
        
      case 'Duration':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(metric.key, e.target.value)}
            style={inputStyle}
            placeholder="e.g. 2h 30m"
          />
        )
        
      case 'Time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleInputChange(metric.key, e.target.value)}
            style={inputStyle}
          />
        )
        
      case 'Date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(metric.key, e.target.value)}
            style={inputStyle}
          />
        )
        
      case 'Rating':
        return (
          <div style={{ display: 'flex', gap: '4px', padding: '8px 0' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={24}
                onClick={() => handleInputChange(metric.key, star)}
                style={{
                  cursor: 'pointer',
                  color: (value && value >= star) ? 'var(--warning)' : 'var(--text-muted)',
                  fill: (value && value >= star) ? 'var(--warning)' : 'none',
                  transition: '0.2s'
                }}
              />
            ))}
          </div>
        )
        
      case 'Boolean':
        return (
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '8px 0' }}>
            <div style={{
              width: '40px',
              height: '20px',
              background: value ? 'var(--success)' : 'var(--bg-tertiary)',
              borderRadius: '10px',
              position: 'relative',
              transition: '0.3s'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                background: 'white',
                borderRadius: '50%',
                position: 'absolute',
                top: '2px',
                left: value ? '22px' : '2px',
                transition: '0.3s'
              }} />
            </div>
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => handleInputChange(metric.key, e.target.checked)}
              style={{ display: 'none' }}
            />
          </label>
        )
        
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(metric.key, e.target.value)}
            style={inputStyle}
          />
        )
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-body)' }}>
      {groups.map(group => {
        const groupMetrics = metrics.filter(m => m.metric_group === group && !m.is_archived)
        if (groupMetrics.length === 0) return null

        return (
          <div key={group}>
            {!compact && (
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '4px'
              }}>
                {group}
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
              {groupMetrics.map(metric => (
                <div key={metric.id || metric.key}>
                  <label style={{
                    display: 'block',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    marginBottom: '6px',
                    fontWeight: '500'
                  }}>
                    {metric.name}
                    {metric.is_required && <span style={{ color: 'var(--accent-secondary)', marginLeft: '4px' }}>*</span>}
                  </label>
                  {renderInput(metric)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
