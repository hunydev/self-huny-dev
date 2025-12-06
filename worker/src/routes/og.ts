import { Hono } from 'hono';
import type { Env } from '../index';

export const ogRoutes = new Hono<{ Bindings: Env }>();

interface OgMetadata {
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
}

/**
 * Check if URL is a YouTube video and extract video ID
 */
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch YouTube metadata via oEmbed API
 */
async function fetchYouTubeMetadata(videoId: string): Promise<OgMetadata> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(oembedUrl, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      console.log('[OG Parser] YouTube oEmbed failed:', response.status);
      return {};
    }
    
    const data = await response.json() as { 
      title?: string; 
      thumbnail_url?: string; 
      author_name?: string;
    };
    
    return {
      ogTitle: data.title,
      ogImage: data.thumbnail_url,
      ogDescription: data.author_name ? `by ${data.author_name}` : undefined,
    };
  } catch (error) {
    console.error('[OG Parser] YouTube oEmbed error:', error);
    return {};
  }
}

/**
 * Check if URL is a Twitter/X post
 */
function getTwitterPostInfo(url: string): { username: string; postId: string } | null {
  const pattern = /(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/;
  const match = url.match(pattern);
  if (match) {
    return { username: match[1], postId: match[2] };
  }
  return null;
}

/**
 * Check if URL is a Vimeo video
 */
function getVimeoVideoId(url: string): string | null {
  const pattern = /vimeo\.com\/(?:video\/)?(\d+)/;
  const match = url.match(pattern);
  return match ? match[1] : null;
}

/**
 * Fetch Vimeo metadata via oEmbed API
 */
async function fetchVimeoMetadata(videoId: string): Promise<OgMetadata> {
  try {
    const oembedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`;
    const response = await fetch(oembedUrl, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return {};
    
    const data = await response.json() as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
      description?: string;
    };
    
    return {
      ogTitle: data.title,
      ogImage: data.thumbnail_url,
      ogDescription: data.description || (data.author_name ? `by ${data.author_name}` : undefined),
    };
  } catch (error) {
    console.error('[OG Parser] Vimeo oEmbed error:', error);
    return {};
  }
}

/**
 * Parse Open Graph metadata from a URL
 */
async function parseOgMetadata(url: string): Promise<OgMetadata> {
  // Try oEmbed for known platforms first (they often block regular scraping)
  const youtubeId = getYouTubeVideoId(url);
  if (youtubeId) {
    console.log('[OG Parser] Detected YouTube video:', youtubeId);
    const metadata = await fetchYouTubeMetadata(youtubeId);
    if (metadata.ogTitle || metadata.ogImage) {
      return metadata;
    }
  }
  
  const vimeoId = getVimeoVideoId(url);
  if (vimeoId) {
    console.log('[OG Parser] Detected Vimeo video:', vimeoId);
    const metadata = await fetchVimeoMetadata(vimeoId);
    if (metadata.ogTitle || metadata.ogImage) {
      return metadata;
    }
  }

  // For other URLs, try regular HTML scraping
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
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
    
    // Check if we got an empty or very small response (JS-rendered pages)
    if (html.length < 500) {
      console.log('[OG Parser] Response too small, likely JS-rendered page');
      return {};
    }
    
    return extractOgFromHtml(html, url);
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
function extractOgFromHtml(html: string, baseUrl?: string): OgMetadata {
  const result: OgMetadata = {};
  
  // Limit parsing to first 50KB to avoid performance issues
  const headSection = html.substring(0, 50000);
  
  // og:image
  let ogImage = extractMetaContent(headSection, 'og:image', 'property');
  if (ogImage) {
    // Convert relative URLs to absolute
    if (baseUrl && !ogImage.startsWith('http')) {
      try {
        ogImage = new URL(ogImage, baseUrl).href;
      } catch {}
    }
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
    let twitterImage = extractMetaContent(headSection, 'twitter:image', 'name')
      || extractMetaContent(headSection, 'twitter:image', 'property')
      || extractMetaContent(headSection, 'twitter:image:src', 'name');
    if (twitterImage) {
      // Convert relative URLs to absolute
      if (baseUrl && !twitterImage.startsWith('http')) {
        try {
          twitterImage = new URL(twitterImage, baseUrl).href;
        } catch {}
      }
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
  
  // Last resort: try to find any image in link tags (favicon, apple-touch-icon)
  if (!result.ogImage) {
    const linkImageMatch = headSection.match(/<link[^>]*rel=["'](?:image_src|apple-touch-icon)[^>]*href=["']([^"']+)["'][^>]*>/i)
      || headSection.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:image_src|apple-touch-icon)[^>]*>/i);
    if (linkImageMatch) {
      let linkImage = linkImageMatch[1];
      if (baseUrl && !linkImage.startsWith('http')) {
        try {
          linkImage = new URL(linkImage, baseUrl).href;
        } catch {}
      }
      result.ogImage = linkImage;
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
