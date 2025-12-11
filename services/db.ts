import { Item, ItemType, Tag } from '../types';

const API_BASE = '/api';

interface ApiItem {
  id: string;
  type: string;
  content: string;
  htmlContent?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  title?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  tags: string[];
  isFavorite: boolean;
  isEncrypted: boolean;
  isCode?: boolean;
  reminderAt?: number;
  uploadStatus?: 'uploading' | 'failed' | null;
  createdAt: number;
}

interface ApiTag {
  id: string;
  name: string;
  color?: string;
  autoKeywords?: string[];
}

interface UploadResult {
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Create headers with Authorization
const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Transform API response to frontend Item format
const transformItem = (apiItem: ApiItem): Item => ({
  id: apiItem.id,
  type: apiItem.type as ItemType,
  content: apiItem.content,
  htmlContent: apiItem.htmlContent,
  fileKey: apiItem.fileKey,
  fileName: apiItem.fileName,
  fileSize: apiItem.fileSize,
  mimeType: apiItem.mimeType,
  title: apiItem.title,
  ogImage: apiItem.ogImage,
  ogTitle: apiItem.ogTitle,
  ogDescription: apiItem.ogDescription,
  tags: apiItem.tags || [],
  isFavorite: apiItem.isFavorite || false,
  isEncrypted: apiItem.isEncrypted || false,
  isCode: apiItem.isCode || false,
  reminderAt: apiItem.reminderAt,
  uploadStatus: apiItem.uploadStatus,
  createdAt: apiItem.createdAt,
});

// Transform API response to frontend Tag format
const transformTag = (apiTag: ApiTag): Tag => ({
  id: apiTag.id,
  name: apiTag.name,
  color: apiTag.color,
  autoKeywords: apiTag.autoKeywords || [],
});

// Hash encryption key using SHA-256
export const hashEncryptionKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Get all items
export const getItems = async (type?: ItemType | 'all', encrypted?: boolean): Promise<Item[]> => {
  const params = new URLSearchParams();
  if (type && type !== 'all') {
    params.set('type', type);
  }
  if (encrypted !== undefined) {
    params.set('encrypted', encrypted.toString());
  }

  const url = `${API_BASE}/items${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch items');
  }
  
  const data: ApiItem[] = await response.json();
  return data.map(transformItem);
};

// Get single item by ID
export const getItem = async (id: string): Promise<Item> => {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch item');
  }
  
  const data: ApiItem = await response.json();
  return transformItem(data);
};

// Upload progress callback type
export type UploadProgressCallback = (progress: number) => void;

// Upload file with progress tracking using XMLHttpRequest
const uploadFileWithProgress = (
  file: Blob, 
  fileName: string, 
  onProgress?: UploadProgressCallback,
  abortController?: AbortController
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file, fileName);

    const xhr = new XMLHttpRequest();
    
    // Handle abort signal
    if (abortController) {
      abortController.signal.addEventListener('abort', () => {
        xhr.abort();
      });
      
      // Check if already aborted
      if (abortController.signal.aborted) {
        reject(new Error('Upload cancelled'));
        return;
      }
    }
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          resolve(result);
        } catch {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('POST', `${API_BASE}/upload`);
    
    // Add Authorization header
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    
    xhr.send(formData);
  });
};

// Save item with optional progress tracking and encryption
export const saveItem = async (
  item: Omit<Item, 'id' | 'createdAt'> & { encryptionKey?: string },
  onProgress?: UploadProgressCallback,
  abortController?: AbortController
): Promise<Item> => {
  let fileKey: string | undefined;
  let fileName: string | undefined;
  let fileSize: number | undefined;
  let mimeType: string | undefined;

  // Upload file first if exists
  if (item.fileBlob) {
    const uploadResult = await uploadFileWithProgress(
      item.fileBlob,
      item.fileName || 'file',
      onProgress,
      abortController
    );
    
    fileKey = uploadResult.fileKey;
    fileName = uploadResult.fileName;
    fileSize = uploadResult.fileSize;
    mimeType = uploadResult.mimeType;
  }

  // Generate encryption hash if encryption is enabled
  let encryptionHash: string | undefined;
  if (item.isEncrypted && item.encryptionKey) {
    encryptionHash = await hashEncryptionKey(item.encryptionKey);
  }

  // Create item
  const response = await fetch(`${API_BASE}/items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      type: item.type,
      content: item.content,
      htmlContent: item.htmlContent,
      fileKey: fileKey || item.fileKey,
      fileName: fileName || item.fileName,
      fileSize: fileSize || item.fileSize,
      mimeType: mimeType || item.mimeType,
      title: item.title,
      tags: item.tags,
      isEncrypted: item.isEncrypted,
      isCode: item.isCode,
      reminderAt: item.reminderAt,
      encryptionHash,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to save item' })) as { error?: string };
    throw new Error(errorData.error || 'Failed to save item');
  }

  const data: ApiItem = await response.json();
  return transformItem(data);
};

// Delete item
export const deleteItem = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete item');
  }
};

// Get all tags
export const getTags = async (): Promise<Tag[]> => {
  const response = await fetch(`${API_BASE}/tags`, {
    headers: getAuthHeaders(),
  });
  
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
    headers: getAuthHeaders(),
    body: JSON.stringify({
      name: tag.name,
      color: tag.color,
      autoKeywords: tag.autoKeywords || [],
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save tag');
  }

  const data: ApiTag = await response.json();
  return transformTag(data);
};

// Update tag
export const updateTag = async (tag: Tag): Promise<Tag> => {
  const response = await fetch(`${API_BASE}/tags/${tag.id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      name: tag.name,
      color: tag.color,
      autoKeywords: tag.autoKeywords || [],
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update tag');
  }

  return tag;
};

// Delete tag
export const deleteTag = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/tags/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete tag');
  }
};

// Update item tags
export const updateItemTags = async (itemId: string, tagIds: string[]): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      tags: tagIds,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update item tags');
  }
};

// Toggle item favorite status
export const toggleFavorite = async (itemId: string, isFavorite: boolean): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      isFavorite,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle favorite');
  }
};

// Get file URL
export const getFileUrl = (fileKey: string): string => {
  return `${API_BASE}/upload/${fileKey}`;
};

// Verify encryption key for an item
export const verifyEncryptionKey = async (itemId: string, key: string): Promise<boolean> => {
  const keyHash = await hashEncryptionKey(key);
  
  const response = await fetch(`${API_BASE}/items/${itemId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ keyHash }),
  });

  if (!response.ok) {
    throw new Error('Failed to verify encryption key');
  }

  const data = await response.json() as { valid: boolean };
  return data.valid;
};

// Unlock encrypted item and get full content
export const unlockItem = async (itemId: string, key: string): Promise<Item> => {
  const keyHash = await hashEncryptionKey(key);
  
  const response = await fetch(`${API_BASE}/items/${itemId}/unlock`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ keyHash }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to unlock item' })) as { error?: string };
    throw new Error(errorData.error || 'Failed to unlock item');
  }

  const data: ApiItem = await response.json();
  return transformItem(data);
};

// Toggle item encryption status
export const toggleEncryption = async (
  itemId: string, 
  isEncrypted: boolean, 
  key: string,
  title?: string
): Promise<void> => {
  const keyHash = await hashEncryptionKey(key);
  
  const body: Record<string, unknown> = {
    isEncrypted,
    encryptionHash: keyHash,
  };
  
  // If enabling encryption and title is provided, update title too
  if (isEncrypted && title) {
    body.title = title;
  }
  
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to toggle encryption' })) as { error?: string };
    throw new Error(errorData.error || 'Failed to toggle encryption');
  }
};

// Update item title
export const updateItemTitle = async (itemId: string, title: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error('Failed to update item title');
  }
};

// Get trash items
export const getTrashItems = async (): Promise<(Item & { deletedAt?: number })[]> => {
  const response = await fetch(`${API_BASE}/items/trash`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch trash items');
  }

  const data: (ApiItem & { deletedAt?: number })[] = await response.json();
  return data.map(item => ({
    ...transformItem(item),
    deletedAt: item.deletedAt,
  }));
};

// Restore item from trash
export const restoreItem = async (itemId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${itemId}/restore`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to restore item');
  }
};

// Permanently delete item
export const permanentDeleteItem = async (itemId: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${itemId}/permanent`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to permanently delete item');
  }
};

// Empty trash
export const emptyTrash = async (): Promise<number> => {
  const response = await fetch(`${API_BASE}/items/trash/empty`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to empty trash');
  }

  const data = await response.json() as { deleted: number };
  return data.deleted;
};

// Claim orphan items (items shared via PWA share target that have no user_id)
export const claimOrphanItems = async (): Promise<{ claimed: number }> => {
  const response = await fetch(`${API_BASE}/items/claim-orphans`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to claim orphan items' })) as { error?: string };
    throw new Error(errorData.error || 'Failed to claim orphan items');
  }

  return response.json();
};

// Get scheduled items (items with reminders)
export const getScheduledItems = async (): Promise<Item[]> => {
  const response = await fetch(`${API_BASE}/items/scheduled`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch scheduled items');
  }

  const data: ApiItem[] = await response.json();
  return data.map(transformItem);
};

// Update item reminder
export const updateItemReminder = async (itemId: string, reminderAt: number | null): Promise<void> => {
  const response = await fetch(`${API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reminderAt }),
  });

  if (!response.ok) {
    throw new Error('Failed to update item reminder');
  }
};
