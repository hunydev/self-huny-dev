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
  __STATIC_CONTENT: KVNamespace;
}

// Asset manifest for Workers Sites
declare const __STATIC_CONTENT_MANIFEST: string;

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

// Static file serving for Workers Sites
app.get('*', async (c) => {
  try {
    const url = new URL(c.req.url);
    let pathname = url.pathname;
    
    // Default to index.html for root
    if (pathname === '/') {
      pathname = '/index.html';
    }
    
    // Remove leading slash for manifest lookup
    const assetPath = pathname.slice(1);
    
    // Try to get asset from KV
    const manifest = typeof __STATIC_CONTENT_MANIFEST === 'string' 
      ? JSON.parse(__STATIC_CONTENT_MANIFEST) 
      : __STATIC_CONTENT_MANIFEST;
    
    const manifestKey = manifest[assetPath];
    const key = manifestKey || assetPath;
    
    const asset = await c.env.__STATIC_CONTENT.get(key, { type: 'arrayBuffer' });
    
    if (asset) {
      // Determine content type
      const contentType = getContentType(pathname);
      
      return new Response(asset, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': pathname.includes('.') && !pathname.endsWith('.html')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache',
        },
      });
    }
    
    // Fallback to index.html for SPA routing
    const indexKey = manifest['index.html'] || 'index.html';
    const indexAsset = await c.env.__STATIC_CONTENT.get(indexKey, { type: 'arrayBuffer' });
    
    if (indexAsset) {
      return new Response(indexAsset, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }
    
    return c.text('Not Found', 404);
  } catch (error) {
    console.error('Static file error:', error);
    return c.text('Internal Server Error', 500);
  }
});

function getContentType(pathname: string): string {
  const ext = pathname.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'pdf': 'application/pdf',
    'txt': 'text/plain; charset=utf-8',
  };
  return types[ext || ''] || 'application/octet-stream';
}

export default app;
