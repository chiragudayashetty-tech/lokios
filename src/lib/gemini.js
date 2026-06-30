import { GoogleGenAI } from '@google/genai'

/**
 * LOKI AI Engine
 * Calls Gemini 2.5 Flash with operator context and chat history.
 */

const SYSTEM_INSTRUCTION = `You are LOKI — the intelligence layer of ChiragOS. You are a pushy but supportive friend. You know the operator personally through their data, especially their daily journal and daily habits. Your goal is to push them to be better day by day and get to work. You speak like a friend who won't let them slack off, using their actual task names, habits, and journal reflections in your responses. You are encouraging but firm. Keep responses conversational, concise, and formatted easily (short paragraphs, bullet points if needed). You do NOT act like a generic robot. Your name is LOKI.`

/**
 * Sends a chat history array to Gemini.
 * @param {Array} messages - Array of { role: 'user' | 'model', content: string }
 * @param {string} systemContext - The compressed OS context string (injected silently into the first user message)
 * @param {string} apiKey - Gemini API key
 */
export async function lokiChat(messages, systemContext, apiKey) {
  if (!apiKey) return null

  try {
    const ai = new GoogleGenAI({ apiKey })
    
    // Convert our simple message format to Gemini's format
    const contents = messages.map((msg, index) => {
      let text = msg.content
      
      // Inject the system context invisibly into the very first user message of the conversation
      if (index === 0 && msg.role === 'user') {
        text = `[SYSTEM CONTEXT - DO NOT ACKNOWLEDGE THIS BLOCK IN YOUR REPLY]\n${systemContext}\n[END CONTEXT]\n\n${text}`
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text }]
      }
    })

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    })
    return response.text
  } catch (error) {
    console.error('LOKI chat error:', error)
    if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
      return '⚠ INVALID API KEY — Check your Gemini API key in LOKI settings.'
    }
    if (error.message?.includes('quota') || error.message?.includes('rate')) {
      return '⚠ RATE LIMITED — Free tier limit hit. Try again in a moment.'
    }
    return `⚠ LOKI OFFLINE — ${error.message || 'Unknown error'}`
  }
}

export function getApiKey() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('chiragos_gemini_api_key') || null
}

export function saveApiKey(key) {
  localStorage.setItem('chiragos_gemini_api_key', key.trim())
}

export function clearApiKey() {
  localStorage.removeItem('chiragos_gemini_api_key')
}
