"use client";
import React, { useState, useEffect } from 'react';
import { WorkProvider, useWork } from '@/lib/hooks/useWork';
import { useOS } from '@/lib/context/OSContext';
import { Search, Bell, Plus, Activity, Calendar, Folder, FileText, Target, Zap, Lightbulb, Copy, Clock, PlayCircle, CheckCircle, ChevronDown, ChevronRight, LayoutTemplate } from 'lucide-react';

// Sub-components
import WorkspaceSelector from '@/components/work/WorkspaceSelector';
import UniversalSearchModal from '@/components/work/UniversalSearchModal';
import NotificationCenter from '@/components/work/NotificationCenter';
import DashboardBuilder from '@/components/work/DashboardBuilder';
import ProjectMilestoneManager from '@/components/work/ProjectMilestoneManager';
import WorkCategoryManager from '@/components/work/WorkCategoryManager';
import EntityManager from '@/components/work/EntityManager';
import TargetManager from '@/components/work/TargetManager';
import DeepWorkTracker from '@/components/work/DeepWorkTracker';
import IntelligentInsightsPanel from '@/components/work/IntelligentInsightsPanel';
import TemplateLibraryModal from '@/components/work/TemplateLibraryModal';
import EventLogViewer from '@/components/work/EventLogViewer';
import SessionPlannerModal from '@/components/work/SessionPlannerModal';
import SessionExecutorModal from '@/components/work/SessionExecutorModal';
import SessionTimelineViewer from '@/components/work/SessionTimelineViewer';

function WorkIntelligenceContent() {
  const { auth } = useOS();
  const userId = auth?.user?.id;
  const { sessions, notifications } = useWork();
  
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [activeSessionForExec, setActiveSessionForExec] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);

  const tabs = [
    { id: 'Dashboard', label: 'Dashboard', icon: Activity },
    { id: 'Sessions', label: 'Sessions', icon: Calendar },
    { id: 'Projects', label: 'Projects', icon: Folder },
    { id: 'Categories', label: 'Categories', icon: Copy },
    { id: 'Entities', label: 'Entities', icon: FileText },
    { id: 'Targets', label: 'Targets', icon: Target },
    { id: 'Deep Work', label: 'Deep Work', icon: Zap },
    { id: 'Insights', label: 'Insights', icon: Lightbulb },
    { id: 'Templates', label: 'Templates', icon: LayoutTemplate },
    { id: 'Event Log', label: 'Event Log', icon: Clock }
  ];

  // Handle Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const unreadCount = (notifications || []).filter(n => !n.is_read).length;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Dashboard': return <DashboardBuilder />;
      case 'Sessions': return renderSessionsTab();
      case 'Projects': return <ProjectMilestoneManager />;
      case 'Categories': return <WorkCategoryManager />;
      case 'Entities': return <EntityManager />;
      case 'Targets': return <TargetManager />;
      case 'Deep Work': return <DeepWorkTracker />;
      case 'Insights': return <IntelligentInsightsPanel />;
      case 'Templates': return <div className="h-full"><TemplateLibraryModal isOpen={true} onClose={() => setActiveTab('Dashboard')} /></div>; // Inline rendering fallback or just a trigger, let's keep it as modal triggered, but the spec says inline
      case 'Event Log': return <EventLogViewer />;
      default: return null;
    }
  };

  const renderSessionsTab = () => {
    const active = sessions.filter(s => s.status === 'active' || s.status === 'paused');
    const planned = sessions.filter(s => s.status === 'planned');
    const completed = sessions.filter(s => s.status === 'completed').slice(0, 5); // recent 5

    const SessionCard = ({ session, type }) => (
      <div 
        onClick={() => type === 'active' ? setActiveSessionForExec(session) : (type === 'completed' ? setExpandedSession(expandedSession?.id === session.id ? null : session) : null)}
        className="p-4 rounded-xl border flex flex-col gap-2 cursor-pointer transition-colors hover:bg-white/5 relative overflow-hidden group"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
        <div className="flex justify-between items-start ml-2">
          <div>
            <h4 className="font-bold text-sm text-white">{session.title || 'Untitled Session'}</h4>
            <p className="text-xs text-gray-400 font-mono mt-1">{session.project_id ? 'Linked Project' : 'Standalone'}</p>
          </div>
          <div className="text-xs px-2 py-1 rounded bg-white/10 text-white capitalize font-mono">
            {session.status}
          </div>
        </div>
        {expandedSession?.id === session.id && type === 'completed' && (
          <div className="mt-4 pt-4 border-t border-white/10 ml-2" onClick={e => e.stopPropagation()}>
            <SessionTimelineViewer sessionId={session.id} />
          </div>
        )}
      </div>
    );

    return (
      <div className="flex flex-col h-full space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">Session Manager</h2>
          <button 
            onClick={() => setIsPlannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-bold text-sm transition-transform hover:scale-105"
          >
            <Plus size={16} /> Plan Session
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
          {/* Active Now */}
          <div className="flex flex-col bg-black/20 rounded-xl border border-white/10 p-4 overflow-y-auto">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2 uppercase tracking-wider"><PlayCircle size={16} className="text-blue-400"/> Active Now</h3>
            <div className="space-y-3">
              {active.length === 0 ? <p className="text-xs text-gray-500 italic">No active sessions</p> : active.map(s => <SessionCard key={s.id} session={s} type="active" />)}
            </div>
          </div>

          {/* Planned Today */}
          <div className="flex flex-col bg-black/20 rounded-xl border border-white/10 p-4 overflow-y-auto">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2 uppercase tracking-wider"><Clock size={16} className="text-yellow-400"/> Planned</h3>
            <div className="space-y-3">
              {planned.length === 0 ? <p className="text-xs text-gray-500 italic">No planned sessions</p> : planned.map(s => <SessionCard key={s.id} session={s} type="planned" />)}
            </div>
          </div>

          {/* Recent Completed */}
          <div className="flex flex-col bg-black/20 rounded-xl border border-white/10 p-4 overflow-y-auto">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={16} className="text-green-400"/> Recent Completed</h3>
            <div className="space-y-3">
              {completed.length === 0 ? <p className="text-xs text-gray-500 italic">No completed sessions</p> : completed.map(s => <SessionCard key={s.id} session={s} type="completed" />)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-gray-200">
      {/* Top Bar */}
      <header className="h-16 flex items-center justify-between px-6 border-b z-40 bg-[#050505]" style={{ borderColor: 'var(--border-color)' }}>
        <div className="w-1/3 flex items-center">
          <WorkspaceSelector />
        </div>
        
        <div className="w-1/3 flex justify-center">
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-3 px-4 py-2 w-full max-w-md rounded-full bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-colors group"
          >
            <Search size={16} />
            <span className="text-sm flex-1 text-left">Search everything...</span>
            <span className="text-xs font-mono bg-black/40 px-2 py-0.5 rounded border border-white/10 group-hover:border-white/30 transition-colors">Ctrl+K</span>
          </button>
        </div>

        <div className="w-1/3 flex justify-end items-center gap-4">
          <button 
            onClick={() => setIsNotifOpen(true)}
            className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#050505]"></span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Tab Navigation */}
        <div className="px-6 border-b flex overflow-x-auto no-scrollbar" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors
                  ${isActive ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}
                `}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-black relative">
          <div className="max-w-7xl mx-auto h-full">
            {renderTabContent()}
          </div>
          
          {/* FAB for Mobile */}
          <button 
            className="md:hidden absolute bottom-6 right-6 p-4 rounded-full bg-white text-black shadow-lg z-30"
            onClick={() => setIsPlannerOpen(true)}
          >
            <Plus size={24} />
          </button>
        </main>
      </div>

      {/* Modals & Overlays */}
      <UniversalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
      
      {isPlannerOpen && <SessionPlannerModal onClose={() => setIsPlannerOpen(false)} />}
      {activeSessionForExec && <SessionExecutorModal session={activeSessionForExec} onClose={() => setActiveSessionForExec(null)} />}
      
      {activeTab === 'Templates' && <TemplateLibraryModal isOpen={true} onClose={() => setActiveTab('Dashboard')} />}
    </div>
  );
}

export default function WorkIntelligencePage() {
  const { auth } = useOS();
  const userId = auth?.user?.id;
  return (
    <WorkProvider userId={userId}>
      <WorkIntelligenceContent />
    </WorkProvider>
  );
}
