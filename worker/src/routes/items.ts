import { Hono } from 'hono';
import type { Env, Variables } from '../index';
import { parseOgMetadata } from './og';
import { getUser } from '../middleware/auth';

export const itemsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get user stats - MUST be before /:id route
itemsRoutes.get('/stats', async (c) => {
  try {
    const user = getUser(c);
    const userId = user.sub;

    // Get total items count for user
    const itemCountResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM items WHERE user_id = ?').bind(userId).first();
    const totalItems = (itemCountResult?.count as number) || 0;

    // Get total tags count for user
    const tagCountResult = await c.env.DB.prepare('SELECT COUNT(*) as count FROM tags WHERE user_id = ?').bind(userId).first();
    const totalTags = (tagCountResult?.count as number) || 0;

    // Get total file size for user
    const fileSizeResult = await c.env.DB.prepare('SELECT COALESCE(SUM(file_size), 0) as total FROM items WHERE file_size IS NOT NULL AND user_id = ?').bind(userId).first();
    const totalFileSize = (fileSizeResult?.total as number) || 0;

    return c.json({
      totalItems,
      totalTags,
      totalFileSize,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// Delete all data (items, tags, files) for current user - MUST be before /:id route
itemsRoutes.delete('/delete-all', async (c) => {
  try {
    const user = getUser(c);
    const userId = user.sub;

    // Get all file keys to delete from R2 for this user
    const { results: items } = await c.env.DB.prepare('SELECT file_key FROM items WHERE file_key IS NOT NULL AND user_id = ?').bind(userId).all();
    
    // Delete all files from R2
    for (const item of items || []) {
      if (item.file_key) {
        try {
          await c.env.R2_BUCKET.delete(item.file_key as string);
        } catch (err) {
          console.error('Failed to delete file from R2:', item.file_key, err);
        }
      }
    }

    // Delete all item_tags, items, and tags for this user
    await c.env.DB.prepare('DELETE FROM item_tags WHERE item_id IN (SELECT id FROM items WHERE user_id = ?)').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM items WHERE user_id = ?').bind(userId).run();
    await c.env.DB.prepare('DELETE FROM tags WHERE user_id = ?').bind(userId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting all data:', error);
    return c.json({ error: 'Failed to delete all data' }, 500);
  }
});

// Claim orphan items (items with user_id = NULL) created by PWA share target
// This assigns recent orphan items to the authenticated user
itemsRoutes.post('/claim-orphans', async (c) => {
  try {
    const user = getUser(c);
    const userId = user.sub;

    // Find orphan items created in the last 5 minutes
    // This window ensures we only claim items that were just shared
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    // Get orphan items to return in response
    const { results: orphanItems } = await c.env.DB.prepare(`
      SELECT id, type, file_name, created_at FROM items 
      WHERE user_id IS NULL AND created_at > ?
      ORDER BY created_at DESC
    `).bind(fiveMinutesAgo).all();
    
    if (orphanItems.length === 0) {
      return c.json({ success: true, claimed: 0 });
    }
    
    // Update orphan items to belong to this user
    const result = await c.env.DB.prepare(`
      UPDATE items SET user_id = ? 
      WHERE user_id IS NULL AND created_at > ?
    `).bind(userId, fiveMinutesAgo).run();
    
    console.log('[Claim Orphans] Claimed items:', result.meta.changes, 'for user:', userId);
    
    return c.json({ 
      success: true, 
      claimed: result.meta.changes || 0,
      items: orphanItems
    });
  } catch (error) {
    console.error('Error claiming orphan items:', error);
    return c.json({ error: 'Failed to claim orphan items' }, 500);
  }
});

// Get trash items - MUST be before /:id route
itemsRoutes.get('/trash', async (c) => {
  try {
    const user = getUser(c);
    const userId = user.sub;

    // Get items that are in trash (deleted_at is set)
    const { results } = await c.env.DB.prepare(`
      SELECT 
        i.*,
        GROUP_CONCAT(it.tag_id) as tag_ids
      FROM items i
      LEFT JOIN item_tags it ON i.id = it.item_id
      WHERE i.user_id = ? AND i.deleted_at IS NOT NULL
      GROUP BY i.id
      ORDER BY i.deleted_at DESC
    `).bind(userId).all();
    
    // Transform results
    const items = results.map((row: any) => {
      const isEncrypted = row.is_encrypted === 1;
      return {
        id: row.id,
        type: row.type,
        content: isEncrypted ? '' : row.content,
        htmlContent: isEncrypted ? undefined : row.html_content,
        fileKey: (isEncrypted || row.upload_status) ? undefined : row.file_key,
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
        isCode: row.is_code === 1,
        uploadStatus: row.upload_status || null,
        createdAt: row.created_at,
        deletedAt: row.deleted_at,
      };
    });

    return c.json(items);
  } catch (error) {
    console.error('Error fetching trash items:', error);
    return c.json({ error: 'Failed to fetch trash items' }, 500);
  }
});

// Empty trash - MUST be before /:id route
itemsRoutes.delete('/trash/empty', async (c) => {
  try {
    const user = getUser(c);
    const userId = user.sub;

    // Get all trash items with files
    const { results } = await c.env.DB.prepare(
      'SELECT id, file_key FROM items WHERE user_id = ? AND deleted_at IS NOT NULL'
    ).bind(userId).all();

    // Delete files from R2
    for (const item of results) {
      if (item.file_key) {
        await c.env.R2_BUCKET.delete(item.file_key as string);
      }
    }

    // Delete all trash items
    await c.env.DB.prepare('DELETE FROM items WHERE user_id = ? AND deleted_at IS NOT NULL').bind(userId).run();

    return c.json({ success: true, deleted: results.length });
  } catch (error) {
    console.error('Error emptying trash:', error);
    return c.json({ error: 'Failed to empty trash' }, 500);
  }
});

// Get all items with their tags
itemsRoutes.get('/', async (c) => {
  const type = c.req.query('type');
  const tagId = c.req.query('tagId');
  const encrypted = c.req.query('encrypted'); // Filter encrypted items
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    const user = getUser(c);
    const userId = user.sub;

    let query = `
      SELECT 
        i.*,
        GROUP_CONCAT(it.tag_id) as tag_ids
      FROM items i
      LEFT JOIN item_tags it ON i.id = it.item_id
    `;
    const params: any[] = [];
    const conditions: string[] = ['i.user_id = ?', 'i.deleted_at IS NULL'];
    params.push(userId);

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

    query += ' WHERE ' + conditions.join(' AND ');

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
        htmlContent: isEncrypted ? undefined : row.html_content,
        // Hide fileKey for encrypted items (also hide if upload is in progress)
        fileKey: (isEncrypted || row.upload_status) ? undefined : row.file_key,
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
        isCode: row.is_code === 1,
        uploadStatus: row.upload_status || null,
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
    const user = getUser(c);
    const userId = user.sub;

    const item = await c.env.DB.prepare(`
      SELECT 
        i.*,
        GROUP_CONCAT(it.tag_id) as tag_ids
      FROM items i
      LEFT JOIN item_tags it ON i.id = it.item_id
      WHERE i.id = ? AND i.user_id = ?
      GROUP BY i.id
    `).bind(id, userId).first();

    if (!item) {
      return c.json({ error: 'Item not found' }, 404);
    }

    const isEncrypted = item.is_encrypted === 1;
    return c.json({
      id: item.id,
      type: item.type,
      // Hide content for encrypted items
      content: isEncrypted ? '' : item.content,
      htmlContent: isEncrypted ? undefined : item.html_content,
      // Hide fileKey for encrypted items (also hide if upload is in progress)
      fileKey: (isEncrypted || item.upload_status) ? undefined : item.file_key,
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
      isCode: item.is_code === 1,
      uploadStatus: item.upload_status || null,
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
    const user = getUser(c);
    const userId = user.sub;

    const body = await c.req.json();
    const { type, content, htmlContent, fileKey, fileName, fileSize, mimeType, title, tags, isEncrypted, encryptionHash, isCode } = body;

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
      INSERT INTO items (id, type, content, html_content, file_key, file_name, file_size, mime_type, title, og_image, og_title, og_description, is_encrypted, encryption_hash, is_code, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, 
      type, 
      content || '', 
      htmlContent || null,
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
      isCode ? 1 : 0,
      userId,
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
      htmlContent: isEncrypted ? undefined : (htmlContent || null),
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
      isCode: !!isCode,
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
    const user = getUser(c);
    const userId = user.sub;

    const body = await c.req.json();
    const { content, htmlContent, title, tags, isFavorite, isEncrypted, encryptionHash, isCode } = body;

    // 암호화 해제 시 기존 비밀번호 검증
    if (isEncrypted === false) {
      const existingItem = await c.env.DB.prepare('SELECT is_encrypted, encryption_hash FROM items WHERE id = ? AND user_id = ?').bind(id, userId).first();
      if (!existingItem) {
        return c.json({ error: 'Item not found' }, 404);
      }
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
      const existingItem = await c.env.DB.prepare('SELECT title FROM items WHERE id = ? AND user_id = ?').bind(id, userId).first();
      if (!existingItem) {
        return c.json({ error: 'Item not found' }, 404);
      }
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
    if (htmlContent !== undefined) {
      updates.push('html_content = ?');
      params.push(htmlContent || null);
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
    if (isCode !== undefined) {
      updates.push('is_code = ?');
      params.push(isCode ? 1 : 0);
    }
    
    if (updates.length > 0) {
      params.push(id, userId);
      await c.env.DB.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
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

// Delete item (soft delete - move to trash)
itemsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const user = getUser(c);
    const userId = user.sub;

    // Check if item exists and belongs to user
    const item = await c.env.DB.prepare('SELECT id FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NULL').bind(id, userId).first();
    
    if (!item) {
      return c.json({ error: 'Item not found' }, 404);
    }

    // Soft delete - set deleted_at timestamp
    const deletedAt = Date.now();
    await c.env.DB.prepare('UPDATE items SET deleted_at = ? WHERE id = ? AND user_id = ?').bind(deletedAt, id, userId).run();

    return c.json({ success: true, deletedAt });
  } catch (error) {
    console.error('Error deleting item:', error);
    return c.json({ error: 'Failed to delete item' }, 500);
  }
});

// Restore item from trash
itemsRoutes.post('/:id/restore', async (c) => {
  const id = c.req.param('id');

  try {
    const user = getUser(c);
    const userId = user.sub;

    // Check if item exists in trash
    const item = await c.env.DB.prepare('SELECT id FROM items WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL').bind(id, userId).first();
    
    if (!item) {
      return c.json({ error: 'Item not found in trash' }, 404);
    }

    // Restore item
    await c.env.DB.prepare('UPDATE items SET deleted_at = NULL WHERE id = ? AND user_id = ?').bind(id, userId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error restoring item:', error);
    return c.json({ error: 'Failed to restore item' }, 500);
  }
});

// Permanently delete item
itemsRoutes.delete('/:id/permanent', async (c) => {
  const id = c.req.param('id');

  try {
    const user = getUser(c);
    const userId = user.sub;

    // Get item to check for file (and verify ownership)
    const item = await c.env.DB.prepare('SELECT file_key FROM items WHERE id = ? AND user_id = ?').bind(id, userId).first();
    
    if (!item) {
      return c.json({ error: 'Item not found' }, 404);
    }

    if (item?.file_key) {
      // Delete file from R2
      await c.env.R2_BUCKET.delete(item.file_key as string);
    }

    // Permanently delete item (item_tags will cascade)
    await c.env.DB.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').bind(id, userId).run();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error permanently deleting item:', error);
    return c.json({ error: 'Failed to permanently delete item' }, 500);
  }
});

// Verify encryption key for an item
itemsRoutes.post('/:id/verify', async (c) => {
  const id = c.req.param('id');

  try {
    const user = getUser(c);
    const userId = user.sub;

    const body = await c.req.json();
    const { keyHash } = body;

    if (!keyHash) {
      return c.json({ error: '암호화 키가 필요합니다.' }, 400);
    }

    const item = await c.env.DB.prepare('SELECT encryption_hash FROM items WHERE id = ? AND user_id = ?').bind(id, userId).first();

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
    const user = getUser(c);
    const userId = user.sub;

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
      WHERE i.id = ? AND i.user_id = ?
      GROUP BY i.id
    `).bind(id, userId).first();

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
