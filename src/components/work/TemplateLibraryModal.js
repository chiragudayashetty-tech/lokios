"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download, Upload, CheckCircle2, LayoutTemplate } from 'lucide-react';
import { useWork } from '@/lib/hooks/useWork';

export default function TemplateLibraryModal({ isOpen, onClose }) {
  const { applyTemplate } = useWork();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const templates = [
    {
      id: 'saas-founder',
      name: 'SaaS Founder',
      description: 'Optimized for solopreneurs building SaaS products.',
      categories: ['Development', 'Sales', 'Marketing', 'Operations'],
      metricsCount: 12,
      categoryColors: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6']
    },
    {
      id: 'content-creator',
      name: 'Content Creator',
      description: 'Streamline your creative workflow and audience growth.',
      categories: ['Filming', 'Editing', 'Writing', 'Outreach'],
      metricsCount: 8,
      categoryColors: ['#EC4899', '#8B5CF6', '#3B82F6', '#14B8A6']
    },
    {
      id: 'sales-exec',
      name: 'Sales Executive',
      description: 'Track pipeline, meetings, and closing efficiency.',
      categories: ['Prospecting', 'Meetings', 'Follow-ups', 'Closing'],
      metricsCount: 15,
      categoryColors: ['#F59E0B', '#EF4444', '#10B981', '#6366F1']
    },
    {
      id: 'consultant',
      name: 'Freelance Consultant',
      description: 'Manage client work, billing, and professional development.',
      categories: ['Client Work', 'Admin', 'Learning', 'Networking'],
      metricsCount: 10,
      categoryColors: ['#0EA5E9', '#64748B', '#8B5CF6', '#F43F5E']
    }
  ];

  const handleApply = async () => {
    if (!selectedTemplate) return;
    setIsApplying(true);
    try {
      await applyTemplate(selectedTemplate.id);
      setTimeout(() => {
        setIsApplying(false);
        setShowConfirm(false);
        onClose();
      }, 1000); // Simulate API call
    } catch (err) {
      console.error(err);
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[190] flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden"
          style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        >
          {/* Header */}
          <div className="p-6 border-b flex justify-between items-center" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div className="flex items-center gap-3">
              <LayoutTemplate size={24} style={{ color: 'var(--accent-secondary)' }} />
              <h2 className="text-2xl font-display font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                Template Library
              </h2>
            </div>
            <button onClick={onClose} className="p-2 rounded hover:bg-white/10 transition-colors">
              <X size={24} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.map(template => (
                <div 
                  key={template.id}
                  className="p-6 rounded-xl border flex flex-col group transition-all hover:-translate-y-1"
                  style={{ 
                    backgroundColor: 'var(--bg-primary)', 
                    borderColor: selectedTemplate?.id === template.id ? 'var(--accent-secondary)' : 'var(--border-color)',
                    boxShadow: selectedTemplate?.id === template.id ? '0 0 0 1px var(--accent-secondary)' : 'none'
                  }}
                >
                  <h3 className="text-2xl font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{template.name}</h3>
                  <p className="text-sm mb-6 flex-1" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                    {template.description}
                  </p>
                  
                  <div className="mb-6 space-y-3">
                    <div className="flex items-center gap-4 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      <span>{template.categories.length} Categories</span>
                      <span>{template.metricsCount} Metrics</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {template.categories.map((cat, i) => (
                        <div key={i} className="px-2 py-1 rounded text-xs font-bold" style={{ backgroundColor: `${template.categoryColors[i]}20`, color: template.categoryColors[i] }}>
                          {cat}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => { setSelectedTemplate(template); setShowConfirm(true); }}
                    className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors"
                    style={{ 
                      backgroundColor: 'var(--text-primary)', 
                      color: 'var(--bg-primary)'
                    }}
                  >
                    Apply Template
                  </button>
                </div>
              ))}
            </div>
            
            <div className="mt-8 pt-8 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-color)' }}>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Advanced: Export or import custom workspace configurations.
              </div>
              <div className="flex gap-4">
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <Download size={16} /> Export JSON
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:bg-white/5 transition-colors" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                  <Upload size={16} /> Import JSON
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Confirmation Dialog */}
        <AnimatePresence>
          {showConfirm && selectedTemplate && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            >
              <div className="p-6 rounded-xl border max-w-sm w-full text-center" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                {!isApplying ? (
                  <>
                    <h3 className="text-lg font-bold mb-2 text-white">Apply {selectedTemplate.name}?</h3>
                    <p className="text-sm text-gray-400 mb-6">
                      This will create {selectedTemplate.categories.length} categories and {selectedTemplate.metricsCount} metrics in your current workspace.
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 rounded border border-white/20 text-white hover:bg-white/10">Cancel</button>
                      <button onClick={handleApply} className="flex-1 py-2 rounded bg-white text-black font-bold">Confirm</button>
                    </div>
                  </>
                ) : (
                  <div className="py-8 flex flex-col items-center">
                    <CheckCircle2 size={48} className="text-green-500 mb-4 animate-bounce" />
                    <p className="text-white font-bold">Template Applied!</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
