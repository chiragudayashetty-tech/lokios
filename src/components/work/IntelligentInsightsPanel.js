"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, Target, LineChart, AlertTriangle, Check, X, BarChart2, Activity } from 'lucide-react';
import { useWork } from '@/lib/hooks/useWork';

export default function IntelligentInsightsPanel() {
  const { getInsights } = useWork();
  const [insightsData, setInsightsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const data = await getInsights();
        setInsightsData(data || { insights: [], recommendations: [], stats: {} });
      } catch (err) {
        console.error("Failed to load insights", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInsights();
  }, [getInsights]);

  const getInsightIcon = (type) => {
    switch (type) {
      case 'trend': return <TrendingUp size={20} />;
      case 'energy': return <Zap size={20} />;
      case 'accuracy': return <Target size={20} />;
      case 'growth': return <LineChart size={20} />;
      case 'warning': return <AlertTriangle size={20} />;
      default: return <Activity size={20} />;
    }
  };

  const getColorForConfidence = (conf) => {
    if (conf >= 80) return 'var(--success)';
    if (conf >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-4 rounded-xl border animate-pulse" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-white/5 rounded w-full mb-2"></div>
          <div className="h-4 bg-white/5 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Sessions Analyzed', value: insightsData?.stats?.sessions_analyzed || '0' },
          { label: 'Avg Confidence', value: `${insightsData?.stats?.avg_confidence || '0'}%` },
          { label: 'Active Recs', value: insightsData?.recommendations?.length || '0' },
          { label: 'Insights Gen', value: insightsData?.insights?.length || '0' },
        ].map((stat, i) => (
          <div key={i} className="p-4 rounded-xl border flex flex-col justify-center items-center text-center" style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}>
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            <div className="text-2xl font-display font-bold" style={{ color: 'var(--accent-primary)' }}>{loading ? '-' : stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Insights Section */}
        <div className="xl:col-span-2 space-y-4">
          <h3 className="text-lg font-display font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Activity size={18} /> Discovered Insights
          </h3>
          {loading ? renderSkeleton() : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insightsData?.insights?.map((insight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-4 rounded-xl border relative overflow-hidden flex flex-col"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 rounded-lg bg-white/5" style={{ color: 'var(--text-primary)' }}>
                      {getInsightIcon(insight.type)}
                    </div>
                    {/* Confidence Badge */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold font-mono" style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: `1px solid ${getColorForConfidence(insight.confidence)}`, color: getColorForConfidence(insight.confidence) }}>
                      {insight.confidence}% Conf
                    </div>
                  </div>
                  <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>{insight.title}</h4>
                  <p className="text-sm flex-1 leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                    {insight.description}
                  </p>
                  <div className="mt-4 pt-3 border-t text-xs font-mono" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                    {insight.evidence_count} evidence points
                  </div>
                </motion.div>
              ))}
              {insightsData?.insights?.length === 0 && (
                 <div className="col-span-2 p-8 text-center border rounded-xl" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                   No insights generated yet. Log more sessions!
                 </div>
              )}
            </div>
          )}
        </div>

        {/* Recommendations Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-display font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Lightbulb size={18} /> Actionable Recs
          </h3>
          <div className="space-y-4">
            {loading ? (
              <div className="p-4 rounded-xl border animate-pulse" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                <div className="h-6 bg-white/10 rounded w-2/3 mb-4"></div>
                <div className="h-20 bg-white/5 rounded w-full"></div>
              </div>
            ) : insightsData?.recommendations?.map((rec, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                className="p-4 rounded-xl border relative"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: rec.priority === 'High' ? 'var(--accent-secondary)' : 'var(--border-color)',
                  boxShadow: rec.priority === 'High' ? '0 0 20px rgba(168,85,247,0.1)' : 'none'
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${rec.priority === 'High' ? 'bg-red-500' : rec.priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{rec.priority} Priority</span>
                </div>
                <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--text-primary)' }}>{rec.title}</h4>
                <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>{rec.description}</p>
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-white text-black transition-transform hover:scale-[1.02]">
                    Apply
                  </button>
                  <button className="flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors hover:bg-white/5" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    Dismiss
                  </button>
                </div>
              </motion.div>
            ))}
            {!loading && insightsData?.recommendations?.length === 0 && (
               <div className="p-8 text-center border rounded-xl" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                 No recommendations at this time.
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
