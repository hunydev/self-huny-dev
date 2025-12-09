export enum ItemType {
  TEXT = 'text',
  LINK = 'link',
  IMAGE = 'image',
  VIDEO = 'video',
  FILE = 'file',
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  autoKeywords?: string[]; // Keywords for auto-classification
}

export interface Item {
  id: string;
  type: ItemType;
  content: string;
  fileBlob?: Blob; // For uploading new files (client-side only)
  fileKey?: string; // R2 storage key (from server)
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  title?: string;
  ogImage?: string; // Open Graph image URL
  ogTitle?: string; // Open Graph title
  ogDescription?: string; // Open Graph description
  tags: string[]; // Tag IDs
  isFavorite: boolean; // Favorite flag
  isEncrypted: boolean; // Encryption flag
  createdAt: number;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  filterType?: ItemType | 'all' | 'favorites';
}
