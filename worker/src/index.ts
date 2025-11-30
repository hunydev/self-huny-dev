import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler';
import { itemsRoutes } from './routes/items';
import { tagsRoutes } from './routes/tags';
import { uploadRoutes } from './routes/upload';
import { shareRoutes } from './routes/share';

export interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  ENVIRONMENT: string;
  __STATIC_CONTENT: KVNamespace;
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

// Static file serving for Workers Sites using kv-asset-handler
app.get('*', async (c) => {
  try {
    const event = {
      request: c.req.raw,
      waitUntil: (promise: Promise<any>) => c.executionCtx.waitUntil(promise),
    };
    
    const options = {
      ASSET_NAMESPACE: c.env.__STATIC_CONTENT,
      ASSET_MANIFEST: (globalThis as any).__STATIC_CONTENT_MANIFEST,
    };

    const page = await getAssetFromKV(event as any, options);
    
    // Clone the response to modify headers
    const response = new Response(page.body, page);
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    
    return response;
  } catch (e) {
    if (e instanceof NotFoundError) {
      // SPA fallback: serve index.html for all non-asset routes
      try {
        const event = {
          request: new Request(new URL('/index.html', c.req.url).toString(), c.req.raw),
          waitUntil: (promise: Promise<any>) => c.executionCtx.waitUntil(promise),
        };
        
        const options = {
          ASSET_NAMESPACE: c.env.__STATIC_CONTENT,
          ASSET_MANIFEST: (globalThis as any).__STATIC_CONTENT_MANIFEST,
        };
        
        const page = await getAssetFromKV(event as any, options);
        return new Response(page.body, {
          ...page,
          headers: {
            ...Object.fromEntries(page.headers),
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      } catch {
        return c.text('Not Found', 404);
      }
    }
    console.error('Static file error:', e);
    return c.text('Internal Server Error', 500);
  }
});

export default app;
