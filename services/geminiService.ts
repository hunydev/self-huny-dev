import { ItemType } from "../types";

const API_BASE = '/api';

// AI Usage tracking types
export interface AIUsageStats {
  titleGeneration: number;
  textFormatting: number;
  itemParsing: number;
  lastReset: string; // ISO date string
}

const AI_USAGE_KEY = 'ai_usage_stats';

// Get current AI usage stats
export const getAIUsageStats = (): AIUsageStats => {
  const stored = localStorage.getItem(AI_USAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid data, reset
    }
  }
  return {
    titleGeneration: 0,
    textFormatting: 0,
    itemParsing: 0,
    lastReset: new Date().toISOString(),
  };
};

// Increment AI usage count
const incrementUsage = (type: keyof Omit<AIUsageStats, 'lastReset'>) => {
  const stats = getAIUsageStats();
  stats[type]++;
  localStorage.setItem(AI_USAGE_KEY, JSON.stringify(stats));
};

// Reset AI usage stats (for future use with quotas)
export const resetAIUsageStats = () => {
  const newStats: AIUsageStats = {
    titleGeneration: 0,
    textFormatting: 0,
    itemParsing: 0,
    lastReset: new Date().toISOString(),
  };
  localStorage.setItem(AI_USAGE_KEY, JSON.stringify(newStats));
};

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Create headers with Authorization
const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

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
    headers: getAuthHeaders(),
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to suggest title' })) as { error?: string };
    throw new Error(error.error || 'Failed to suggest title');
  }

  const data = await response.json() as { title: string };
  
  // Track usage
  incrementUsage('titleGeneration');
  
  return data.title;
};

// Format text with AI (apply minimal formatting for readability)
export const formatText = async (content: string): Promise<string> => {
  const response = await fetch(`${API_BASE}/gemini/format-text`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to format text' })) as { error?: string };
    throw new Error(error.error || 'Failed to format text');
  }

  const data = await response.json() as { formatted: string };
  
  // Track usage
  incrementUsage('textFormatting');
  
  return data.formatted;
};

// Parse items from unstructured text using Gemini AI
export const parseItems = async (content: string): Promise<ParsedItem[]> => {
  const response = await fetch(`${API_BASE}/gemini/parse-items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to parse items' })) as { error?: string };
    throw new Error(error.error || 'Failed to parse items');
  }

  const data = await response.json() as { items: ParsedItem[] };
  
  // Track usage
  incrementUsage('itemParsing');
  
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
