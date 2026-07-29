'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useWork from '@/lib/hooks/useWork';
import { Search, Plus, X, Edit2, Archive, Tag as TagIcon, Link as LinkIcon, Save, ChevronDown, ChevronUp } from 'lucide-react';

const ENTITY_TYPES = [
  { id: 'school', label: 'Schools', color: '#3B82F6' },
  { id: 'client', label: 'Clients', color: '#10B981' },
  { id: 'company', label: 'Companies', color: '#8B5CF6' },
  { id: 'person', label: 'People', color: '#F59E0B' },
  { id: 'location', label: 'Locations', color: '#EF4444' },
  { id: 'vendor', label: 'Vendors', color: '#06B6D4' },
  { id: 'partner', label: 'Partners', color: '#EC4899' },
  { id: 'custom', label: 'Custom', color: '#6B7280' },
];

export default function EntityManager() {
  const { entities, tags, createEntity, updateEntity, deleteEntity, currentWorkspace } = useWork();
  
  const [activeTab, setActiveTab] = useState('school');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    entity_type: activeTab,
    metadata: '{}',
    selectedTags: []
  });

  const filteredEntities = useMemo(() => {
    if (!entities) return [];
    return entities.filter(e => {
      const matchesType = e.entity_type === activeTab;
      const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [entities, activeTab, searchQuery]);

  const activeColor = ENTITY_TYPES.find(t => t.id === activeTab)?.color || '#ffffff';

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!currentWorkspace) return;
    
    try {
      let parsedMetadata = {};
      try {
        parsedMetadata = JSON.parse(formData.metadata);
      } catch (err) {
        console.error("Invalid JSON metadata", err);
        alert("Invalid JSON in metadata field.");
        return;
      }

      await createEntity({
        workspace_id: currentWorkspace.id,
        name: formData.name,
        description: formData.description,
        entity_type: formData.entity_type,
        metadata: parsedMetadata,
      });
      // Handle tags saving logic if supported by useWork, simplified here
      
      setIsCreating(false);
      setFormData({ name: '', description: '', entity_type: activeTab, metadata: '{}', selectedTags: [] });
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Header & Tabs */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '16px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        {ENTITY_TYPES.map(type => (
          <button
            key={type.id}
            onClick={() => { setActiveTab(type.id); setFormData(prev => ({...prev, entity_type: type.id})); }}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: activeTab === type.id ? 'var(--bg-active)' : 'transparent',
              border: `1px solid ${activeTab === type.id ? type.color : 'transparent'}`,
              color: activeTab === type.id ? type.color : 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              transition: 'var(--transition-base)'
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{
          position: 'relative',
          flex: 1,
          maxWidth: '400px'
        }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={`Search ${ENTITY_TYPES.find(t=>t.id===activeTab)?.label}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 10px 10px 38px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)'
            }}
          />
        </div>
        
        <button
          onClick={() => setIsCreating(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px',
            background: activeColor,
            color: '#000',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            textTransform: 'uppercase',
            fontWeight: 'bold'
          }}
        >
          <Plus size={18} /> New Entity
        </button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {isCreating && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              border: `1px solid ${activeColor}40`,
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', margin: 0, color: activeColor, textTransform: 'uppercase' }}>
                Create New {ENTITY_TYPES.find(t=>t.id===activeTab)?.label.slice(0, -1)}
              </h3>
              <button type="button" onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>NAME</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  style={{
                    padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ENTITY TYPE</label>
                <select
                  value={formData.entity_type}
                  onChange={e => setFormData({...formData, entity_type: e.target.value})}
                  style={{
                    padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)'
                  }}
                >
                  {ENTITY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>DESCRIPTION</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                style={{
                  padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', minHeight: '80px', resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>METADATA (JSON)</label>
              <textarea
                value={formData.metadata}
                onChange={e => setFormData({...formData, metadata: e.target.value})}
                style={{
                  padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', minHeight: '100px'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="submit" style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', background: activeColor, color: '#000',
                border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                fontFamily: 'var(--font-display)', fontWeight: 'bold'
              }}>
                <Save size={18} /> Save Entity
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Entity List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        <AnimatePresence>
          {filteredEntities.map((entity) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={entity.id}
              style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(var(--glass-blur))',
                border: '1px solid var(--border-color)',
                borderLeft: `4px solid ${activeColor}`,
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div 
                style={{ padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                onClick={() => toggleExpand(entity.id)}
              >
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-body)', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {entity.name}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {entity.description || 'No description provided.'}
                  </p>
                  
                  {/* Badges placeholder */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)'
                    }}>
                      <LinkIcon size={12} /> {entity.session_count || 0} Sessions
                    </span>
                  </div>
                </div>
                
                <div style={{ color: 'var(--text-muted)' }}>
                  {expandedId === entity.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>

              <AnimatePresence>
                {expandedId === entity.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                      <div style={{ marginBottom: '16px' }}>
                        <h5 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>METADATA</h5>
                        <pre style={{
                          margin: 0, padding: '12px', background: '#000', borderRadius: 'var(--radius-md)',
                          fontSize: '0.8rem', color: 'var(--text-primary)', overflowX: 'auto', border: '1px solid var(--border-color)'
                        }}>
                          {JSON.stringify(entity.metadata || {}, null, 2)}
                        </pre>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button style={{
                          padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                        }}>
                          <Edit2 size={14} /> Edit
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteEntity(entity.id); }}
                          style={{
                          padding: '6px 12px', background: 'transparent', border: '1px solid var(--danger)',
                          color: 'var(--danger)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
                        }}>
                          <Archive size={14} /> Archive
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          ))}
          
          {filteredEntities.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>No entities found for the selected type.</p>
            </div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
