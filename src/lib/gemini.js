import { GoogleGenAI } from '@google/genai'

/**
 * LOKI AI Engine
 * Calls Gemini 2.5 Flash with operator context and a specific prompt.
 * Fails gracefully with no API key.
 */

const SYSTEM_INSTRUCTION = `You are LOKI — the intelligence layer of ChiragOS, a personal operating system. You know the operator personally through their data. You speak like a sharp, direct tactical advisor — no fluff, no motivational clichés. You use the operator's actual task names, goal titles, and battle names in your responses. You are honest, sometimes blunt. You keep responses concise and formatted (bullet points or numbered lists when listing, short paragraphs for analysis). Never say "Great question!" or anything generic.`

export async function lokiQuery(prompt, apiKey) {
  if (!apiKey) return null

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    })
    return response.text
  } catch (error) {
    console.error('LOKI query error:', error)
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
