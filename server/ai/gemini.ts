import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3.8-flash';

export interface GeminiConnectionStatus {
  provider: 'Google Gemini';
  model: string;
  configured: boolean;
}

export function getGeminiConnectionStatus(): GeminiConnectionStatus {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return {
    provider: 'Google Gemini',
    model: GEMINI_MODEL,
    configured: Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY'),
  };
}

export async function testGeminiConnection(): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('Gemini is not configured. Add GEMINI_API_KEY to the server environment.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: 'Reply with exactly this text and nothing else: BRANDFLOW GEMINI CONNECTION OK',
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error('Gemini responded without a text result. Please try again.');
  }
  return text;
}
