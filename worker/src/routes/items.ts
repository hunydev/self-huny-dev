import { Hono } from 'hono';
import type { Env } from '../index';

export const itemsRoutes = new Hono<{ Bindings: Env }>();

// Get all items with their tags
itemsRoutes.get('/', async (c) => {
  const type = c.req.query('type');
  const tagId = c.req.query('tagId');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    let query = `
      SELECT 
        i.*,
        GROUP_CONCAT(it.tag_id) as tag_ids
      FROM items i
      LEFT JOIN item_tags it ON i.id = it.item_id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (type && type !== 'all') {
      conditions.push('i.type = ?');
      params.push(type);
    }

    if (tagId) {
      conditions.push('EXISTS (SELECT 1 FROM item_tags WHERE item_id = i.id AND tag_id = ?)');
      params.push(tagId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY i.id ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    
    // Transform results
    const items = results.map((row: any) => ({
      id: row.id,
      type: row.type,
      content: row.content,
      fileKey: row.file_key,
      fileName: row.file_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      title: row.title,
      tags: row.tag_ids ? row.tag_ids.split(',') : [],
      createdAt: row.created_at,
    }));

    return c.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    return c.json({ error: 'Failed to fetch items' }, 500);
  }
});

// Get single item
itemsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const item = await c.env.DB.prepare(`
      SELECT 
        i.*,
        GROUP_CONCAT(it.tag_id) as tag_ids
      FROM items i
      LEFT JOIN item_tags it ON i.id = it.item_id
      WHERE i.id = ?
      GROUP BY i.id
    `).bind(id).first();

    if (!item) {
      return c.json({ error: 'Item not found' }, 404);
    }

    return c.json({
      id: item.id,
      type: item.type,
      content: item.content,
      fileKey: item.file_key,
      fileName: item.file_name,
      fileSize: item.file_size,
      mimeType: item.mime_type,
      title: item.title,
      tags: item.tag_ids ? (item.tag_ids as string).split(',') : [],
      createdAt: item.created_at,
    });
  } catch (error) {
    console.error('Error fetching item:', error);
    return c.json({ error: 'Failed to fetch item' }, 500);
  }
});

// Create new item
itemsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { type, content, fileKey, fileName, fileSize, mimeType, title, tags } = body;

    const id = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, 
      type, 
      content || '', 
      fileKey || null, 
      fileName || null, 
      fileSize || null, 
      mimeType || null, 
      title || null, 
      now
    ).run();

    // Insert tags if provided
    if (tags && tags.length > 0) {
      const tagInserts = tags.map((tagId: string) => 
        c.env.DB.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)')
          .bind(id, tagId)
          .run()
      );
      await Promise.all(tagInserts);
    }

    return c.json({ 
      id, 
      type, 
      content: content || '', 
      fileKey, 
      fileName, 
      fileSize, 
      mimeType, 
      title, 
      tags: tags || [], 
      createdAt: now 
    }, 201);
  } catch (error) {
    console.error('Error creating item:', error);
    return c.json({ error: 'Failed to create item' }, 500);
  }
});

// Update item
itemsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { content, title, tags } = body;

    // Only update content/title if they are provided
    if (content !== undefined || title !== undefined) {
      const updates: string[] = [];
      const params: any[] = [];
      
      if (content !== undefined) {
        updates.push('content = ?');
        params.push(content || '');
      }
      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title || null);
      }
      
      if (updates.length > 0) {
        params.push(id);
        await c.env.DB.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`)
          .bind(...params)
          .run();
      }
    }

    // Update tags if provided
    if (tags !== undefined) {
      // Remove existing tags
      await c.env.DB.prepare('DELETE FROM item_tags WHERE item_id = ?').bind(id).run();
      
      // Add new tags
      if (tags.length > 0) {
        const tagInserts = tags.map((tagId: string) => 
          c.env.DB.prepare('INSERT INTO item_tags (item_id, tag_id) VALUES (?, ?)')
            .bind(id, tagId)
            .run()
        );
        await Promise.all(tagInserts);
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating item:', error);
    return c.json({ error: 'Failed to update item' }, 500);
  }
});

// Delete item
itemsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    // Get item to check for file
    const item = await c.env.DB.prepare('SELECT file_key FROM items WHERE id = ?').bind(id).first();
    
    if (item?.file_key) {
      // Delete file from R2
      await c.env.R2_BUCKET.delete(item.file_key as string);
    }

    // Delete item (item_tags will cascade)
    await c.env.DB.prepare('DELETE FROM items WHERE id = ?').bind(id).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    return c.json({ error: 'Failed to delete item' }, 500);
  }
});
