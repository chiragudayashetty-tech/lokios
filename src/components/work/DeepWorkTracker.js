'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWork } from '@/lib/hooks/useWork';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Flame, Brain, Coffee, Target, Calendar } from 'lucide-react';

export default function DeepWorkTracker() {
  const { deepWorkLogs, logDeepWork, currentWorkspace } = useWork();
  
  const [formData, setFormData] = useState({
    deep_minutes: 0,
    shallow_minutes: 0,
    session_count: 0,
    longest_block_minutes: 0,
    notes: ''
  });

  const today = new Date().toISOString().split('T')[0];

  const handleLog = async () => {
    if (!currentWorkspace) return;
    await logDeepWork({
      workspace_id: currentWorkspace.id,
      date: today,
      ...formData
    });
    // show success toast normally
  };

  // Mock data derivation for charts
  const chartData = useMemo(() => {
    if (!deepWorkLogs) return [];
    return [...deepWorkLogs].sort((a,b) => new Date(a.date) - new Date(b.date)).slice(-30).map(log => ({
      date: new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      hours: log.deep_minutes / 60
    }));
  }, [deepWorkLogs]);

  // Weekly Stats calculation
  const weeklyStats = useMemo(() => {
    // simplified mock logic
    return {
      totalHours: 24.5,
      avgDaily: 3.5,
      ratio: "2.5:1",
      longest: 120
    };
  }, [deepWorkLogs]);

  // Heatmap generation (simplified 4 weeks)
  const heatmapWeeks = Array.from({ length: 4 }, () => 
    Array.from({ length: 7 }, () => Math.floor(Math.random() * 6))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Row: Logger & Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '24px' }}>
        
        {/* Logger */}
        <div style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Brain size={20} color="var(--accent-secondary)" /> DAILY LOG: {today}
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>DEEP WORK (MINS)</label>
              <input type="number" min="0" value={formData.deep_minutes} onChange={e => setFormData({...formData, deep_minutes: parseInt(e.target.value)||0})} style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--accent-secondary)', fontFamily: 'var(--font-mono)', fontSize: '1.2rem', textAlign: 'center' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SHALLOW WORK</label>
              <input type="number" min="0" value={formData.shallow_minutes} onChange={e => setFormData({...formData, shallow_minutes: parseInt(e.target.value)||0})} style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '1.2rem', textAlign: 'center' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SESSION COUNT</label>
              <input type="number" min="0" value={formData.session_count} onChange={e => setFormData({...formData, session_count: parseInt(e.target.value)||0})} style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>LONGEST BLOCK (MINS)</label>
              <input type="number" min="0" value={formData.longest_block_minutes} onChange={e => setFormData({...formData, longest_block_minutes: parseInt(e.target.value)||0})} style={{ padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--info)', fontFamily: 'var(--font-mono)' }} />
            </div>
          </div>
          
          <textarea placeholder="Notes for today..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} style={{ padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', minHeight: '60px' }} />
          
          <button onClick={handleLog} style={{ padding: '12px', background: 'var(--accent-gradient)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontFamily: 'var(--font-display)', textTransform: 'uppercase', fontWeight: 'bold', cursor: 'pointer' }}>
            Log Today
          </button>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', gap: '16px' }}>
          {[
            { label: 'Weekly Deep Hours', value: weeklyStats.totalHours, icon: <Brain size={24} color="var(--accent-secondary)" /> },
            { label: 'Daily Average', value: weeklyStats.avgDaily, icon: <Calendar size={24} color="var(--info)" /> },
            { label: 'Deep:Shallow Ratio', value: weeklyStats.ratio, icon: <Target size={24} color="var(--success)" /> },
            { label: 'Longest Block (Min)', value: weeklyStats.longest, icon: <Flame size={24} color="var(--warning)" /> }
          ].map((stat, i) => (
             <div key={i} style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                 <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{stat.label.toUpperCase()}</span>
                 {stat.icon}
               </div>
               <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: 'var(--text-primary)', lineHeight: 1 }}>
                 {stat.value}
               </div>
             </div>
          ))}
        </div>
      </div>

      {/* Chart Section */}
      <div style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', height: '350px' }}>
        <h3 style={{ margin: '0 0 24px 0', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>30-DAY TREND</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDeep" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="var(--border-color)" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }} />
            <YAxis stroke="var(--border-color)" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-mono)' }} />
            <Tooltip contentStyle={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontFamily: 'var(--font-mono)' }} />
            <Area type="monotone" dataKey="hours" stroke="var(--accent-secondary)" fillOpacity={1} fill="url(#colorDeep)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap / Streak */}
      <div style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(var(--glass-blur))', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>ACTIVITY HEATMAP</h4>
          <div style={{ display: 'flex', gap: '4px' }}>
            {heatmapWeeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {week.map((intensity, di) => (
                  <div key={di} style={{ 
                    width: '14px', height: '14px', borderRadius: '3px',
                    background: intensity === 0 ? 'var(--bg-tertiary)' : 
                               intensity < 2 ? 'rgba(168, 85, 247, 0.3)' :
                               intensity < 4 ? 'rgba(168, 85, 247, 0.6)' : 'var(--accent-secondary)'
                  }} title={`${intensity} hours`} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(245, 158, 11, 0.1)', padding: '16px 24px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <Flame size={32} color="var(--warning)" />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--warning)', lineHeight: 1 }}>12 DAYS</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>DEEP WORK STREAK</div>
          </div>
        </div>

      </div>

    </div>
  );
}
