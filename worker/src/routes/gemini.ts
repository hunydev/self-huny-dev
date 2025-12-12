import { Hono } from 'hono';
import type { Env, Variables } from '../index';

export const geminiRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Gemini API endpoint for title suggestion
geminiRoutes.post('/suggest-title', async (c) => {
  try {
    const { content } = await c.req.json();
    
    if (!content || typeof content !== 'string') {
      return c.json({ error: 'Content is required' }, 400);
    }

    // Secrets Store에서 API 키 가져오기
    const apiKey = await c.env.GEMINI_API_KEY.get();
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

// Gemini API endpoint for parsing items from unstructured text
geminiRoutes.post('/parse-items', async (c) => {
  try {
    const { content } = await c.req.json();
    
    if (!content || typeof content !== 'string') {
      return c.json({ error: 'Content is required' }, 400);
    }

    // Secrets Store에서 API 키 가져오기
    const apiKey = await c.env.GEMINI_API_KEY.get();
    if (!apiKey) {
      return c.json({ error: 'Gemini API key not configured' }, 500);
    }

    // Truncate content if too long (keep first 10000 chars)
    const truncatedContent = content.length > 10000 
      ? content.substring(0, 10000) + '...' 
      : content;

    const prompt = `당신은 텍스트에서 개별 아이템을 추출하는 전문가입니다. 아래 입력에서 저장할 만한 개별 아이템들을 추출해주세요.

규칙:
1. 각 아이템은 독립적인 정보 단위입니다 (링크, 메모, 아이디어, 할일, 참고자료 등)
2. 아이템 타입: "text" (일반 텍스트/메모), "link" (URL이 포함된 경우)
3. 제목은 15자 이내로 핵심을 담아 생성
4. 내용은 원본을 최대한 보존
5. URL이 있으면 type을 "link"로 설정하고 content에 URL을 넣으세요

응답은 반드시 아래 JSON 형식으로만 출력하세요 (설명이나 마크다운 없이):
{
  "items": [
    {
      "type": "text" 또는 "link",
      "title": "아이템 제목",
      "content": "아이템 내용"
    }
  ]
}

입력:
${truncatedContent}

JSON:`;

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
            temperature: 0.3,
            maxOutputTokens: 4096,
            topP: 0.9,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API error:', response.status, errorText);
      return c.json({ error: 'Failed to parse items' }, 500);
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

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!generatedText) {
      return c.json({ error: 'No response generated' }, 500);
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonText = generatedText;
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    try {
      const parsed = JSON.parse(jsonText) as { items: Array<{ type: string; title: string; content: string }> };
      
      if (!parsed.items || !Array.isArray(parsed.items)) {
        return c.json({ error: 'Invalid response format' }, 500);
      }

      // Validate and clean items
      const items = parsed.items
        .filter(item => item.content && item.content.trim())
        .map(item => ({
          type: item.type === 'link' ? 'link' : 'text',
          title: (item.title || '').trim().slice(0, 100),
          content: item.content.trim(),
        }));

      return c.json({ items });
    } catch (parseError) {
      console.error('[Gemini] JSON parse error:', parseError, 'Raw text:', jsonText);
      return c.json({ error: 'Failed to parse AI response' }, 500);
    }
  } catch (error) {
    console.error('[Gemini] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Gemini API endpoint for formatting text with minimal formatting
geminiRoutes.post('/format-text', async (c) => {
  try {
    const { content } = await c.req.json();
    
    if (!content || typeof content !== 'string') {
      return c.json({ error: 'Content is required' }, 400);
    }

    // Secrets Store에서 API 키 가져오기
    const apiKey = await c.env.GEMINI_API_KEY.get();
    if (!apiKey) {
      return c.json({ error: 'Gemini API key not configured' }, 500);
    }

    // Truncate content if too long (keep first 5000 chars)
    const truncatedContent = content.length > 5000 
      ? content.substring(0, 5000) + '...' 
      : content;

    const prompt = `당신은 텍스트 서식 전문가입니다. 아래 텍스트를 읽기 쉽게 최소한의 HTML 서식을 적용해주세요.

규칙:
1. 원본 내용과 의미를 절대 변경하지 마세요
2. 적용 가능한 서식만 사용:
   - 목록이 있으면 <ul><li> 또는 <ol><li> 사용
   - 중요 키워드에 <strong> 또는 <em> 적용
   - 문단 구분이 필요하면 <p> 사용
   - 제목/섹션이 있으면 <h3> 또는 <h4> 사용
   - 코드가 있으면 <code> 사용
3. 과도한 서식은 피하세요 - 가독성 향상이 목적입니다
4. HTML 태그만 포함된 결과를 출력하세요 (설명이나 마크다운 없이)
5. 서식이 필요없는 단순 텍스트면 원본 그대로 출력

입력 텍스트:
${truncatedContent}

서식 적용된 HTML:`;

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
            temperature: 0.3,
            maxOutputTokens: 4096,
            topP: 0.9,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] API error:', response.status, errorText);
      return c.json({ error: 'Failed to format text' }, 500);
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

    let formatted = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!formatted) {
      return c.json({ error: 'No response generated' }, 500);
    }

    // Remove markdown code blocks if present
    if (formatted.startsWith('```html')) {
      formatted = formatted.slice(7);
    } else if (formatted.startsWith('```')) {
      formatted = formatted.slice(3);
    }
    if (formatted.endsWith('```')) {
      formatted = formatted.slice(0, -3);
    }
    formatted = formatted.trim();

    return c.json({ formatted });
  } catch (error) {
    console.error('[Gemini] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
