'use client';

import React from 'react';
import { motion } from 'framer-motion';

const EVENT_COLORS = {
  created: 'var(--info)',
  started: 'var(--success)',
  paused: 'var(--warning)',
  resumed: 'var(--accent-secondary)',
  completed: 'var(--success)',
  cancelled: 'var(--danger)'
};

export default function SessionTimelineViewer({ session, compact = false }) {
  if (!session || !session.timeline || !Array.isArray(session.timeline)) {
    return <div style={{ color: 'var(--text-muted)' }}>No timeline data available.</div>;
  }

  const timeline = session.timeline;
  
  // Calculate stats
  let totalDuration = (session.actual_duration_minutes || 0) * 60;
  let activeTime = 0;
  let pausesCount = 0;
  
  const blocks = [];
  let lastResume = null;
  
  timeline.forEach((event) => {
    if (event.event === 'started' || event.event === 'resumed') {
      lastResume = new Date(event.timestamp);
    } else if (event.event === 'paused' || event.event === 'completed') {
      if (lastResume) {
        const blockDuration = (new Date(event.timestamp) - lastResume) / 1000;
        blocks.push(blockDuration);
        activeTime += blockDuration;
        lastResume = null;
      }
      if (event.event === 'paused') pausesCount++;
    }
  });

  const longestBlock = blocks.length > 0 ? Math.max(...blocks) : 0;
  const avgBlock = blocks.length > 0 ? activeTime / blocks.length : 0;

  const formatMin = (secs) => `${Math.round(secs / 60)}m`;

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
         <div style={{ display: 'flex', height: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', overflow: 'hidden' }}>
           {blocks.map((b, i) => (
             <React.Fragment key={i}>
                <div style={{ width: `${(b/totalDuration)*100}%`, background: 'var(--success)' }} title={formatMin(b)} />
                {i < blocks.length - 1 && <div style={{ width: '2px', background: 'var(--warning)' }} />}
             </React.Fragment>
           ))}
         </div>
         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
           <span>{formatMin(activeTime)} Active</span>
           <span>{pausesCount} Pauses</span>
         </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
      <h3 style={{ margin: '0 0 24px 0', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', textTransform: 'uppercase' }}>Session Timeline</h3>
      
      <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {timeline.map((event, index) => {
          const date = new Date(event.timestamp);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const color = EVENT_COLORS[event.event] || 'var(--text-secondary)';
          
          return (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{ position: 'relative' }}
            >
              <div style={{ 
                position: 'absolute', left: '-31px', top: '4px', width: '12px', height: '12px', 
                borderRadius: '50%', background: color, border: '2px solid var(--bg-primary)'
              }} />
              
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{timeStr}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'bold', color: color, textTransform: 'uppercase' }}>{event.event}</span>
              </div>
              
              {event.metadata?.note && (
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>"{event.metadata.note}"</p>
              )}
            </motion.div>
          );
        })}
      </div>

      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>TOTAL DURATION</span>
          <span style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{formatMin(totalDuration)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ACTIVE WORK</span>
          <span style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{formatMin(activeTime)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>INTERRUPTIONS</span>
          <span style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>{pausesCount}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>LONGEST BLOCK</span>
          <span style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>{formatMin(longestBlock)}</span>
        </div>
      </div>
    </div>
  );
}
