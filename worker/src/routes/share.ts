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
    let allFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      title = formData.get('title') as string;
      text = formData.get('text') as string;
      url = formData.get('url') as string;
      
      // Collect ALL files from formData - Android may use different field names
      // Common field names: files, file, media, image, video, audio, attachment
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
      
      console.log('[API Share] FormData entries:', formDataEntries);
    } else if (contentType.includes('application/json')) {
      const body = await c.req.json();
      title = body.title;
      text = body.text;
      url = body.url;
    }

    // Handle file uploads first
    if (allFiles.length > 0) {
      const uploadedItems = [];
      
      console.log('[API Share] Processing files:', allFiles.length, 'valid files');

      for (const file of allFiles) {
        const sanitizedName = file.name?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'unnamed';
        const fileKey = `${crypto.randomUUID()}-${sanitizedName}`;
        
        console.log('[API Share] Processing file:', {
          name: file.name,
          size: file.size,
          type: file.type,
          fileKey
        });
        
        try {
          if (!file.size || file.size === 0) {
            console.error('[API Share] File size reported as 0, skipping');
            continue;
          }

          await c.env.R2_BUCKET.put(fileKey, file.stream(), {
            httpMetadata: {
              contentType: file.type || 'application/octet-stream',
            },
          });
          console.log('[API Share] File uploaded to R2');

          const type = file.type?.startsWith('image/') ? 'image' 
            : file.type?.startsWith('video/') ? 'video' 
            : 'file';

          const id = crypto.randomUUID();
          const now = Date.now();

          await c.env.DB.prepare(`
            INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id, type, '', fileKey, file.name?.trim() || 'unnamed', file.size, file.type || 'application/octet-stream', title || null, now).run();

          console.log('[API Share] DB record created, id:', id);

          uploadedItems.push({
            id,
            type,
            fileKey,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            createdAt: now,
          });
        } catch (fileError) {
          console.error('[API Share] Error processing file:', file.name, fileError);
        }
      }

      if (uploadedItems.length > 0) {
        return c.json({ success: true, items: uploadedItems }, 201);
      }
      // If no files were successfully uploaded, fall through to text/link handling
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
