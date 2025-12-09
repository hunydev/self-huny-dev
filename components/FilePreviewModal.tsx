import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Loader2, FileText, Folder, File, AlertCircle } from 'lucide-react';
import {
  getPreviewType,
  getPrismLanguage,
  canPreview,
  renderPdfPage,
  getPdfPageCount,
  getArchiveContents,
  getSpreadsheetData,
  parseCSV,
  fetchTextContent,
  loadPrism,
  highlightCode,
  formatFileSize,
  PreviewType,
  ArchiveEntry,
  SpreadsheetData,
} from '../services/filePreviewService';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  onDownload?: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  fileSize,
  onDownload,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>('unsupported');
  
  // PDF state
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Archive state
  const [archiveEntries, setArchiveEntries] = useState<ArchiveEntry[]>([]);
  
  // Spreadsheet state
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [currentSheet, setCurrentSheet] = useState(0);
  
  // CSV state
  const [csvData, setCsvData] = useState<string[][]>([]);
  
  // Text/Code state
  const [textContent, setTextContent] = useState('');
  const [highlightedCode, setHighlightedCode] = useState('');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (previewType === 'pdf') {
        if (e.key === 'ArrowLeft') setCurrentPdfPage(p => Math.max(1, p - 1));
        if (e.key === 'ArrowRight') setCurrentPdfPage(p => Math.min(pdfPageCount, p + 1));
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, previewType, pdfPageCount]);

  // Load preview based on file type
  const loadPreview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const type = getPreviewType(fileName);
    setPreviewType(type);
    
    try {
      switch (type) {
        case 'pdf':
          const pageCount = await getPdfPageCount(fileUrl);
          setPdfPageCount(pageCount);
          setCurrentPdfPage(1);
          break;
          
        case 'archive':
          // Check file size - limit to 50MB for archive preview
          if (fileSize && fileSize > 50 * 1024 * 1024) {
            setError('파일이 너무 큽니다. 50MB 이하의 압축파일만 미리보기할 수 있습니다.');
            break;
          }
          const entries = await getArchiveContents(fileUrl);
          setArchiveEntries(entries);
          break;
          
        case 'spreadsheet':
          const sheetData = await getSpreadsheetData(fileUrl);
          setSpreadsheetData(sheetData);
          setCurrentSheet(0);
          break;
          
        case 'csv':
          const csv = await parseCSV(fileUrl);
          setCsvData(csv);
          break;
          
        case 'json':
        case 'code':
        case 'text':
        case 'markdown':
          const content = await fetchTextContent(fileUrl);
          setTextContent(content);
          
          if (type === 'code' || type === 'json' || type === 'markdown') {
            await loadPrism();
            const lang = getPrismLanguage(fileName);
            const highlighted = highlightCode(content, lang);
            setHighlightedCode(highlighted);
          }
          break;
          
        case 'unsupported':
          setError('이 파일 형식은 미리보기를 지원하지 않습니다.');
          break;
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError('파일을 미리보기하는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [fileUrl, fileName, fileSize]);

  useEffect(() => {
    if (isOpen && fileUrl) {
      loadPreview();
    }
  }, [isOpen, fileUrl, loadPreview]);

  // Render PDF page when page changes
  useEffect(() => {
    if (previewType === 'pdf' && pdfCanvasRef.current && !isLoading && pdfPageCount > 0) {
      renderPdfPage(fileUrl, currentPdfPage, pdfCanvasRef.current, 1.5).catch(err => {
        console.error('Error rendering PDF page:', err);
      });
    }
  }, [previewType, currentPdfPage, fileUrl, isLoading, pdfPageCount]);

  if (!isOpen) return null;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-16">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-500">미리보기 로딩 중...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-16">
          <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
          <p className="text-slate-500 text-center">{error}</p>
          {onDownload && (
            <button
              onClick={onDownload}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Download size={18} />
              파일 다운로드
            </button>
          )}
        </div>
      );
    }

    switch (previewType) {
      case 'pdf':
        return (
          <div className="flex flex-col h-full">
            {/* PDF Navigation */}
            <div className="flex items-center justify-center gap-4 py-3 border-b border-slate-200 bg-slate-50">
              <button
                onClick={() => setCurrentPdfPage(p => Math.max(1, p - 1))}
                disabled={currentPdfPage <= 1}
                className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-slate-600">
                {currentPdfPage} / {pdfPageCount}
              </span>
              <button
                onClick={() => setCurrentPdfPage(p => Math.min(pdfPageCount, p + 1))}
                disabled={currentPdfPage >= pdfPageCount}
                className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            {/* PDF Canvas */}
            <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-slate-100">
              <canvas ref={pdfCanvasRef} className="shadow-lg" />
            </div>
          </div>
        );

      case 'archive':
        return (
          <div className="h-full overflow-auto">
            <div className="p-4">
              <div className="text-sm text-slate-500 mb-3">
                {archiveEntries.length}개 항목
              </div>
              <div className="space-y-1">
                {archiveEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50"
                  >
                    {entry.isDirectory ? (
                      <Folder size={18} className="text-amber-500 shrink-0" />
                    ) : (
                      <File size={18} className="text-slate-400 shrink-0" />
                    )}
                    <span className="flex-1 text-sm text-slate-700 truncate">
                      {entry.name}
                    </span>
                    {!entry.isDirectory && (
                      <span className="text-xs text-slate-400">
                        {formatFileSize(entry.size)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'spreadsheet':
        if (!spreadsheetData) return null;
        const currentSheetData = spreadsheetData.sheets[currentSheet];
        return (
          <div className="h-full flex flex-col">
            {/* Sheet tabs */}
            {spreadsheetData.sheets.length > 1 && (
              <div className="flex gap-1 px-4 py-2 border-b border-slate-200 bg-slate-50 overflow-x-auto">
                {spreadsheetData.sheets.map((sheet, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSheet(idx)}
                    className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                      currentSheet === idx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
            )}
            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {currentSheetData?.data.map((row, rowIdx) => (
                    <tr key={rowIdx} className={rowIdx === 0 ? 'bg-slate-100 font-medium' : ''}>
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="border border-slate-200 px-3 py-2 text-slate-700 whitespace-nowrap"
                        >
                          {cell ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'csv':
        return (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm border-collapse">
              <tbody>
                {csvData.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx === 0 ? 'bg-slate-100 font-medium' : ''}>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="border border-slate-200 px-3 py-2 text-slate-700 whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'json':
      case 'code':
      case 'markdown':
        return (
          <div className="h-full overflow-auto bg-slate-900 p-4">
            <pre className="text-sm leading-relaxed">
              <code
                className={`language-${getPrismLanguage(fileName)}`}
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
                style={{
                  color: '#e2e8f0',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                }}
              />
            </pre>
          </div>
        );

      case 'text':
        return (
          <div className="h-full overflow-auto p-4">
            <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
              {textContent}
            </pre>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <FileText className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-500">미리보기를 지원하지 않는 파일 형식입니다.</p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-800 truncate">{fileName}</h2>
              {fileSize && (
                <p className="text-xs text-slate-400">{formatFileSize(fileSize)}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Download size={16} />
                다운로드
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
