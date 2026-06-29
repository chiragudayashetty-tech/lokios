import React, { useState, useEffect } from 'react';
import { generateAIResponse } from './lib/gemini';

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
        className="secondary-button compact" 
        style={{ marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
        type="button" 
        onClick={() => setIsOpen(true)}
      >
        ✨ AI
      </button>

      {isOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div style={modalHeaderStyle}>
              <h3>✨ AI Assistant</h3>
              <button onClick={() => setIsOpen(false)} style={closeButtonStyle}>✕</button>
            </div>

            <div className="segmented" style={{ marginBottom: '16px' }}>
              <button 
                className={activeTab === 'chat' ? 'active' : ''} 
                onClick={() => setActiveTab('chat')}
                type="button"
              >
                Chat
              </button>
              <button 
                className={activeTab === 'settings' ? 'active' : ''} 
                onClick={() => setActiveTab('settings')}
                type="button"
              >
                Settings
              </button>
            </div>

            {activeTab === 'chat' && (
              <div>
                {!apiKey ? (
                  <p className="muted" style={{ fontSize: '0.9rem' }}>Please configure your API key in settings to use the AI.</p>
                ) : (
                  <form onSubmit={handleChat} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <textarea 
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Ask the AI (e.g., summarize my day, organize my brain dump)..."
                      rows={3}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #333', background: '#111', color: '#fff' }}
                    />
                    <button type="submit" className="primary-button" disabled={isLoading}>
                      {isLoading ? 'Thinking...' : 'Ask AI'}
                    </button>
                  </form>
                )}

                {response && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#222', borderRadius: '6px', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                    {response}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p className="muted" style={{ fontSize: '0.85rem' }}>
                  Your Gemini API key is stored securely in your browser's local storage and is never sent anywhere except directly to Google's API.
                </p>
                <label>
                  Gemini API Key
                  <input 
                    type="password" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)} 
                    placeholder="AIzaSy..." 
                    style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                  />
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" className="primary-button" style={{ flex: 1 }}>Save Key</button>
                  {apiKey && (
                    <button type="button" className="secondary-button" onClick={handleRemoveKey}>Remove</button>
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

// Inline styles to ensure it doesn't break existing CSS
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
  background: '#0a0a0a',
  border: '1px solid #333',
  borderRadius: '12px',
  padding: '24px',
  width: '90%',
  maxWidth: '400px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
  color: '#ececec'
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
  color: '#888',
  fontSize: '1.2rem',
  cursor: 'pointer'
};
