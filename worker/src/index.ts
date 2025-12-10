import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { itemsRoutes } from './routes/items';
import { tagsRoutes } from './routes/tags';
import { uploadRoutes } from './routes/upload';
import { shareRoutes } from './routes/share';
import { ogRoutes, parseOgMetadata } from './routes/og';
import { geminiRoutes } from './routes/gemini';
import { uploadFileToR2 } from './utils/uploadFile';

export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  ASSETS: Fetcher;
  GEMINI_API_KEY: SecretsStoreSecret;
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API routes
app.route('/api/items', itemsRoutes);
app.route('/api/tags', tagsRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/share', shareRoutes);
app.route('/api/og', ogRoutes);
app.route('/api/gemini', geminiRoutes);

// PWA Share Target - handles POST from share intent
app.post('/share-target', async (c) => {
  console.log('[Share Target] Received request');
  console.log('[Share Target] Content-Type:', c.req.header('content-type'));
  
  let formData: FormData;
  try {
    // Use the raw request to parse formData instead of Hono's wrapper
    const rawRequest = c.req.raw;
    formData = await rawRequest.formData();
  } catch (parseError) {
    console.error('[Share Target] Failed to parse formData:', parseError);
    return c.redirect('/?shared=error&reason=parse_failed', 303);
  }

  const title = formData.get('title') as string;
  const text = formData.get('text') as string;
  const url = formData.get('url') as string;
  
  // Collect ALL files from formData - Android may use different field names
  // Common field names: files, file, media, image, video, audio, attachment
  const allFiles: File[] = [];
  const formDataEntries: { key: string; type: string; isFile: boolean; size: number | null }[] = [];
  
  // Iterate through all formData entries to find files
  for (const [key, value] of formData.entries()) {
    formDataEntries.push({ 
      key, 
      type: typeof value, 
      isFile: value instanceof File, 
      size: value instanceof File ? value.size : null 
    });
    if (value instanceof File && value.size > 0) {
      allFiles.push(value);
    }
  }

  console.log('[Share Target] Parsed data:', {
    title,
    text,
    url,
    formDataEntries,
    filesCount: allFiles.length,
    fileDetails: allFiles.map(f => ({ 
      name: f?.name, 
      size: f?.size, 
      type: f?.type
    }))
  });

  // Handle file uploads first
  if (allFiles.length > 0) {
    console.log('[Share Target] Valid files count:', allFiles.length);

    // Process first valid file
    const file = allFiles[0];
    if (file) {
      const originalName = typeof file.name === 'string' && file.name.trim().length > 0
        ? file.name.trim()
        : 'unnamed';
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileKey = `${crypto.randomUUID()}-${sanitizedName}`;
      
      console.log('[Share Target] Processing file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        fileKey
      });

      try {
        const { bytes, strategy } = await uploadFileToR2(
          c.env.R2_BUCKET,
          file,
          fileKey,
          '[Share Target]'
        );
        console.log('[Share Target] File uploaded to R2', { strategy, bytes });

        const type = file.type?.startsWith('image/') ? 'image' 
          : file.type?.startsWith('video/') ? 'video' 
          : 'file';

        const id = crypto.randomUUID();
        const now = Date.now();

        await c.env.DB.prepare(`
          INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, type, '', fileKey, originalName, file.size, file.type || 'application/octet-stream', title || null, now).run();

        console.log('[Share Target] DB record created, id:', id);
        return c.redirect('/?shared=success');
      } catch (error) {
        console.error('[Share Target] File upload failed:', error);
        // Do not expose internal error messages in the URL
        return c.redirect('/?shared=error&reason=upload_failed');
      }
    }
  }

  // Handle text/link share
  const content = url || text || title || '';
  const type = /^https?:\/\//i.test(content.trim()) ? 'link' : 'text';
  
  console.log('[Share Target] Processing as text/link:', { content, type });

  if (content) {
    try {
      const id = crypto.randomUUID();
      const now = Date.now();
      
      await c.env.DB.prepare(`
        INSERT INTO items (id, type, content, title, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, type, content, title || null, now).run();

      console.log('[Share Target] Text/link saved, id:', id);
      return c.redirect('/?shared=success');
    } catch (error) {
      console.error('[Share Target] Text/link save failed:', error);
      return c.redirect('/?shared=error');
    }
  }

  console.log('[Share Target] No content to save');
  return c.redirect('/');
});

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', time: new Date().toISOString() }));

// Static file serving using Workers Static Assets
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  
  // Try to fetch the requested asset
  let response = await c.env.ASSETS.fetch(c.req.raw);
  
  // If asset not found and it's a navigation request, serve index.html (SPA fallback)
  if (response.status === 404) {
    const indexRequest = new Request(new URL('/index.html', url).toString(), {
      method: 'GET',
      headers: c.req.raw.headers,
    });
    response = await c.env.ASSETS.fetch(indexRequest);
  }
  
  // Clone and add security headers
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('X-XSS-Protection', '1; mode=block');
  newResponse.headers.set('X-Content-Type-Options', 'nosniff');
  
  return newResponse;
});

// Export with custom fetch handler to intercept share-target before Hono
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle share-target directly, before Hono processes the request
    if (url.pathname === '/share-target' && request.method === 'POST') {
      return handleShareTarget(request, env);
    }
    
    // For all other requests, use Hono app
    return app.fetch(request, env, ctx);
  },
};

// Direct share-target handler (outside Hono to avoid body consumption issues)
async function handleShareTarget(request: Request, env: Env): Promise<Response> {
  console.log('[Share Target Direct] Received request');
  const contentType = request.headers.get('content-type') || '';
  const contentLength = request.headers.get('content-length');
  console.log('[Share Target Direct] Content-Type:', contentType);
  console.log('[Share Target Direct] Content-Length:', contentLength);
  
  // Read the raw body ONCE - this is the only read we'll do
  const rawBody = await request.arrayBuffer();
  console.log('[Share Target Direct] Raw body size:', rawBody.byteLength);
  
  // Try standard formData parsing first
  try {
    // Create a new Request with the raw body
    const freshRequest = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: rawBody,
    });
    
    const formData = await freshRequest.formData();
    console.log('[Share Target Direct] FormData parsed successfully');
    return await processFormData(formData, request.url, env);
  } catch (parseError) {
    console.error('[Share Target Direct] Standard formData parsing failed:', parseError);
  }
  
  // Fallback: try manual multipart parsing with the SAME rawBody
  try {
    console.log('[Share Target Direct] Trying manual multipart parsing...');
    const result = parseMultipartManually(rawBody, contentType);
    if (result && (result.file || result.text || result.url || result.title)) {
      console.log('[Share Target Direct] Manual parsing succeeded:', {
        hasFile: !!result.file,
        hasText: !!result.text,
        hasUrl: !!result.url,
        hasTitle: !!result.title,
      });
      return await processShareData(result, request.url, env);
    }
    console.log('[Share Target Direct] Manual parsing returned no useful data');
  } catch (manualError) {
    console.error('[Share Target Direct] Manual parsing also failed:', manualError);
  }
  
  return Response.redirect(new URL('/?shared=error&reason=parse_failed', request.url).toString(), 303);
}

// Process parsed formData - redirect to share choice page
async function processFormData(formData: FormData, requestUrl: string, env: Env): Promise<Response> {
  const title = formData.get('title') as string;
  const text = formData.get('text') as string;
  const urlParam = formData.get('url') as string;
  
  // Collect ALL files from formData
  const allFiles: File[] = [];
  const formDataEntries: { key: string; type: string; isFile: boolean; size: number | null }[] = [];
  
  for (const [key, value] of formData.entries()) {
    formDataEntries.push({ 
      key, 
      type: typeof value, 
      isFile: value instanceof File, 
      size: value instanceof File ? value.size : null 
    });
    if (value instanceof File && value.size > 0) {
      allFiles.push(value);
    }
  }

  console.log('[Share Target Direct] Parsed data:', {
    title,
    text,
    url: urlParam,
    formDataEntries,
    filesCount: allFiles.length,
  });

  // Handle file uploads - files go directly to storage (no choice for files)
  if (allFiles.length > 0) {
    const file = allFiles[0];
    const originalName = typeof file.name === 'string' && file.name.trim().length > 0
      ? file.name.trim()
      : 'unnamed';
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `${crypto.randomUUID()}-${sanitizedName}`;
    
    console.log('[Share Target Direct] Processing file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      fileKey
    });

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      await env.R2_BUCKET.put(fileKey, arrayBuffer, {
        httpMetadata: {
          contentType: file.type || 'application/octet-stream',
        },
      });
      
      console.log('[Share Target Direct] File uploaded to R2, bytes:', arrayBuffer.byteLength);

      const type = file.type?.startsWith('image/') ? 'image' 
        : file.type?.startsWith('video/') ? 'video' 
        : 'file';

      const id = crypto.randomUUID();
      const now = Date.now();

      await env.DB.prepare(`
        INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, type, '', fileKey, originalName, file.size, file.type || 'application/octet-stream', title || null, now).run();

      console.log('[Share Target Direct] DB record created, id:', id);
      return Response.redirect(new URL('/?shared=success', requestUrl).toString(), 303);
    } catch (error) {
      console.error('[Share Target Direct] File upload failed:', error);
      return Response.redirect(new URL('/?shared=error&reason=upload_failed', requestUrl).toString(), 303);
    }
  }

  // Handle text/link share - redirect to choice page with data
  const content = urlParam || text || title || '';
  
  console.log('[Share Target Direct] Processing as text/link:', { content });

  if (content) {
    // Encode the share data in URL params for the choice page
    const params = new URLSearchParams();
    params.set('share_mode', 'choice');
    params.set('share_content', content);
    if (title) params.set('share_title', title);
    
    return Response.redirect(new URL(`/?${params.toString()}`, requestUrl).toString(), 303);
  }

  console.log('[Share Target Direct] No content to save');
  return Response.redirect(new URL('/', requestUrl).toString(), 303);
}

// Manual multipart parser for edge cases
interface ParsedMultipart {
  title?: string;
  text?: string;
  url?: string;
  file?: { name: string; type: string; data: Uint8Array };
}

function parseMultipartManually(body: ArrayBuffer, contentType: string): ParsedMultipart | null {
  const boundaryMatch = contentType.match(/boundary=(.+?)(?:;|$)/);
  if (!boundaryMatch) {
    console.log('[Manual Parser] No boundary found in content-type');
    return null;
  }
  
  const boundary = boundaryMatch[1].trim();
  console.log('[Manual Parser] Boundary:', boundary);
  
  const bodyBytes = new Uint8Array(body);
  const boundaryBytes = new TextEncoder().encode('--' + boundary);
  const result: ParsedMultipart = {};
  
  // Find all boundary positions
  const boundaryPositions: number[] = [];
  for (let i = 0; i <= bodyBytes.length - boundaryBytes.length; i++) {
    let match = true;
    for (let j = 0; j < boundaryBytes.length; j++) {
      if (bodyBytes[i + j] !== boundaryBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      boundaryPositions.push(i);
    }
  }
  
  console.log('[Manual Parser] Found', boundaryPositions.length, 'boundary positions');
  
  // Parse each part
  for (let i = 0; i < boundaryPositions.length - 1; i++) {
    const partStart = boundaryPositions[i] + boundaryBytes.length;
    const partEnd = boundaryPositions[i + 1];
    
    // Skip \r\n after boundary
    let contentStart = partStart;
    if (bodyBytes[contentStart] === 0x0D && bodyBytes[contentStart + 1] === 0x0A) {
      contentStart += 2;
    }
    
    // Find header end (double CRLF)
    let headerEnd = -1;
    for (let j = contentStart; j < partEnd - 3; j++) {
      if (bodyBytes[j] === 0x0D && bodyBytes[j + 1] === 0x0A && 
          bodyBytes[j + 2] === 0x0D && bodyBytes[j + 3] === 0x0A) {
        headerEnd = j;
        break;
      }
    }
    
    if (headerEnd === -1) continue;
    
    const headerBytes = bodyBytes.slice(contentStart, headerEnd);
    const headers = new TextDecoder().decode(headerBytes);
    
    // Content starts after double CRLF
    const dataStart = headerEnd + 4;
    // Content ends before trailing CRLF before next boundary
    let dataEnd = partEnd;
    if (bodyBytes[dataEnd - 2] === 0x0D && bodyBytes[dataEnd - 1] === 0x0A) {
      dataEnd -= 2;
    }
    
    const nameMatch = headers.match(/name="([^"]+)"/);
    if (!nameMatch) continue;
    
    const name = nameMatch[1];
    const filenameMatch = headers.match(/filename="([^"]+)"/);
    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    
    if (filenameMatch) {
      // This is a file - extract binary data
      const filename = filenameMatch[1];
      const fileContentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
      const fileData = bodyBytes.slice(dataStart, dataEnd);
      
      console.log('[Manual Parser] Found file:', filename, 'size:', fileData.length, 'type:', fileContentType);
      
      result.file = {
        name: filename,
        type: fileContentType,
        data: fileData
      };
    } else {
      // Text field
      const textData = bodyBytes.slice(dataStart, dataEnd);
      const value = new TextDecoder().decode(textData).trim();
      
      console.log('[Manual Parser] Found field:', name, '=', value.substring(0, 100));
      
      if (name === 'title') result.title = value;
      else if (name === 'text') result.text = value;
      else if (name === 'url') result.url = value;
    }
  }
  
  return result;
}

// Process manually parsed data
async function processShareData(data: ParsedMultipart, requestUrl: string, env: Env): Promise<Response> {
  // Handle file if present
  if (data.file && data.file.data.byteLength > 0) {
    const originalName = data.file.name || 'unnamed';
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `${crypto.randomUUID()}-${sanitizedName}`;
    
    try {
      await env.R2_BUCKET.put(fileKey, data.file.data, {
        httpMetadata: {
          contentType: data.file.type,
        },
      });
      
      const type = data.file.type?.startsWith('image/') ? 'image' 
        : data.file.type?.startsWith('video/') ? 'video' 
        : 'file';

      const id = crypto.randomUUID();
      const now = Date.now();

      await env.DB.prepare(`
        INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, type, '', fileKey, originalName, data.file.data.byteLength, data.file.type, data.title || null, now).run();

      return Response.redirect(new URL('/?shared=success', requestUrl).toString(), 303);
    } catch (error) {
      console.error('[Share Target Direct] Manual file upload failed:', error);
      return Response.redirect(new URL('/?shared=error&reason=upload_failed', requestUrl).toString(), 303);
    }
  }

  // Handle text/link
  const content = data.url || data.text || data.title || '';
  if (content) {
    const type = /^https?:\/\//i.test(content.trim()) ? 'link' : 'text';
    const id = crypto.randomUUID();
    const now = Date.now();
    
    // Parse OG metadata for link items or text containing URLs
    let ogImage: string | null = null;
    let ogTitle: string | null = null;
    let ogDescription: string | null = null;
    
    let urlToParse: string | null = null;
    
    if (type === 'link') {
      urlToParse = content;
    } else if (type === 'text') {
      // Extract first URL from text content
      const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;
      const match = content.match(urlRegex);
      if (match && match.length > 0) {
        urlToParse = match[0].startsWith('www.') ? `https://${match[0]}` : match[0];
      }
    }
    
    if (urlToParse) {
      try {
        const ogData = await parseOgMetadata(urlToParse);
        ogImage = ogData.ogImage || null;
        ogTitle = ogData.ogTitle || null;
        ogDescription = ogData.ogDescription || null;
      } catch (ogError) {
        console.error('[Share Target Direct] Failed to parse OG metadata in processShareData:', ogError);
      }
    }
    
    await env.DB.prepare(`
      INSERT INTO items (id, type, content, title, og_image, og_title, og_description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, type, content, data.title || null, ogImage, ogTitle, ogDescription, now).run();

    return Response.redirect(new URL('/?shared=success', requestUrl).toString(), 303);
  }

  return Response.redirect(new URL('/', requestUrl).toString(), 303);
}
