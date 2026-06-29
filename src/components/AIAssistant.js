'use client'

import React, { useState, useEffect } from 'react';
import { generateAIResponse } from '@/lib/gemini';
import { Sparkles } from 'lucide-react';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'settings'
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('chiragos_gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const handleSaveKey = (e) => {
    e.preventDefault();
    localStorage.setItem('chiragos_gemini_api_key', apiKey);
    alert('API Key saved securely in your browser!');
  };

  const handleRemoveKey = () => {
    localStorage.removeItem('chiragos_gemini_api_key');
    setApiKey('');
    alert('API Key removed.');
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (!apiKey) {
      alert('Please add your Gemini API key in the settings tab first.');
      setActiveTab('settings');
      return;
    }

    setIsLoading(true);
    setResponse('');
    
    try {
      const result = await generateAIResponse(prompt, apiKey);
      setResponse(result || 'No response. Please check your API key.');
    } catch (error) {
      setResponse('Error: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-center gap-2 p-2 rounded text-muted hover:text-amber hover:bg-tertiary transition-colors font-mono text-xs uppercase tracking-wider border border-transparent hover:border-amber/20"
        style={{ marginTop: '8px', marginBottom: '8px' }}
      >
        <Sparkles size={14} />
        AI Assistant
      </button>

      {isOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3 className="font-display tracking-wider text-xl flex items-center gap-2">
                <Sparkles size={20} className="text-amber" /> AI Assistant
              </h3>
              <button onClick={() => setIsOpen(false)} style={closeButtonStyle}>✕</button>
            </div>

            <div className="flex gap-2" style={{ marginBottom: '16px' }}>
              <button 
                className={`flex-1 p-2 font-mono text-xs uppercase tracking-wider rounded ${activeTab === 'chat' ? 'bg-primary text-bg-primary' : 'bg-tertiary border border-border-color'}`} 
                onClick={() => setActiveTab('chat')}
                type="button"
              >
                Chat
              </button>
              <button 
                className={`flex-1 p-2 font-mono text-xs uppercase tracking-wider rounded ${activeTab === 'settings' ? 'bg-primary text-bg-primary' : 'bg-tertiary border border-border-color'}`} 
                onClick={() => setActiveTab('settings')}
                type="button"
              >
                Settings
              </button>
            </div>

            {activeTab === 'chat' && (
              <div>
                {!apiKey ? (
                  <p className="text-muted font-mono text-xs">Please configure your API key in settings to use the AI.</p>
                ) : (
                  <form onSubmit={handleChat} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ask the AI (e.g., summarize my day, organize my brain dump)..."
                      rows={3}
                      className="w-full p-3 bg-bg-primary border border-border-color rounded text-primary font-mono text-sm focus:border-amber focus:outline-none"
                    />
                    <button type="submit" className="w-full p-2 bg-amber text-bg-primary font-mono text-sm uppercase tracking-wider rounded font-bold" disabled={isLoading}>
                      {isLoading ? 'Thinking...' : 'Ask AI'}
                    </button>
                  </form>
                )}

                {response && (
                  <div className="mt-4 p-3 bg-tertiary border border-border-color rounded text-sm text-primary font-mono whitespace-pre-wrap">
                    {response}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p className="text-muted font-mono text-xs">
                  Your Gemini API key is stored securely in your browser's local storage and is never sent anywhere except directly to Google's API.
                </p>
                <label className="font-mono text-xs uppercase tracking-wider text-muted">
                  Gemini API Key
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)} 
                    placeholder="AIzaSy..." 
                    className="w-full p-2 mt-1 bg-bg-primary border border-border-color rounded text-primary"
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="flex-1 p-2 bg-primary text-bg-primary font-mono text-sm uppercase tracking-wider rounded font-bold">Save Key</button>
                  {apiKey && (
                    <button type="button" className="p-2 border border-danger text-danger rounded font-mono text-sm uppercase tracking-wider" onClick={handleRemoveKey}>Remove</button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Inline styles for the modal overlay
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999
};

const modalContentStyle = {
  background: 'var(--bg-primary, #0b0d12)',
  border: '1px solid var(--border-color, #2a2d33)',
  borderRadius: '12px',
  padding: '24px',
  width: '90%',
  maxWidth: '400px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
  color: 'var(--text-primary, #e2e8f0)'
};

const modalHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px'
};

const closeButtonStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted, #94a3b8)',
  fontSize: '1.2rem',
  cursor: 'pointer'
};
