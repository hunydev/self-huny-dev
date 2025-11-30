import { GoogleGenAI, Type } from "@google/genai";
import { ItemType } from "../types";

// This function attempts to suggest tags and a title based on content.
export const suggestMetadata = async (
  content: string,
  type: ItemType
): Promise<{ title: string; tags: string[] }> => {
  
  if (!process.env.API_KEY) {
    console.warn("API_KEY not found. Skipping AI suggestions.");
    return { title: "", tags: [] };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let prompt = "";
  if (type === ItemType.LINK) {
    prompt = `Analyze this URL/Link: "${content}". Provide a short, concise title (max 5 words) and a list of relevant category tags (max 3).`;
  } else if (type === ItemType.TEXT) {
    prompt = `Analyze this text: "${content}". Provide a short, concise title (max 5 words) summarizing the intent and a list of relevant category tags (max 3).`;
  } else {
    // For files/images, we might only have a filename or limited context if we don't upload the blob.
    // For this implementation, we will skip heavy file analysis to keep it simple, or use the filename.
    return { title: "", tags: [] }; 
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            tags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
          },
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return {
      title: result.title || "",
      tags: result.tags || [],
    };
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return { title: "", tags: [] };
  }
};
