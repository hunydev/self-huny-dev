import { Hono } from 'hono';
import type { Env } from '../index';

export const shareRoutes = new Hono<{ Bindings: Env }>();

// Handle Web Share Target API (POST from share intent)
shareRoutes.post('/', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';
    
    let title: string | null = null;
    let text: string | null = null;
    let url: string | null = null;
    let files: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      title = formData.get('title') as string;
      text = formData.get('text') as string;
      url = formData.get('url') as string;
      files = formData.getAll('files') as File[];
    } else if (contentType.includes('application/json')) {
      const body = await c.req.json();
      title = body.title;
      text = body.text;
      url = body.url;
    }

    // Handle file uploads first
    if (files && files.length > 0) {
      const uploadedItems = [];

      for (const file of files) {
        const fileKey = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
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

        uploadedItems.push({
          id,
          type,
          fileKey,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          createdAt: now,
        });
      }

      return c.json({ success: true, items: uploadedItems }, 201);
    }

    // Handle text/link share
    const content = url || text || title || '';
    
    if (!content) {
      return c.json({ error: 'No content provided' }, 400);
    }

    const type = /^https?:\/\//i.test(content.trim()) ? 'link' : 'text';
    const id = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO items (id, type, content, title, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, type, content, title || null, now).run();

    return c.json({
      success: true,
      item: {
        id,
        type,
        content,
        title,
        tags: [],
        createdAt: now,
      },
    }, 201);
  } catch (error) {
    console.error('Error handling share:', error);
    return c.json({ error: 'Failed to process shared content' }, 500);
  }
});
