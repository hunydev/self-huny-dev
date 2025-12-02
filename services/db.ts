import { Item, ItemType, Tag } from '../types';

const API_BASE = '/api';

interface ApiItem {
  id: string;
  type: string;
  content: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  title?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  tags: string[];
  createdAt: number;
}

interface ApiTag {
  id: string;
  name: string;
  color?: string;
}

interface UploadResult {
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// Transform API response to frontend Item format
const transformItem = (apiItem: ApiItem): Item => ({
  id: apiItem.id,
  type: apiItem.type as ItemType,
  content: apiItem.content,
  fileKey: apiItem.fileKey,
  fileName: apiItem.fileName,
  fileSize: apiItem.fileSize,
  mimeType: apiItem.mimeType,
  title: apiItem.title,
  ogImage: apiItem.ogImage,
  ogTitle: apiItem.ogTitle,
  ogDescription: apiItem.ogDescription,
  tags: apiItem.tags || [],
  createdAt: apiItem.createdAt,
});

// Transform API response to frontend Tag format
const transformTag = (apiTag: ApiTag): Tag => ({
  id: apiTag.id,
  name: apiTag.name,
  color: apiTag.color,
});

// Get all items
export const getItems = async (type?: ItemType | 'all'): Promise<Item[]> => {
  const params = new URLSearchParams();
  if (type && type !== 'all') {
    params.set('type', type);
  }

  const url = `${API_BASE}/items${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch items');
  }
  
  const data: ApiItem[] = await response.json();
  return data.map(transformItem);
};

// Save item
export const saveItem = async (item: Omit<Item, 'id' | 'createdAt'>): Promise<Item> => {
  let fileKey: string | undefined;
  let fileName: string | undefined;
  let fileSize: number | undefined;
  let mimeType: string | undefined;

  // Upload file first if exists
  if (item.fileBlob) {
    const formData = new FormData();
    formData.append('file', item.fileBlob, item.fileName || 'file');
    
    const uploadResponse = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file');
    }

    const uploadResult: UploadResult = await uploadResponse.json();
    fileKey = uploadResult.fileKey;
    fileName = uploadResult.fileName;
    fileSize = uploadResult.fileSize;
    mimeType = uploadResult.mimeType;
  }

  // Create item
  const response = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: item.type,
      content: item.content,
      fileKey: fileKey || item.fileKey,
      fileName: fileName || item.fileName,
      fileSize: fileSize || item.fileSize,
      mimeType: mimeType || item.mimeType,
      title: item.title,
      tags: item.tags,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save item');
  }

  const data: ApiItem = await response.json();
  return transformItem(data);
};

// Delete item
export const deleteItem = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete item');
  }
};

// Get all tags
export const getTags = async (): Promise<Tag[]> => {
  const response = await fetch(`${API_BASE}/tags`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch tags');
  }
  
  const data: ApiTag[] = await response.json();
  return data.map(transformTag);
};

// Save tag
export const saveTag = async (tag: Tag): Promise<Tag> => {
  const response = await fetch(`${API_BASE}/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: tag.name,
      color: tag.color,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save tag');
  }

  const data: ApiTag = await response.json();
  return transformTag(data);
};

// Delete tag
export const deleteTag = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/tags/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete tag');
  }
};

// Update item tags
export const updateItemTags = async (itemId: string, tagIds: string[]): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tags: tagIds,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update item tags');
  }
};

// Get file URL
export const getFileUrl = (fileKey: string): string => {
  return `${API_BASE}/upload/${fileKey}`;
};
