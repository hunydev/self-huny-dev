import React from 'react';

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
}

export interface Item {
  id: string;
  type: ItemType;
  content: string; // Text content or URL or Base64/Blob URL
  fileBlob?: Blob; // For images/videos/files stored in IndexedDB
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  title?: string;
  tags: string[]; // Tag IDs
  createdAt: number;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  filterType?: ItemType | 'all';
}