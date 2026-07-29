"use client";
import React, { useState, useEffect } from 'react';
import { Filter, Calendar as CalendarIcon, RefreshCw, Activity, Folder, Zap, Target } from 'lucide-react';
import { useWork } from '@/lib/hooks/useWork';

export default function EventLogViewer() {
  const { getEventLogs } = useWork();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const typeFilter = filterType === 'All' ? null : filterType.toLowerCase();
      const data = await getEventLogs({ type: typeFilter, limit: 50, offset: (page - 1) * 50 });
      setLogs(page === 1 ? data : [...logs, ...data]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterType, page]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        if (page === 1) fetchLogs();
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh, filterType, page]);

  const getColorForType = (type) => {
    const t = type.toLowerCase();
    if (t.includes('session')) return '#3B82F6';
    if (t.includes('metric')) return '#8B5CF6';
    if (t.includes('project')) return '#10B981';
    if (t.includes('target')) return '#F59E0B';
    return '#EF4444'; // System
  };

  return (
    <div className="flex flex-col h-full w-full rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-4" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
        <h2 className="text-lg font-display font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
          System Event Log
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select 
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="bg-transparent border-none text-sm font-medium outline-none"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="All">All Events</option>
              <option value="Session">Sessions</option>
              <option value="Metric">Metrics</option>
              <option value="Project">Projects</option>
              <option value="Target">Targets</option>
            </select>
          </div>
          
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      {/* Log List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.map((log, i) => (
          <div 
            key={log.id || i} 
            className="p-3 rounded-lg flex items-start gap-4 transition-colors hover:bg-white/5"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
          >
            <div 
              className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap w-28 text-center"
              style={{ backgroundColor: `${getColorForType(log.event_type)}20`, color: getColorForType(log.event_type) }}
            >
              {log.event_type.replace('_', ' ')}
            </div>
            
            <div className="flex-1 min-w-0" style={{ fontFamily: 'var(--font-body)' }}>
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {log.description || `${log.event_type} on ${log.entity_type} ${log.entity_id}`}
              </div>
              <div className="text-xs mt-1 font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                Entity: {log.entity_type} | ID: {log.entity_id} {log.actor_id && `| Actor: ${log.actor_id}`}
              </div>
            </div>
            
            <div className="text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
              {new Date(log.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="p-4 text-center text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw className="animate-spin inline mr-2" size={14} /> Loading...
          </div>
        )}
        
        {!loading && logs.length > 0 && (
          <button 
            onClick={() => setPage(p => p + 1)}
            className="w-full py-3 rounded-lg text-sm font-medium transition-colors hover:bg-white/5 mt-4 border border-dashed"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          >
            Load More
          </button>
        )}
      </div>
    </div>
  );
}
