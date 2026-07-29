"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, ZapOff, Calendar, Lightbulb, AlertTriangle, CheckCircle2, Check } from 'lucide-react';
import { useWork } from '@/lib/hooks/useWork';

export default function NotificationCenter({ isOpen, onClose }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useWork();
  const [filter, setFilter] = useState('All');

  const getIconForType = (type) => {
    switch (type) {
      case 'target_achieved': return <Target size={16} style={{ color: 'var(--success)' }} />;
      case 'streak_broken': return <ZapOff size={16} style={{ color: 'var(--danger)' }} />;
      case 'milestone_due': return <Calendar size={16} style={{ color: 'var(--warning)' }} />;
      case 'recommendation': return <Lightbulb size={16} style={{ color: 'var(--info)' }} />;
      case 'system_alert': return <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />;
      default: return <AlertTriangle size={16} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  const getRelativeTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const filteredNotifications = (notifications || []).filter(n => {
    if (filter === 'Unread') return !n.is_read;
    if (filter === 'Targets') return n.type === 'target_achieved';
    if (filter === 'System') return n.type === 'system_alert';
    return true;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190]"
            onClick={onClose}
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-sm z-[200] flex flex-col shadow-2xl"
            style={{ 
              backgroundColor: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              borderLeft: '1px solid var(--glass-border)'
            }}
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-xl font-display font-bold tracking-wide uppercase" style={{ color: 'var(--text-primary)' }}>
                Notifications
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => markAllNotificationsRead()}
                  className="p-1.5 rounded hover:bg-white/10 text-xs font-medium flex items-center gap-1 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  title="Mark all as read"
                >
                  <Check size={14} />
                  All Read
                </button>
                <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 transition-colors">
                  <X size={20} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center px-4 py-2 border-b gap-4 text-sm font-medium" style={{ borderColor: 'var(--border-color)' }}>
              {['All', 'Unread', 'Targets', 'System'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="transition-colors"
                  style={{ color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 relative" style={{ fontFamily: 'var(--font-body)' }}>
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring' }}>
                    <CheckCircle2 size={48} style={{ color: 'var(--success)' }} className="mb-4" />
                  </motion.div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>All caught up!</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No new notifications to display.</p>
                </div>
              ) : (
                filteredNotifications.map((notification, i) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!notification.is_read) markNotificationRead(notification.id);
                    }}
                    className="p-3 rounded-lg relative cursor-pointer overflow-hidden transition-all hover:bg-white/5"
                    style={{ 
                      backgroundColor: notification.is_read ? 'transparent' : 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {!notification.is_read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-secondary" style={{ background: 'var(--accent-secondary)' }} />
                    )}
                    <div className="flex gap-3 ml-1">
                      <div className="mt-0.5">
                        {getIconForType(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                            {notification.title}
                          </span>
                          <span className="text-xs whitespace-nowrap font-mono" style={{ color: 'var(--text-muted)' }}>
                            {getRelativeTime(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
