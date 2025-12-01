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
  const formData = await c.req.formData();
  const title = formData.get('title') as string;
  const text = formData.get('text') as string;
  const url = formData.get('url') as string;
  const files = formData.getAll('files') as File[];

  // Handle file uploads first
  if (files && files.length > 0) {
    const file = files[0];
    const fileKey = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    try {
      await c.env.R2_BUCKET.put(fileKey, file.stream(), {
        httpMetadata: {
          contentType: file.type,
        },
      });

      const type = file.type.startsWith('image/') ? 'image' 
        : file.type.startsWith('video/') ? 'video' 
        : 'file';

      const id = crypto.randomUUID();
      const now = Date.now();

      await c.env.DB.prepare(`
        INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, type, '', fileKey, file.name, file.size, file.type, title || null, now).run();

      return c.redirect('/?shared=success');
    } catch (error) {
      console.error('Share file upload failed:', error);
      return c.redirect('/?shared=error');
    }
  }

  // Handle text/link share
  const content = url || text || title || '';
  const type = /^https?:\/\//i.test(content.trim()) ? 'link' : 'text';
  
  if (content) {
    try {
      const id = crypto.randomUUID();
      const now = Date.now();
      
      await c.env.DB.prepare(`
        INSERT INTO items (id, type, content, title, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, type, content, title || null, now).run();

      return c.redirect('/?shared=success');
    } catch (error) {
      console.error('Share text/link failed:', error);
      return c.redirect('/?shared=error');
    }
  }

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
