import JSZip from 'jszip';
import { Item, ItemType, Tag } from '../types';
import { getItems, getTags, getFileUrl, saveItem, saveTag } from './db';

// Export data structure
export interface ExportData {
  version: string;
  exportedAt: string;
  items: ExportItem[];
  tags: Tag[];
}

export interface ExportItem {
  id: string;
  type: ItemType;
  content: string;
  htmlContent?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  filePath?: string; // Reference to file in zip (e.g., "files/abc123.png")
  title?: string;
  ogImage?: string;
  ogTitle?: string;
  ogDescription?: string;
  tags: string[];
  isFavorite: boolean;
  isEncrypted: boolean;
  isCode?: boolean;
  createdAt: number;
}

// Progress callback types
export type ExportProgressCallback = (progress: {
  phase: 'preparing' | 'fetching-items' | 'downloading-files' | 'creating-zip';
  current: number;
  total: number;
  message: string;
}) => void;

export type ImportProgressCallback = (progress: {
  phase: 'validating' | 'uploading-files' | 'creating-items' | 'creating-tags';
  current: number;
  total: number;
  message: string;
}) => void;

// Validation result
export interface ValidationResult {
  valid: boolean;
  data?: ExportData;
  errors: string[];
  itemCount: number;
  tagCount: number;
  fileCount: number;
  totalFileSize: number;
}

const EXPORT_VERSION = '1.0';
const MANIFEST_FILE = 'manifest.json';

// Get folder name based on item type
const getFileFolder = (type: ItemType): string => {
  switch (type) {
    case ItemType.IMAGE:
      return 'images';
    case ItemType.VIDEO:
      return 'videos';
    case ItemType.FILE:
      return 'files';
    default:
      return 'files';
  }
};

// Export all items to a zip file
export const exportData = async (onProgress?: ExportProgressCallback): Promise<Blob> => {
  const zip = new JSZip();
  
  // Phase 1: Fetching items
  onProgress?.({
    phase: 'fetching-items',
    current: 0,
    total: 1,
    message: '아이템 목록을 불러오는 중...',
  });

  const [items, tags] = await Promise.all([
    getItems(),
    getTags(),
  ]);

  onProgress?.({
    phase: 'fetching-items',
    current: 1,
    total: 1,
    message: `${items.length}개 아이템, ${tags.length}개 태그 로드 완료`,
  });

  // Phase 2: Downloading files
  const itemsWithFiles = items.filter(item => item.fileKey);
  const exportItems: ExportItem[] = [];
  
  // Create folders
  zip.folder('images');
  zip.folder('videos');
  zip.folder('files');

  let fileDownloadCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const exportItem: ExportItem = {
      id: item.id,
      type: item.type,
      content: item.content,
      htmlContent: item.htmlContent,
      fileName: item.fileName,
      fileSize: item.fileSize,
      mimeType: item.mimeType,
      title: item.title,
      ogImage: item.ogImage,
      ogTitle: item.ogTitle,
      ogDescription: item.ogDescription,
      tags: item.tags,
      isFavorite: item.isFavorite,
      isEncrypted: item.isEncrypted,
      isCode: item.isCode,
      createdAt: item.createdAt,
    };

    // Download and add file if exists
    if (item.fileKey) {
      fileDownloadCount++;
      onProgress?.({
        phase: 'downloading-files',
        current: fileDownloadCount,
        total: itemsWithFiles.length,
        message: `파일 다운로드 중: ${item.fileName || item.fileKey}`,
      });

      try {
        const fileUrl = getFileUrl(item.fileKey);
        const response = await fetch(fileUrl);
        
        if (response.ok) {
          const fileBlob = await response.blob();
          const folder = getFileFolder(item.type);
          const extension = item.fileName?.split('.').pop() || 'bin';
          const filePath = `${folder}/${item.id}.${extension}`;
          
          zip.file(filePath, fileBlob);
          exportItem.filePath = filePath;
        }
      } catch (error) {
        console.error(`Failed to download file for item ${item.id}:`, error);
        // Continue without the file
      }
    }

    exportItems.push(exportItem);
  }

  // Phase 3: Creating zip
  onProgress?.({
    phase: 'creating-zip',
    current: 0,
    total: 1,
    message: 'ZIP 파일 생성 중...',
  });

  // Create manifest
  const exportData: ExportData = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    items: exportItems,
    tags,
  };

  zip.file(MANIFEST_FILE, JSON.stringify(exportData, null, 2));

  // Generate zip blob
  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      onProgress?.({
        phase: 'creating-zip',
        current: Math.round(metadata.percent),
        total: 100,
        message: `ZIP 압축 중: ${Math.round(metadata.percent)}%`,
      });
    }
  );

  return zipBlob;
};

// Validate import zip file
export const validateImportFile = async (file: File): Promise<ValidationResult> => {
  const errors: string[] = [];
  let data: ExportData | undefined;
  let fileCount = 0;
  let totalFileSize = 0;

  try {
    const zip = await JSZip.loadAsync(file);
    
    // Check for manifest file
    const manifestFile = zip.file(MANIFEST_FILE);
    if (!manifestFile) {
      return {
        valid: false,
        errors: ['manifest.json 파일이 없습니다. 올바른 내보내기 파일인지 확인해주세요.'],
        itemCount: 0,
        tagCount: 0,
        fileCount: 0,
        totalFileSize: 0,
      };
    }

    // Parse manifest
    const manifestContent = await manifestFile.async('string');
    try {
      data = JSON.parse(manifestContent) as ExportData;
    } catch {
      return {
        valid: false,
        errors: ['manifest.json 파일을 파싱할 수 없습니다.'],
        itemCount: 0,
        tagCount: 0,
        fileCount: 0,
        totalFileSize: 0,
      };
    }

    // Validate version
    if (!data.version) {
      errors.push('버전 정보가 없습니다.');
    }

    // Validate items
    if (!Array.isArray(data.items)) {
      errors.push('아이템 목록이 올바르지 않습니다.');
    } else {
      // Check each item has required fields
      data.items.forEach((item, index) => {
        if (!item.id) errors.push(`아이템 ${index + 1}: ID가 없습니다.`);
        if (!item.type) errors.push(`아이템 ${index + 1}: 타입이 없습니다.`);
        if (item.content === undefined) errors.push(`아이템 ${index + 1}: 내용이 없습니다.`);
      });
    }

    // Validate tags
    if (!Array.isArray(data.tags)) {
      errors.push('태그 목록이 올바르지 않습니다.');
    }

    // Count files and calculate size
    const allFiles = Object.keys(zip.files).filter(name => 
      name !== MANIFEST_FILE && !zip.files[name].dir
    );
    fileCount = allFiles.length;

    for (const fileName of allFiles) {
      const file = zip.file(fileName);
      if (file) {
        const content = await file.async('arraybuffer');
        totalFileSize += content.byteLength;
      }
    }

  } catch (error) {
    return {
      valid: false,
      errors: [`ZIP 파일을 읽을 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`],
      itemCount: 0,
      tagCount: 0,
      fileCount: 0,
      totalFileSize: 0,
    };
  }

  return {
    valid: errors.length === 0,
    data,
    errors,
    itemCount: data?.items.length || 0,
    tagCount: data?.tags.length || 0,
    fileCount,
    totalFileSize,
  };
};

// Import data from zip file
export const importData = async (
  file: File,
  onProgress?: ImportProgressCallback
): Promise<{ itemsCreated: number; tagsCreated: number; errors: string[] }> => {
  const errors: string[] = [];
  let itemsCreated = 0;
  let tagsCreated = 0;

  // Phase 1: Validating
  onProgress?.({
    phase: 'validating',
    current: 0,
    total: 1,
    message: 'ZIP 파일 검증 중...',
  });

  const validation = await validateImportFile(file);
  if (!validation.valid || !validation.data) {
    return { 
      itemsCreated: 0, 
      tagsCreated: 0, 
      errors: validation.errors 
    };
  }

  const zip = await JSZip.loadAsync(file);
  const data = validation.data;

  // Phase 2: Create tags first (to get new IDs)
  const tagIdMap = new Map<string, string>(); // old ID -> new ID

  for (let i = 0; i < data.tags.length; i++) {
    const tag = data.tags[i];
    onProgress?.({
      phase: 'creating-tags',
      current: i + 1,
      total: data.tags.length,
      message: `태그 생성 중: ${tag.name}`,
    });

    try {
      const newTag = await saveTag({
        id: '', // Will be assigned by server
        name: tag.name,
        color: tag.color,
        autoKeywords: tag.autoKeywords,
      });
      tagIdMap.set(tag.id, newTag.id);
      tagsCreated++;
    } catch (error) {
      errors.push(`태그 "${tag.name}" 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  // Phase 3: Upload files and create items
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    onProgress?.({
      phase: item.filePath ? 'uploading-files' : 'creating-items',
      current: i + 1,
      total: data.items.length,
      message: item.filePath 
        ? `파일 업로드 중: ${item.fileName || '파일'}` 
        : `아이템 생성 중: ${i + 1}/${data.items.length}`,
    });

    try {
      let fileBlob: Blob | undefined;

      // Get file from zip if exists
      if (item.filePath) {
        const zipFile = zip.file(item.filePath);
        if (zipFile) {
          const fileData = await zipFile.async('arraybuffer');
          fileBlob = new Blob([fileData], { type: item.mimeType || 'application/octet-stream' });
        }
      }

      // Map old tag IDs to new tag IDs
      const newTagIds = item.tags
        .map(oldId => tagIdMap.get(oldId))
        .filter((id): id is string => id !== undefined);

      // Create item
      await saveItem({
        type: item.type,
        content: item.content,
        htmlContent: item.htmlContent,
        fileBlob,
        fileName: item.fileName,
        fileSize: item.fileSize,
        mimeType: item.mimeType,
        title: item.title,
        tags: newTagIds,
        isFavorite: item.isFavorite,
        isEncrypted: item.isEncrypted,
        isCode: item.isCode,
      });

      itemsCreated++;
    } catch (error) {
      errors.push(`아이템 생성 실패 (${item.id}): ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  return { itemsCreated, tagsCreated, errors };
};

// Format file size for display
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
