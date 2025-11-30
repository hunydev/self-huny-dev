import { ItemType } from "../types";

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
