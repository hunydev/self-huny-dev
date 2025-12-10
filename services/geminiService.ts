import { ItemType } from "../types";

const API_BASE = '/api';

// Parsed item from AI
export interface ParsedItem {
  type: 'text' | 'link';
  title: string;
  content: string;
}

// Suggest title using Gemini AI
export const suggestTitle = async (content: string): Promise<string> => {
  const response = await fetch(`${API_BASE}/gemini/suggest-title`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to suggest title' })) as { error?: string };
    throw new Error(error.error || 'Failed to suggest title');
  }

  const data = await response.json() as { title: string };
  return data.title;
};

// Parse items from unstructured text using Gemini AI
export const parseItems = async (content: string): Promise<ParsedItem[]> => {
  const response = await fetch(`${API_BASE}/gemini/parse-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to parse items' })) as { error?: string };
    throw new Error(error.error || 'Failed to parse items');
  }

  const data = await response.json() as { items: ParsedItem[] };
  return data.items;
};

// Gemini service is optional and can be enabled by setting GEMINI_API_KEY
// For Cloudflare Workers deployment, this would typically be moved to the worker
// and called via API. For now, we keep it client-side for simplicity.

export const suggestMetadata = async (
  _content: string,
  _type: ItemType
): Promise<{ title: string; tags: string[] }> => {
  // Gemini integration is optional
  // Return empty suggestions if not configured
  return { title: "", tags: [] };
};
