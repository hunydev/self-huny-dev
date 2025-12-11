import { Hono } from 'hono';
import type { Env, Variables } from '../index';
import { authMiddleware } from '../middleware/auth';

export const uploadRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Upload file to R2 - requires authentication
uploadRoutes.post('/', authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Generate unique key with original filename
    const fileKey = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Upload to R2
    await c.env.R2_BUCKET.put(fileKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    return c.json({
      fileKey,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    }, 201);
  } catch (error) {
    console.error('Error uploading file:', error);
    return c.json({ error: 'Failed to upload file' }, 500);
  }
});

// Get file from R2 - public access (no auth required)
uploadRoutes.get('/:key', async (c) => {
  const key = c.req.param('key');

  try {
    const object = await c.env.R2_BUCKET.get(key);

    if (!object) {
      return c.json({ error: 'File not found' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache

    return new Response(object.body, {
      headers,
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return c.json({ error: 'Failed to fetch file' }, 500);
  }
});

// Delete file from R2
uploadRoutes.delete('/:key', async (c) => {
  const key = c.req.param('key');

  try {
    await c.env.R2_BUCKET.delete(key);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return c.json({ error: 'Failed to delete file' }, 500);
  }
});
