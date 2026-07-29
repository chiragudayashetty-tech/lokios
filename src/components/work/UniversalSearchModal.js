"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, Folder, Target, Zap, Bookmark, Activity, FileText } from 'lucide-react';
import { useWork } from '@/lib/hooks/useWork';

export default function UniversalSearchModal({ isOpen, onClose }) {
  const { universalSearch } = useWork();
  const [query, setQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [results, setResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const inputRef = useRef(null);

  const filters = [
    { id: 'sessions', label: 'Sessions', icon: Activity },
    { id: 'projects', label: 'Projects', icon: Folder },
    { id: 'categories', label: 'Categories', icon: Bookmark },
    { id: 'entities', label: 'Entities', icon: FileText },
    { id: 'tags', label: 'Tags', icon: Zap },
    { id: 'milestones', label: 'Milestones', icon: Target },
  ];

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      const recent = JSON.parse(localStorage.getItem('work_recent_searches') || '[]');
      setRecentSearches(recent);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const searchResults = await universalSearch(query);
        if (searchResults && activeFilters.length > 0) {
          const filtered = {};
          activeFilters.forEach(f => {
            if (searchResults[f]) filtered[f] = searchResults[f];
          });
          setResults(filtered);
        } else {
          setResults(searchResults);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, activeFilters, universalSearch]);

  const toggleFilter = (id) => {
    setActiveFilters(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleSelect = (result) => {
    const newRecent = [query, ...recentSearches.filter(q => q !== query)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('work_recent_searches', JSON.stringify(newRecent));
    onClose();
  };

  const getIconForType = (type) => {
    const filter = filters.find(f => f.id === type);
    return filter ? filter.icon : FileText;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[190] flex items-start justify-center pt-[10vh] px-4"
        onClick={onClose}
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[600px] rounded-xl overflow-hidden shadow-xl"
          style={{ 
            backgroundColor: 'var(--glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--glass-border)'
          }}
        >
          {/* Search Input Area */}
          <div className="p-4 border-b relative" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-3">
              <Search size={24} style={{ color: 'var(--text-secondary)' }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search workspaces, sessions, projects..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-xl"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}
              />
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 pl-9 pr-2">
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                Ctrl+K to open
              </span>
            </div>
          </div>

          {/* Filters Row */}
          <div className="px-4 py-3 border-b flex gap-2 overflow-x-auto no-scrollbar" style={{ borderColor: 'var(--border-color)' }}>
            {filters.map(filter => {
              const Icon = filter.icon;
              const isActive = activeFilters.includes(filter.id);
              return (
                <button
                  key={filter.id}
                  onClick={() => toggleFilter(filter.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
                  style={{
                    backgroundColor: isActive ? 'var(--text-primary)' : 'rgba(255,255,255,0.05)',
                    color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={14} />
                  {filter.label}
                </button>
              );
            })}
          </div>

          {/* Results Area */}
          <div className="max-h-[400px] overflow-y-auto p-2" style={{ fontFamily: 'var(--font-body)' }}>
            {isSearching ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-white/10 rounded w-1/3" />
                      <div className="h-3 bg-white/10 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : query.length > 0 && results ? (
              Object.keys(results).length > 0 ? (
                Object.entries(results).map(([type, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={type} className="mb-4 last:mb-0">
                      <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                        {type}
                      </div>
                      <div className="space-y-1">
                        {items.map((item, idx) => {
                          const Icon = getIconForType(type);
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSelect(item)}
                              className="w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors hover:bg-white/5"
                            >
                              <div className="mt-0.5 p-2 rounded-md bg-white/5">
                                <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                  {item.title || item.name}
                                </div>
                                <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                  {item.description || item.subtitle || ''}
                                </div>
                              </div>
                              <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                {item.date || ''}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  No results found for "{query}"
                </div>
              )
            ) : (
              // Recent Searches
              recentSearches.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                    Recent
                  </div>
                  {recentSearches.map((search, idx) => (
                    <button
                      key={idx}
                      onClick={() => setQuery(search)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors hover:bg-white/5 group"
                    >
                      <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                      <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{search}</span>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
