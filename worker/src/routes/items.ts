import { Hono } from 'hono';
import type { Env } from '../index';
import { parseOgMetadata } from './og';

export const itemsRoutes = new Hono<{ Bindings: Env }>();

// Get all items with their tags
itemsRoutes.get('/', async (c) => {
  const type = c.req.query('type');
  const tagId = c.req.query('tagId');
  const encrypted = c.req.query('encrypted'); // Filter encrypted items
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
    
    // Filter by encrypted status
    if (encrypted === 'true') {
      conditions.push('i.is_encrypted = 1');
    } else if (encrypted === 'false') {
      conditions.push('i.is_encrypted = 0');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' GROUP BY i.id ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    
    // Transform results
    const items = results.map((row: any) => {
      const isEncrypted = row.is_encrypted === 1;
      return {
        id: row.id,
        type: row.type,
        // Hide content for encrypted items
        content: isEncrypted ? '' : row.content,
        // Hide fileKey for encrypted items
        fileKey: isEncrypted ? undefined : row.file_key,
        fileName: row.file_name,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        title: row.title,
        ogImage: isEncrypted ? undefined : row.og_image,
        ogTitle: row.og_title,
        ogDescription: isEncrypted ? undefined : row.og_description,
        tags: row.tag_ids ? row.tag_ids.split(',') : [],
        isFavorite: row.is_favorite === 1,
        isEncrypted,
        createdAt: row.created_at,
      };
    });

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

    const isEncrypted = item.is_encrypted === 1;
    return c.json({
      id: item.id,
      type: item.type,
      // Hide content for encrypted items
      content: isEncrypted ? '' : item.content,
      // Hide fileKey for encrypted items
      fileKey: isEncrypted ? undefined : item.file_key,
      fileName: item.file_name,
      fileSize: item.file_size,
      mimeType: item.mime_type,
      title: item.title,
      ogImage: isEncrypted ? undefined : item.og_image,
      ogTitle: item.og_title,
      ogDescription: isEncrypted ? undefined : item.og_description,
      tags: item.tag_ids ? (item.tag_ids as string).split(',') : [],
      isFavorite: item.is_favorite === 1,
      isEncrypted,
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
    const { type, content, fileKey, fileName, fileSize, mimeType, title, tags, isEncrypted, encryptionHash } = body;

    // Title is required for encrypted items
    if (isEncrypted && !title) {
      return c.json({ error: '암호화된 아이템은 제목이 필수입니다.' }, 400);
    }

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
      INSERT INTO items (id, type, content, file_key, file_name, file_size, mime_type, title, og_image, og_title, og_description, is_encrypted, encryption_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      isEncrypted ? 1 : 0,
      encryptionHash || null,
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
      content: isEncrypted ? '' : (content || ''), 
      fileKey: isEncrypted ? undefined : fileKey, 
      fileName, 
      fileSize, 
      mimeType, 
      title, 
      ogImage: isEncrypted ? undefined : ogImage,
      ogTitle,
      ogDescription: isEncrypted ? undefined : ogDescription,
      tags: tags || [], 
      isFavorite: false,
      isEncrypted: !!isEncrypted,
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
    const { content, title, tags, isFavorite, isEncrypted, encryptionHash } = body;

    // 암호화 해제 시 기존 비밀번호 검증
    if (isEncrypted === false) {
      const existingItem = await c.env.DB.prepare('SELECT is_encrypted, encryption_hash FROM items WHERE id = ?').bind(id).first();
      if (existingItem?.is_encrypted === 1) {
        // 암호화된 아이템을 해제하려면 기존 비밀번호가 필요
        if (!encryptionHash) {
          return c.json({ error: '암호화 해제에는 기존 비밀번호가 필요합니다.' }, 400);
        }
        if (existingItem.encryption_hash !== encryptionHash) {
          return c.json({ error: '비밀번호가 올바르지 않습니다.' }, 401);
        }
      }
    }

    // Title is required for encrypted items
    if (isEncrypted && !title) {
      // Check if item already has a title
      const existingItem = await c.env.DB.prepare('SELECT title FROM items WHERE id = ?').bind(id).first();
      if (!existingItem?.title) {
        return c.json({ error: '암호화된 아이템은 제목이 필수입니다.' }, 400);
      }
    }

    // Only update content/title/isFavorite/encryption if they are provided
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
    if (isEncrypted !== undefined) {
      updates.push('is_encrypted = ?');
      params.push(isEncrypted ? 1 : 0);
    }
    if (isEncrypted !== undefined) {
      // 암호화 해제 시 해시도 null로 설정
      updates.push('encryption_hash = ?');
      params.push(isEncrypted ? encryptionHash : null);
    }
    
    if (updates.length > 0) {
      params.push(id);
      await c.env.DB.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();
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

// Verify encryption key for an item
itemsRoutes.post('/:id/verify', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { keyHash } = body;

    if (!keyHash) {
      return c.json({ error: '암호화 키가 필요합니다.' }, 400);
    }

    const item = await c.env.DB.prepare('SELECT encryption_hash FROM items WHERE id = ?').bind(id).first();

    if (!item) {
      return c.json({ error: 'Item not found' }, 404);
    }

    const isValid = item.encryption_hash === keyHash;
    return c.json({ valid: isValid });
  } catch (error) {
    console.error('Error verifying encryption key:', error);
    return c.json({ error: 'Failed to verify encryption key' }, 500);
  }
});

// Get decrypted content for an encrypted item (after key verification on client)
itemsRoutes.post('/:id/unlock', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { keyHash } = body;

    if (!keyHash) {
      return c.json({ error: '암호화 키가 필요합니다.' }, 400);
    }

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

    // Verify encryption key
    if (item.encryption_hash !== keyHash) {
      return c.json({ error: '암호화 키가 올바르지 않습니다.' }, 401);
    }

    // Return full item content
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
      isEncrypted: item.is_encrypted === 1,
      createdAt: item.created_at,
    });
  } catch (error) {
    console.error('Error unlocking item:', error);
    return c.json({ error: 'Failed to unlock item' }, 500);
  }
});
