'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Briefcase, FolderPlus, Layers, Database, Sparkles } from 'lucide-react'

export default function WorkPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-border-color">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber/10 border border-amber/30 text-amber">
              <Briefcase size={24} />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl tracking-widest text-primary uppercase">
                WORK INTELLIGENCE SYSTEM
              </h1>
              <p className="font-mono text-xs text-muted">
                Step-by-Step Modular Architecture — Effort, Output & Outcome Intelligence
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-amber bg-amber/10 border border-amber/30 px-3 py-1.5 rounded-full">
            STEP 1: READY FOR INITIAL MODULE
          </span>
        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-secondary border border-border-color rounded-2xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2 text-cyan font-mono text-xs tracking-wider uppercase">
          <Sparkles size={16} />
          <span>Step-by-Step Modular Build Activated</span>
        </div>
        <h2 className="font-display text-xl text-primary uppercase">
          Welcome to the Work Intelligence System
        </h2>
        <p className="font-mono text-sm text-secondary leading-relaxed max-w-3xl">
          The previous monolith draft has been scrapped. We will now build each module step-by-step to ensure total control, scalability, and zero bugs.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-xl bg-tertiary border border-border-subtle space-y-2">
            <div className="font-mono text-xs text-amber uppercase font-bold flex items-center gap-2">
              <Database size={14} /> Step 1: Database Schema
            </div>
            <p className="font-mono text-xs text-muted">
              SQL tables for Workspaces, Categories, Custom Metrics, Sessions & Projects.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-tertiary border border-border-subtle space-y-2 opacity-60">
            <div className="font-mono text-xs text-primary uppercase font-bold flex items-center gap-2">
              <Layers size={14} /> Step 2: Categories & Metrics
            </div>
            <p className="font-mono text-xs text-muted">
              Define custom metrics (Input, Output, Outcome) & metric units.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-tertiary border border-border-subtle space-y-2 opacity-60">
            <div className="font-mono text-xs text-primary uppercase font-bold flex items-center gap-2">
              <FolderPlus size={14} /> Step 3: Work Sessions
            </div>
            <p className="font-mono text-xs text-muted">
              Planning vs Execution tracking, reflections & timeline.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
