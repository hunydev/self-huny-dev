import { Hono } from 'hono';

interface Env {
  GEMINI_API_KEY_FREE: string;
}

export const geminiRoutes = new Hono<{ Bindings: Env }>();

// Gemini API endpoint for title suggestion
geminiRoutes.post('/suggest-title', async (c) => {
  try {
    const { content } = await c.req.json();
    
    if (!content || typeof content !== 'string') {
      return c.json({ error: 'Content is required' }, 400);
    }

    const apiKey = c.env.GEMINI_API_KEY_FREE;
    if (!apiKey) {
      return c.json({ error: 'Gemini API key not configured' }, 500);
    }

    // Truncate content if too long (keep first 2000 chars)
    const truncatedContent = content.length > 2000 
      ? content.substring(0, 2000) + '...' 
      : content;

    const prompt = `당신은 콘텐츠의 제목을 생성하는 전문가입니다. 아래 내용을 분석하여 간결하고 명확한 제목을 한 줄로 생성해주세요.

규칙:
- 제목만 출력하세요 (따옴표나 설명 없이)
- 15자 이내로 간결하게
- 내용의 핵심을 담아야 합니다
- 한국어 내용이면 한국어로, 영어 내용이면 영어로 제목 작성

내용:
${truncatedContent}

제목:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 50,
            topP: 0.9,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API error:', response.status, errorText);
      return c.json({ error: 'Failed to generate title' }, 500);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const generatedTitle = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!generatedTitle) {
      return c.json({ error: 'No title generated' }, 500);
    }

    // Clean up the title (remove quotes if present)
    const cleanTitle = generatedTitle
      .replace(/^["']|["']$/g, '')
      .replace(/^제목:\s*/i, '')
      .trim();

    return c.json({ title: cleanTitle });
  } catch (error) {
    console.error('[Gemini] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
