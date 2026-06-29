import { GoogleGenAI } from '@google/genai';

/**
 * Calls the Gemini API using the provided API key.
 * If the key is invalid or an error occurs, it returns null or throws gracefully.
 * 
 * @param {string} prompt - The text prompt for the AI.
 * @param {string} apiKey - The Gemini API key (retrieved from localStorage).
 * @returns {Promise<string|null>} - The AI's response text, or null on error.
 */
export async function generateAIResponse(prompt, apiKey) {
  if (!apiKey) {
    console.warn('Gemini API key is missing. AI request skipped.');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        // Keep responses concise to save tokens/credits
        systemInstruction: "You are a helpful, extremely concise productivity assistant. Keep your answers brief, actionable, and formatted nicely.",
      }
    });

    return response.text;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return 'Error: Could not fetch response from AI. Please check your API key.';
  }
}
