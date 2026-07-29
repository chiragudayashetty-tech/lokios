'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Calculator, AlertCircle, CheckCircle2 } from 'lucide-react'
import useWork from '@/lib/hooks/useWork'

export default function VisualFormulaBuilder() {
  const { metrics, createFormula } = useWork()
  const [formulaName, setFormulaName] = useState('')
  const [tokens, setTokens] = useState([]) // { type: 'metric'|'operator'|'number'|'aggregate', value: string, id: string }
  const [numberInput, setNumberInput] = useState('')
  
  const operators = ['+', '-', '*', '/', '(', ')']
  const aggregates = ['AVG', 'SUM', 'MIN', 'MAX', 'COUNT']

  const addToken = (type, value) => {
    setTokens([...tokens, { type, value, id: Math.random().toString(36).substr(2, 9) }])
  }

  const removeToken = (id) => {
    setTokens(tokens.filter(t => t.id !== id))
  }

  const addNumber = () => {
    if (numberInput) {
      addToken('number', numberInput)
      setNumberInput('')
    }
  }

  const getExpressionText = () => {
    return tokens.map(t => {
      if (t.type === 'metric') {
        const metric = (metrics || []).find(m => m.key === t.value)
        return `[${metric?.name || t.value}]`
      }
      return t.value
    }).join(' ')
  }

  const handleSave = async () => {
    if (!formulaName || tokens.length === 0) return
    const expression = tokens.map(t => t.type === 'metric' ? `{${t.value}}` : t.value).join(' ')
    await createFormula({
      name: formulaName,
      expression: expression,
      description: 'Built with visual builder'
    })
    setFormulaName('')
    setTokens([])
  }

  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px',
      fontFamily: 'var(--font-body)',
      color: 'var(--text-primary)',
      maxWidth: '900px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Calculator size={24} color="var(--accent-secondary)" />
        <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Formula Builder
        </h2>
      </div>

      <input
        type="text"
        placeholder="Formula Name (e.g., Conversion Rate)"
        value={formulaName}
        onChange={e => setFormulaName(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px',
          color: 'var(--text-primary)',
          fontSize: '16px',
          marginBottom: '24px',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />

      {/* Builder Area */}
      <div style={{
        minHeight: '100px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '16px',
        marginBottom: '24px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignItems: 'center'
      }}>
        {tokens.length === 0 && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Build your expression using the tools below...</span>}
        
        <AnimatePresence>
          {tokens.map((token) => (
            <motion.div
              key={token.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: '500',
                fontFamily: 'var(--font-mono)',
                background: token.type === 'metric' ? 'rgba(168, 85, 247, 0.2)' :
                            token.type === 'operator' ? 'var(--bg-secondary)' :
                            token.type === 'aggregate' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                border: `1px solid ${
                            token.type === 'metric' ? 'var(--accent-secondary)' :
                            token.type === 'operator' ? 'var(--border-color)' :
                            token.type === 'aggregate' ? 'var(--success)' : 'var(--info)'}`,
                color: 'var(--text-primary)'
              }}
            >
              {token.type === 'metric' ? (metrics || []).find(m => m.key === token.value)?.name || token.value : token.value}
              <button onClick={() => removeToken(token.id)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Metrics Palette */}
        <div>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>Variables (Metrics)</div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
            {(metrics || []).filter(m => !m.is_archived).map(metric => (
              <button
                key={metric.id}
                onClick={() => addToken('metric', metric.key)}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: '0.2s',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-secondary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <span>{metric.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{metric.metric_type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tools Palette */}
        <div>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>Operators</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {operators.map(op => (
              <button
                key={op}
                onClick={() => addToken('operator', op)}
                style={{ width: '40px', height: '40px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '18px', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
              >
                {op}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>Functions</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {aggregates.map(agg => (
              <button
                key={agg}
                onClick={() => addToken('aggregate', agg)}
                style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', color: 'var(--success)', fontSize: '13px', fontFamily: 'var(--font-mono)', cursor: 'pointer' }}
              >
                {agg}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'var(--font-display)' }}>Constant Number</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              value={numberInput}
              onChange={e => setNumberInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addNumber()}
              style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-primary)' }}
              placeholder="e.g. 100"
            />
            <button onClick={addNumber} style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--info)', color: 'var(--info)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              Add
            </button>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: tokens.length > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
          {tokens.length > 0 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
            Preview: {getExpressionText() || 'Empty expression'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setTokens([])} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
            Clear
          </button>
          <button onClick={handleSave} disabled={!formulaName || tokens.length === 0} style={{ padding: '8px 24px', background: 'var(--accent-secondary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: (!formulaName || tokens.length === 0) ? 'not-allowed' : 'pointer', opacity: (!formulaName || tokens.length === 0) ? 0.5 : 1, fontWeight: '600' }}>
            Save Formula
          </button>
        </div>
      </div>
    </div>
  )
}
