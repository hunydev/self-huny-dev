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

// Generate index.html for viewing exported data
const generateIndexHtml = (data: ExportData): string => {
  const tagsMap = new Map(data.tags.map(t => [t.id, t]));
  
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'text': return '텍스트';
      case 'link': return '링크';
      case 'image': return '이미지';
      case 'video': return '비디오';
      case 'file': return '파일';
      default: return type;
    }
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'text': return '#64748b';
      case 'link': return '#6366f1';
      case 'image': return '#10b981';
      case 'video': return '#8b5cf6';
      case 'file': return '#f59e0b';
      default: return '#64748b';
    }
  };

  const renderItemContent = (item: ExportItem): string => {
    if (item.isEncrypted) {
      return '<div class="encrypted"><span class="lock-icon">🔒</span> 암호화된 아이템</div>';
    }

    let content = '';

    // Image
    if (item.type === 'image' && item.filePath) {
      content += '<div class="media"><img src="' + item.filePath + '" alt="' + escapeHtml(item.fileName || '') + '" loading="lazy" /></div>';
    }

    // Video
    if (item.type === 'video' && item.filePath) {
      content += '<div class="media"><video src="' + item.filePath + '" controls preload="metadata"></video></div>';
    }

    // File
    if (item.type === 'file' && item.filePath) {
      content += '<div class="file-info"><a href="' + item.filePath + '" download="' + escapeHtml(item.fileName || 'download') + '">📎 ' + escapeHtml(item.fileName || '파일 다운로드') + '</a></div>';
    }

    // OG Preview
    if (item.ogImage) {
      content += '<div class="og-preview">';
      content += '<img src="' + escapeHtml(item.ogImage) + '" alt="Preview" loading="lazy" onerror="this.style.display=\'none\'" />';
      if (item.ogTitle) {
        content += '<div class="og-title">' + escapeHtml(item.ogTitle) + '</div>';
      }
      if (item.ogDescription) {
        content += '<div class="og-desc">' + escapeHtml(item.ogDescription) + '</div>';
      }
      content += '</div>';
    }

    // Text content
    if (item.content) {
      const isUrl = item.type === 'link' || /^https?:\/\//i.test(item.content);
      if (isUrl) {
        content += '<div class="content"><a href="' + escapeHtml(item.content) + '" target="_blank" rel="noopener">' + escapeHtml(item.content) + '</a></div>';
      } else {
        content += '<div class="content">' + escapeHtml(item.content).replace(/\n/g, '<br>') + '</div>';
      }
    }

    return content;
  };

  const itemsHtml = data.items.map(item => {
    const itemTags = item.tags.map(tagId => tagsMap.get(tagId)).filter(Boolean);
    const tagsHtml = itemTags.map(tag => 
      '<span class="tag" style="background-color: ' + (tag?.color || '#e2e8f0') + '">#' + escapeHtml(tag?.name || '') + '</span>'
    ).join('');

    return '<div class="card" data-type="' + item.type + '" data-favorite="' + item.isFavorite + '">' +
      '<div class="card-header">' +
        '<span class="type-badge" style="background-color: ' + getTypeColor(item.type) + '">' + getTypeLabel(item.type) + '</span>' +
        (item.isFavorite ? '<span class="favorite">⭐</span>' : '') +
        '<span class="date">' + formatDate(item.createdAt) + '</span>' +
      '</div>' +
      (item.title ? '<h3 class="card-title">' + escapeHtml(item.title) + '</h3>' : '') +
      '<div class="card-content">' + renderItemContent(item) + '</div>' +
      (tagsHtml ? '<div class="card-tags">' + tagsHtml + '</div>' : '') +
    '</div>';
  }).join('');

  const exportDate = new Date(data.exportedAt);

  return '<!DOCTYPE html>' +
'<html lang="ko">' +
'<head>' +
'  <meta charset="UTF-8">' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'  <title>Self Backup - ' + exportDate.toLocaleDateString('ko-KR') + '</title>' +
'  <style>' +
'    * { box-sizing: border-box; margin: 0; padding: 0; }' +
'    body {' +
'      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
'      background: #f1f5f9;' +
'      color: #1e293b;' +
'      line-height: 1.6;' +
'      padding: 20px;' +
'    }' +
'    .header {' +
'      max-width: 1200px;' +
'      margin: 0 auto 24px;' +
'      padding: 24px;' +
'      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);' +
'      border-radius: 16px;' +
'      color: white;' +
'    }' +
'    .header h1 { font-size: 24px; margin-bottom: 8px; }' +
'    .header .meta { opacity: 0.9; font-size: 14px; }' +
'    .filters {' +
'      max-width: 1200px;' +
'      margin: 0 auto 20px;' +
'      display: flex;' +
'      gap: 8px;' +
'      flex-wrap: wrap;' +
'    }' +
'    .filter-btn {' +
'      padding: 8px 16px;' +
'      border: none;' +
'      border-radius: 20px;' +
'      background: white;' +
'      color: #64748b;' +
'      font-size: 13px;' +
'      cursor: pointer;' +
'      transition: all 0.2s;' +
'    }' +
'    .filter-btn:hover { background: #e2e8f0; }' +
'    .filter-btn.active { background: #6366f1; color: white; }' +
'    .grid {' +
'      max-width: 1200px;' +
'      margin: 0 auto;' +
'      display: grid;' +
'      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));' +
'      gap: 16px;' +
'    }' +
'    .card {' +
'      background: white;' +
'      border-radius: 12px;' +
'      overflow: hidden;' +
'      box-shadow: 0 1px 3px rgba(0,0,0,0.1);' +
'      transition: transform 0.2s, box-shadow 0.2s;' +
'    }' +
'    .card:hover {' +
'      transform: translateY(-2px);' +
'      box-shadow: 0 4px 12px rgba(0,0,0,0.15);' +
'    }' +
'    .card-header {' +
'      padding: 12px 16px;' +
'      display: flex;' +
'      align-items: center;' +
'      gap: 8px;' +
'      border-bottom: 1px solid #f1f5f9;' +
'      font-size: 12px;' +
'    }' +
'    .type-badge {' +
'      padding: 2px 8px;' +
'      border-radius: 12px;' +
'      color: white;' +
'      font-weight: 500;' +
'      font-size: 11px;' +
'    }' +
'    .favorite { font-size: 14px; }' +
'    .date { margin-left: auto; color: #94a3b8; }' +
'    .card-title {' +
'      padding: 12px 16px 8px;' +
'      font-size: 15px;' +
'      font-weight: 600;' +
'    }' +
'    .card-content {' +
'      padding: 0 16px 16px;' +
'    }' +
'    .content {' +
'      font-size: 14px;' +
'      color: #475569;' +
'      word-break: break-word;' +
'    }' +
'    .content a { color: #6366f1; text-decoration: none; }' +
'    .content a:hover { text-decoration: underline; }' +
'    .media img, .media video {' +
'      width: 100%;' +
'      max-height: 300px;' +
'      object-fit: contain;' +
'      background: #f8fafc;' +
'      border-radius: 8px;' +
'      margin-bottom: 12px;' +
'    }' +
'    .og-preview {' +
'      background: #f8fafc;' +
'      border-radius: 8px;' +
'      overflow: hidden;' +
'      margin-bottom: 12px;' +
'    }' +
'    .og-preview img {' +
'      width: 100%;' +
'      max-height: 180px;' +
'      object-fit: cover;' +
'    }' +
'    .og-title {' +
'      padding: 8px 12px 4px;' +
'      font-weight: 600;' +
'      font-size: 13px;' +
'    }' +
'    .og-desc {' +
'      padding: 0 12px 8px;' +
'      font-size: 12px;' +
'      color: #64748b;' +
'    }' +
'    .file-info {' +
'      padding: 12px;' +
'      background: #f8fafc;' +
'      border-radius: 8px;' +
'      margin-bottom: 12px;' +
'    }' +
'    .file-info a {' +
'      color: #6366f1;' +
'      text-decoration: none;' +
'      font-size: 14px;' +
'    }' +
'    .encrypted {' +
'      padding: 24px;' +
'      text-align: center;' +
'      color: #94a3b8;' +
'      background: #f8fafc;' +
'      border-radius: 8px;' +
'    }' +
'    .lock-icon { font-size: 24px; display: block; margin-bottom: 8px; }' +
'    .card-tags {' +
'      padding: 0 16px 16px;' +
'      display: flex;' +
'      flex-wrap: wrap;' +
'      gap: 4px;' +
'    }' +
'    .tag {' +
'      padding: 2px 8px;' +
'      border-radius: 12px;' +
'      font-size: 11px;' +
'      color: #475569;' +
'    }' +
'    .hidden { display: none !important; }' +
'    @media (max-width: 640px) {' +
'      body { padding: 12px; }' +
'      .grid { grid-template-columns: 1fr; }' +
'    }' +
'  </style>' +
'</head>' +
'<body>' +
'  <div class="header">' +
'    <h1>📦 Self Backup</h1>' +
'    <div class="meta">' +
'      내보낸 날짜: ' + exportDate.toLocaleString('ko-KR') + ' · ' +
       data.items.length + '개 아이템 · ' + data.tags.length + '개 태그' +
'    </div>' +
'  </div>' +
'  <div class="filters">' +
'    <button class="filter-btn active" data-filter="all">전체</button>' +
'    <button class="filter-btn" data-filter="text">텍스트</button>' +
'    <button class="filter-btn" data-filter="link">링크</button>' +
'    <button class="filter-btn" data-filter="image">이미지</button>' +
'    <button class="filter-btn" data-filter="video">비디오</button>' +
'    <button class="filter-btn" data-filter="file">파일</button>' +
'    <button class="filter-btn" data-filter="favorite">⭐ 즐겨찾기</button>' +
'  </div>' +
'  <div class="grid">' +
     itemsHtml +
'  </div>' +
'  <script>' +
'    document.querySelectorAll(".filter-btn").forEach(btn => {' +
'      btn.addEventListener("click", () => {' +
'        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));' +
'        btn.classList.add("active");' +
'        const filter = btn.dataset.filter;' +
'        document.querySelectorAll(".card").forEach(card => {' +
'          if (filter === "all") {' +
'            card.classList.remove("hidden");' +
'          } else if (filter === "favorite") {' +
'            card.classList.toggle("hidden", card.dataset.favorite !== "true");' +
'          } else {' +
'            card.classList.toggle("hidden", card.dataset.type !== filter);' +
'          }' +
'        });' +
'      });' +
'    });' +
'  </script>' +
'</body>' +
'</html>';
};

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

  // Create index.html for viewing exported data
  const indexHtml = generateIndexHtml(exportData);
  zip.file('index.html', indexHtml);

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
