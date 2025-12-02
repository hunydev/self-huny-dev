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
 * Extract OG metadata from HTML string using regex
 */
function extractOgFromHtml(html: string): OgMetadata {
  const result: OgMetadata = {};
  
  // Limit parsing to first 50KB to avoid performance issues
  const headSection = html.substring(0, 50000);
  
  // og:image - try multiple patterns
  const ogImageMatch = headSection.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i)
    || headSection.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*\/?>/i);
  if (ogImageMatch) {
    result.ogImage = ogImageMatch[1];
  }
  
  // og:title
  const ogTitleMatch = headSection.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i)
    || headSection.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*\/?>/i);
  if (ogTitleMatch) {
    result.ogTitle = decodeHtmlEntities(ogTitleMatch[1]);
  }
  
  // og:description
  const ogDescMatch = headSection.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i)
    || headSection.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*\/?>/i);
  if (ogDescMatch) {
    result.ogDescription = decodeHtmlEntities(ogDescMatch[1]);
  }
  
  // Fallback to regular meta tags if OG tags not found
  if (!result.ogTitle) {
    const titleMatch = headSection.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      result.ogTitle = decodeHtmlEntities(titleMatch[1].trim());
    }
  }
  
  if (!result.ogDescription) {
    const descMatch = headSection.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i)
      || headSection.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*\/?>/i);
    if (descMatch) {
      result.ogDescription = decodeHtmlEntities(descMatch[1]);
    }
  }
  
  // Fallback to twitter:image if no og:image
  if (!result.ogImage) {
    const twitterImageMatch = headSection.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*\/?>/i)
      || headSection.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["'][^>]*\/?>/i);
    if (twitterImageMatch) {
      result.ogImage = twitterImageMatch[1];
    }
  }
  
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
