import { Hono } from 'hono';
import type { Env } from '../index';

export const tagsRoutes = new Hono<{ Bindings: Env }>();

// Get all tags
tagsRoutes.get('/', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT t.*, COUNT(it.item_id) as item_count
      FROM tags t
      LEFT JOIN item_tags it ON t.id = it.tag_id
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all();

    const tags = results.map((row: any) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      itemCount: row.item_count,
      createdAt: row.created_at,
    }));

    return c.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return c.json({ error: 'Failed to fetch tags' }, 500);
  }
});

// Create new tag
tagsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { name, color } = body;

    if (!name || !name.trim()) {
      return c.json({ error: 'Tag name is required' }, 400);
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO tags (id, name, color, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(id, name.trim(), color || null, now).run();

    return c.json({ id, name: name.trim(), color, createdAt: now }, 201);
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Tag with this name already exists' }, 409);
    }
    console.error('Error creating tag:', error);
    return c.json({ error: 'Failed to create tag' }, 500);
  }
});

// Update tag
tagsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { name, color } = body;

    if (!name || !name.trim()) {
      return c.json({ error: 'Tag name is required' }, 400);
    }

    await c.env.DB.prepare(`
      UPDATE tags SET name = ?, color = ? WHERE id = ?
    `).bind(name.trim(), color || null, id).run();

    return c.json({ success: true });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Tag with this name already exists' }, 409);
    }
    console.error('Error updating tag:', error);
    return c.json({ error: 'Failed to update tag' }, 500);
  }
});

// Delete tag
tagsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    // Delete tag (item_tags will cascade)
    await c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return c.json({ error: 'Failed to delete tag' }, 500);
  }
});
