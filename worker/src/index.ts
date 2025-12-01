import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { itemsRoutes } from './routes/items';
import { tagsRoutes } from './routes/tags';
import { uploadRoutes } from './routes/upload';
import { shareRoutes } from './routes/share';

export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  ASSETS: Fetcher;
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

// PWA Share Target - handles POST from share intent
app.post('/share-target', async (c) => {
  console.log('[Share Target] Received request');
  
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch (parseError) {
    console.error('[Share Target] Failed to parse formData:', parseError);
    return c.redirect('/?shared=error&reason=parse_failed');
  }

  const title = formData.get('title') as string;
  const text = formData.get('text') as string;
  const url = formData.get('url') as string;
  const files = formData.getAll('files') as File[];

  console.log('[Share Target] Parsed data:', {
    title,
    text,
    url,
    filesCount: files?.length || 0,
    fileDetails: files?.map(f => ({ 
      name: f?.name, 
      size: f?.size, 
      type: f?.type,
      isFile: f instanceof File
    })) || []
  });

  // Handle file uploads first
  if (files && files.length > 0) {
    const validFiles = files.filter(f => f && f.size > 0);
    console.log('[Share Target] Valid files count:', validFiles.length);

    if (validFiles.length > 0) {
      const file = validFiles[0];
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_') || 'unnamed';
      const fileKey = `${crypto.randomUUID()}-${sanitizedName}`;
      
      console.log('[Share Target] Processing file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        fileKey
      });

      try {
        // Read file as ArrayBuffer first to ensure it's fully loaded
        const arrayBuffer = await file.arrayBuffer();
        console.log('[Share Target] File read into buffer, size:', arrayBuffer.byteLength);

        if (arrayBuffer.byteLength === 0) {
          console.error('[Share Target] File buffer is empty');
          throw new Error('File buffer is empty');
        }

        await c.env.R2_BUCKET.put(fileKey, arrayBuffer, {
          httpMetadata: {
            contentType: file.type || 'application/octet-stream',
          },
        });
        console.log('[Share Target] File uploaded to R2');

        const type = file.type?.startsWith('image/') ? 'image' 
          : file.type?.startsWith('video/') ? 'video' 
          : 'file';

        const id = crypto.randomUUID();
        const now = Date.now();

        await c.env.DB.prepare(`
          INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, type, '', fileKey, file.name?.trim() || 'unnamed', file.size, file.type || 'application/octet-stream', title || null, now).run();

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

export default app;
