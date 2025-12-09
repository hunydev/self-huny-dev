// File Preview Service - Dynamically loads libraries for file preview

export type PreviewType = 
  | 'pdf' 
  | 'archive' 
  | 'spreadsheet' 
  | 'code' 
  | 'text' 
  | 'json' 
  | 'csv'
  | 'markdown'
  | 'unsupported';

export interface ArchiveEntry {
  name: string;
  size: number;
  isDirectory: boolean;
  compressedSize?: number;
}

export interface SpreadsheetData {
  sheets: {
    name: string;
    data: (string | number | null)[][];
  }[];
}

// Map file extensions to preview types
const EXTENSION_MAP: Record<string, PreviewType> = {
  // PDF
  'pdf': 'pdf',
  
  // Archives
  'zip': 'archive',
  'rar': 'archive',
  '7z': 'archive',
  'tar': 'archive',
  'gz': 'archive',
  
  // Spreadsheets
  'xlsx': 'spreadsheet',
  'xls': 'spreadsheet',
  'ods': 'spreadsheet',
  
  // CSV
  'csv': 'csv',
  
  // JSON
  'json': 'json',
  
  // Markdown
  'md': 'markdown',
  'markdown': 'markdown',
  
  // Code files
  'js': 'code',
  'jsx': 'code',
  'ts': 'code',
  'tsx': 'code',
  'html': 'code',
  'htm': 'code',
  'css': 'code',
  'scss': 'code',
  'sass': 'code',
  'less': 'code',
  'py': 'code',
  'java': 'code',
  'kt': 'code',
  'swift': 'code',
  'go': 'code',
  'rs': 'code',
  'rb': 'code',
  'php': 'code',
  'c': 'code',
  'cpp': 'code',
  'h': 'code',
  'hpp': 'code',
  'cs': 'code',
  'sql': 'code',
  'sh': 'code',
  'bash': 'code',
  'zsh': 'code',
  'ps1': 'code',
  'yaml': 'code',
  'yml': 'code',
  'xml': 'code',
  'toml': 'code',
  'ini': 'code',
  'env': 'code',
  'dockerfile': 'code',
  'makefile': 'code',
  'gradle': 'code',
  
  // Plain text
  'txt': 'text',
  'log': 'text',
  'hwp': 'unsupported', // HWP requires complex parsing, mark as unsupported for now
};

// Map extensions to Prism language
const PRISM_LANGUAGE_MAP: Record<string, string> = {
  'js': 'javascript',
  'jsx': 'jsx',
  'ts': 'typescript',
  'tsx': 'tsx',
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'sass',
  'less': 'less',
  'py': 'python',
  'java': 'java',
  'kt': 'kotlin',
  'swift': 'swift',
  'go': 'go',
  'rs': 'rust',
  'rb': 'ruby',
  'php': 'php',
  'c': 'c',
  'cpp': 'cpp',
  'h': 'c',
  'hpp': 'cpp',
  'cs': 'csharp',
  'sql': 'sql',
  'sh': 'bash',
  'bash': 'bash',
  'zsh': 'bash',
  'ps1': 'powershell',
  'yaml': 'yaml',
  'yml': 'yaml',
  'xml': 'xml',
  'toml': 'toml',
  'ini': 'ini',
  'json': 'json',
  'md': 'markdown',
  'markdown': 'markdown',
  'dockerfile': 'docker',
};

export function getPreviewType(filename: string): PreviewType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return EXTENSION_MAP[ext] || 'unsupported';
}

export function getPrismLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return PRISM_LANGUAGE_MAP[ext] || 'plaintext';
}

export function canPreview(filename: string): boolean {
  return getPreviewType(filename) !== 'unsupported';
}

// PDF Preview
let pdfJsLoaded = false;
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

export async function loadPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (pdfJsLoaded && pdfjsLib) {
    return pdfjsLib;
  }
  
  pdfjsLib = await import('pdfjs-dist');
  
  // Set worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  
  pdfJsLoaded = true;
  return pdfjsLib;
}

export async function getPdfPageCount(url: string): Promise<number> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument(url).promise;
  return pdf.numPages;
}

export async function renderPdfPage(
  url: string, 
  pageNum: number, 
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<void> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument(url).promise;
  const page = await pdf.getPage(pageNum);
  
  const viewport = page.getViewport({ scale });
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');
  
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;
}

// Archive Preview (ZIP only for now, as JSZip handles zip files)
let jsZipLoaded = false;
let JSZip: typeof import('jszip').default | null = null;

export async function loadJSZip(): Promise<typeof import('jszip').default> {
  if (jsZipLoaded && JSZip) {
    return JSZip;
  }
  
  const module = await import('jszip');
  JSZip = module.default;
  jsZipLoaded = true;
  return JSZip;
}

export async function getArchiveContents(url: string): Promise<ArchiveEntry[]> {
  const JSZipLib = await loadJSZip();
  
  const response = await fetch(url);
  const blob = await response.blob();
  const zip = await JSZipLib.loadAsync(blob);
  
  const entries: ArchiveEntry[] = [];
  
  zip.forEach((relativePath, zipEntry) => {
    entries.push({
      name: relativePath,
      size: zipEntry._data?.uncompressedSize || 0,
      isDirectory: zipEntry.dir,
      compressedSize: zipEntry._data?.compressedSize,
    });
  });
  
  // Sort: directories first, then by name
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  
  return entries;
}

// Spreadsheet Preview
let xlsxLoaded = false;
let XLSX: typeof import('xlsx') | null = null;

export async function loadXLSX(): Promise<typeof import('xlsx')> {
  if (xlsxLoaded && XLSX) {
    return XLSX;
  }
  
  XLSX = await import('xlsx');
  xlsxLoaded = true;
  return XLSX;
}

export async function getSpreadsheetData(url: string, maxRows: number = 100): Promise<SpreadsheetData> {
  const xlsx = await loadXLSX();
  
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = xlsx.read(arrayBuffer, { type: 'array' });
  
  const sheets = workbook.SheetNames.map(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json<(string | number | null)[]>(worksheet, { 
      header: 1,
      defval: null,
    });
    
    // Limit rows for preview
    const limitedData = jsonData.slice(0, maxRows);
    
    return {
      name: sheetName,
      data: limitedData,
    };
  });
  
  return { sheets };
}

// CSV Preview
export async function parseCSV(url: string, maxRows: number = 100): Promise<string[][]> {
  const response = await fetch(url);
  const text = await response.text();
  
  const lines = text.split('\n');
  const result: string[][] = [];
  
  for (let i = 0; i < Math.min(lines.length, maxRows); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing (handles basic cases)
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }
  
  return result;
}

// Text/Code Preview
export async function fetchTextContent(url: string, maxBytes: number = 100000): Promise<string> {
  const response = await fetch(url);
  const text = await response.text();
  
  // Limit size for preview
  if (text.length > maxBytes) {
    return text.slice(0, maxBytes) + '\n\n... (truncated)';
  }
  
  return text;
}

// Prism.js for syntax highlighting
let prismLoaded = false;

export async function loadPrism(): Promise<typeof import('prismjs')> {
  if (prismLoaded) {
    return (window as unknown as { Prism: typeof import('prismjs') }).Prism;
  }
  
  const Prism = await import('prismjs');
  
  // Load common languages
  await Promise.all([
    import('prismjs/components/prism-javascript'),
    import('prismjs/components/prism-typescript'),
    import('prismjs/components/prism-jsx'),
    import('prismjs/components/prism-tsx'),
    import('prismjs/components/prism-css'),
    import('prismjs/components/prism-python'),
    import('prismjs/components/prism-java'),
    import('prismjs/components/prism-json'),
    import('prismjs/components/prism-yaml'),
    import('prismjs/components/prism-bash'),
    import('prismjs/components/prism-sql'),
    import('prismjs/components/prism-markdown'),
  ].map(p => p.catch(() => {}))); // Ignore errors for missing language components
  
  prismLoaded = true;
  return Prism.default;
}

export function highlightCode(code: string, language: string): string {
  const Prism = (window as unknown as { Prism: typeof import('prismjs') }).Prism;
  
  if (Prism && Prism.languages[language]) {
    return Prism.highlight(code, Prism.languages[language], language);
  }
  
  // Fallback: escape HTML
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
