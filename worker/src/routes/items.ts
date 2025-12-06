import { Hono } from 'hono';
import type { Env } from '../index';
import { parseOgMetadata } from './og';

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
      ogImage: row.og_image,
      ogTitle: row.og_title,
      ogDescription: row.og_description,
      tags: row.tag_ids ? row.tag_ids.split(',') : [],
      isFavorite: row.is_favorite === 1,
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
      ogImage: item.og_image,
      ogTitle: item.og_title,
      ogDescription: item.og_description,
      tags: item.tag_ids ? (item.tag_ids as string).split(',') : [],
      isFavorite: item.is_favorite === 1,
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

    // Parse OG metadata for link items or text items containing URLs
    let ogImage: string | null = null;
    let ogTitle: string | null = null;
    let ogDescription: string | null = null;

    if (content) {
      let urlToParse: string | null = null;
      
      if (type === 'link') {
        // For link type, use the content directly
        urlToParse = content;
      } else if (type === 'text') {
        // For text type, extract the first URL from the content
        const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;
        const match = content.match(urlRegex);
        if (match && match.length > 0) {
          urlToParse = match[0].startsWith('www.') ? `https://${match[0]}` : match[0];
          console.log('[Items] Found URL in text content:', urlToParse);
        }
      }
      
      if (urlToParse) {
        try {
          const ogData = await parseOgMetadata(urlToParse);
          ogImage = ogData.ogImage || null;
          ogTitle = ogData.ogTitle || null;
          ogDescription = ogData.ogDescription || null;
          console.log('[Items] OG metadata parsed:', { ogImage: !!ogImage, ogTitle, ogDescription: !!ogDescription });
        } catch (error) {
          console.error('[Items] Failed to parse OG metadata:', error);
          // Continue without OG data
        }
      }
    }

    await c.env.DB.prepare(`
      INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, og_image, og_title, og_description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, 
      type, 
      content || '', 
      fileKey || null, 
      fileName || null, 
      fileSize || null, 
      mimeType || null, 
      title || null, 
      ogImage,
      ogTitle,
      ogDescription,
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
      ogImage,
      ogTitle,
      ogDescription,
      tags: tags || [], 
      isFavorite: false,
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
    const { content, title, tags, isFavorite } = body;

    // Only update content/title/isFavorite if they are provided
    if (content !== undefined || title !== undefined || isFavorite !== undefined) {
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
      if (isFavorite !== undefined) {
        updates.push('is_favorite = ?');
        params.push(isFavorite ? 1 : 0);
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
