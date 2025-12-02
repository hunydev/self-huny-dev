import { Hono } from 'hono';
import type { Env } from '../index';

export const ogRoutes = new Hono<{ Bindings: Env }>();

interface OgMetadata {
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
}

/**
 * Parse Open Graph metadata from a URL
 */
async function parseOgMetadata(url: string): Promise<OgMetadata> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Self-App/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log('[OG Parser] Failed to fetch URL:', response.status);
      return {};
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      console.log('[OG Parser] Not an HTML page:', contentType);
      return {};
    }
    
    const html = await response.text();
    return extractOgFromHtml(html);
  } catch (error) {
    console.error('[OG Parser] Error fetching URL:', error);
    return {};
  }
}

/**
 * Extract content from a meta tag
 * Handles both single and double quotes, and various attribute orders
 */
function extractMetaContent(html: string, propertyName: string, attributeType: 'property' | 'name' = 'property'): string | null {
  // Create patterns that handle both quote types correctly
  // Pattern 1: property/name comes before content
  const pattern1 = new RegExp(
    `<meta[^>]*${attributeType}=["']${propertyName}["'][^>]*content=["']([^"]*(?:"[^']*)?|[^']*(?:'[^"]*)?)?["'][^>]*\\/?>`,
    'i'
  );
  // Pattern 2: content comes before property/name  
  const pattern2 = new RegExp(
    `<meta[^>]*content=["']([^"]*(?:"[^']*)?|[^']*(?:'[^"]*)?)?["'][^>]*${attributeType}=["']${propertyName}["'][^>]*\\/?>`,
    'i'
  );
  
  // Simpler patterns that match the same quote type for content
  const simplePattern1Double = new RegExp(
    `<meta[^>]*${attributeType}=["']${propertyName}["'][^>]*content="([^"]*)"`,
    'i'
  );
  const simplePattern1Single = new RegExp(
    `<meta[^>]*${attributeType}=["']${propertyName}["'][^>]*content='([^']*)'`,
    'i'
  );
  const simplePattern2Double = new RegExp(
    `<meta[^>]*content="([^"]*)"[^>]*${attributeType}=["']${propertyName}["']`,
    'i'
  );
  const simplePattern2Single = new RegExp(
    `<meta[^>]*content='([^']*)'[^>]*${attributeType}=["']${propertyName}["']`,
    'i'
  );
  
  // Try simple patterns first (more reliable)
  const match = html.match(simplePattern1Double)
    || html.match(simplePattern1Single)
    || html.match(simplePattern2Double)
    || html.match(simplePattern2Single)
    || html.match(pattern1)
    || html.match(pattern2);
    
  return match ? match[1] : null;
}

/**
 * Extract OG metadata from HTML string using regex
 */
function extractOgFromHtml(html: string): OgMetadata {
  const result: OgMetadata = {};
  
  // Limit parsing to first 50KB to avoid performance issues
  const headSection = html.substring(0, 50000);
  
  // og:image
  const ogImage = extractMetaContent(headSection, 'og:image', 'property');
  if (ogImage) {
    result.ogImage = ogImage;
  }
  
  // og:title
  const ogTitle = extractMetaContent(headSection, 'og:title', 'property');
  if (ogTitle) {
    result.ogTitle = decodeHtmlEntities(ogTitle);
  }
  
  // og:description
  const ogDesc = extractMetaContent(headSection, 'og:description', 'property');
  if (ogDesc) {
    result.ogDescription = decodeHtmlEntities(ogDesc);
  }
  
  // Fallback to regular meta tags if OG tags not found
  if (!result.ogTitle) {
    const titleMatch = headSection.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.ogTitle = decodeHtmlEntities(titleMatch[1].trim());
    }
  }
  
  if (!result.ogDescription) {
    const descContent = extractMetaContent(headSection, 'description', 'name');
    if (descContent) {
      result.ogDescription = decodeHtmlEntities(descContent);
    }
  }
  
  // Fallback to twitter:image if no og:image
  if (!result.ogImage) {
    const twitterImage = extractMetaContent(headSection, 'twitter:image', 'name')
      || extractMetaContent(headSection, 'twitter:image', 'property');
    if (twitterImage) {
      result.ogImage = twitterImage;
    }
  }
  
  // Fallback to twitter:title if no og:title
  if (!result.ogTitle) {
    const twitterTitle = extractMetaContent(headSection, 'twitter:title', 'name')
      || extractMetaContent(headSection, 'twitter:title', 'property');
    if (twitterTitle) {
      result.ogTitle = decodeHtmlEntities(twitterTitle);
    }
  }
  
  // Fallback to twitter:description if no og:description
  if (!result.ogDescription) {
    const twitterDesc = extractMetaContent(headSection, 'twitter:description', 'name')
      || extractMetaContent(headSection, 'twitter:description', 'property');
    if (twitterDesc) {
      result.ogDescription = decodeHtmlEntities(twitterDesc);
    }
  }
  
  console.log('[OG Parser] Extracted metadata:', {
    hasImage: !!result.ogImage,
    hasTitle: !!result.ogTitle,
    hasDesc: !!result.ogDescription,
    title: result.ogTitle?.substring(0, 50)
  });
  
  return result;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

// API endpoint to fetch OG metadata
ogRoutes.get('/', async (c) => {
  const url = c.req.query('url');
  
  if (!url) {
    return c.json({ error: 'URL parameter is required' }, 400);
  }
  
  // Validate URL format
  try {
    new URL(url);
  } catch {
    return c.json({ error: 'Invalid URL format' }, 400);
  }
  
  const metadata = await parseOgMetadata(url);
  return c.json(metadata);
});

// Export the parseOgMetadata function for internal use
export { parseOgMetadata };
