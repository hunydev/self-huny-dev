import { ItemType } from "../types";

const API_BASE = '/api';

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
