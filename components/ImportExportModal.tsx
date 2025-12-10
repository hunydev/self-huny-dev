import React, { useState, useRef, useCallback } from 'react';
import { X, Download, Upload, FileArchive, Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';
import { 
  exportData, 
  validateImportFile, 
  importData, 
  formatFileSize,
  ValidationResult 
} from '../services/importExportService';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type TabType = 'export' | 'import-zip' | 'import-ai';

interface ExportProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

interface ImportProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('export');
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportComplete, setExportComplete] = useState(false);
  
  // Import state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importResult, setImportResult] = useState<{
    itemsCreated: number;
    tagsCreated: number;
    errors: string[];
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetExportState = () => {
    setIsExporting(false);
    setExportProgress(null);
    setExportError(null);
    setExportComplete(false);
  };

  const resetImportState = () => {
    setSelectedFile(null);
    setValidation(null);
    setIsValidating(false);
    setIsImporting(false);
    setImportProgress(null);
    setImportResult(null);
  };

  const handleExport = async () => {
    resetExportState();
    setIsExporting(true);

    try {
      const blob = await exportData((progress) => {
        setExportProgress(progress);
      });

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `self-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportComplete(true);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '내보내기 실패');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    resetImportState();
    setSelectedFile(file);
    setIsValidating(true);

    try {
      const result = await validateImportFile(file);
      setValidation(result);
    } catch (error) {
      setValidation({
        valid: false,
        errors: [error instanceof Error ? error.message : '검증 실패'],
        itemCount: 0,
        tagCount: 0,
        fileCount: 0,
        totalFileSize: 0,
      });
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleImport = async () => {
    if (!selectedFile || !validation?.valid) return;

    setIsImporting(true);
    setImportProgress(null);

    try {
      const result = await importData(selectedFile, (progress) => {
        setImportProgress(progress);
      });
      setImportResult(result);
      
      if (result.errors.length === 0) {
        onImportComplete?.();
      }
    } catch (error) {
      setImportResult({
        itemsCreated: 0,
        tagsCreated: 0,
        errors: [error instanceof Error ? error.message : '가져오기 실패'],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    resetExportState();
    resetImportState();
    onClose();
  };

  if (!isOpen) return null;

  const getProgressPercentage = (progress: ExportProgress | ImportProgress | null): number => {
    if (!progress) return 0;
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">데이터 관리</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => { setActiveTab('export'); resetExportState(); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
          <button
            onClick={() => { setActiveTab('import-zip'); resetImportState(); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import-zip'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Upload className="w-4 h-4" />
            가져오기
          </button>
          <button
            onClick={() => setActiveTab('import-ai')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'import-ai'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI 가져오기
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-start gap-3">
                  <FileArchive className="w-8 h-8 text-blue-500 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-800">ZIP 파일로 내보내기</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      모든 아이템, 태그, 첨부 파일을 ZIP 파일로 내보냅니다.
                      이미지, 영상, 파일은 각각의 폴더에 저장됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress */}
              {(isExporting || exportProgress) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{exportProgress?.message || '준비 중...'}</span>
                    <span className="text-slate-500">{getProgressPercentage(exportProgress)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${getProgressPercentage(exportProgress)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success */}
              {exportComplete && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg">
                  <Check className="w-5 h-5" />
                  <span className="text-sm font-medium">내보내기가 완료되었습니다!</span>
                </div>
              )}

              {/* Error */}
              {exportError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{exportError}</span>
                </div>
              )}

              <button
                onClick={handleExport}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    내보내는 중...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    내보내기
                  </>
                )}
              </button>
            </div>
          )}

          {/* Import ZIP Tab */}
          {activeTab === 'import-zip' && (
            <div className="space-y-4">
              {/* File Drop Zone */}
              {!importResult && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    selectedFile
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  
                  {selectedFile ? (
                    <div className="space-y-2">
                      <FileArchive className="w-12 h-12 text-blue-500 mx-auto" />
                      <p className="font-medium text-slate-800">{selectedFile.name}</p>
                      <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                      <p className="font-medium text-slate-600">ZIP 파일을 드래그하거나 클릭하여 선택</p>
                      <p className="text-sm text-slate-400">내보내기로 생성된 백업 파일만 지원됩니다</p>
                    </div>
                  )}
                </div>
              )}

              {/* Validation Status */}
              {isValidating && (
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  <span className="text-sm text-slate-600">파일 검증 중...</span>
                </div>
              )}

              {/* Validation Result */}
              {validation && !isValidating && !importResult && (
                <div className={`p-4 rounded-xl ${validation.valid ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-start gap-3">
                    {validation.valid ? (
                      <Check className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-medium ${validation.valid ? 'text-green-800' : 'text-red-800'}`}>
                        {validation.valid ? '유효한 백업 파일입니다' : '유효하지 않은 파일입니다'}
                      </h4>
                      
                      {validation.valid ? (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div className="text-green-700">
                            <span className="font-medium">{validation.itemCount}</span>개 아이템
                          </div>
                          <div className="text-green-700">
                            <span className="font-medium">{validation.tagCount}</span>개 태그
                          </div>
                          <div className="text-green-700">
                            <span className="font-medium">{validation.fileCount}</span>개 파일
                          </div>
                          <div className="text-green-700">
                            <span className="font-medium">{formatFileSize(validation.totalFileSize)}</span>
                          </div>
                        </div>
                      ) : (
                        <ul className="mt-2 space-y-1 text-sm text-red-700">
                          {validation.errors.map((error, index) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Import Progress */}
              {(isImporting || importProgress) && !importResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{importProgress?.message || '준비 중...'}</span>
                    <span className="text-slate-500">{getProgressPercentage(importProgress)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${getProgressPercentage(importProgress)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div className={`p-4 rounded-xl ${importResult.errors.length === 0 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                  <div className="flex items-start gap-3">
                    {importResult.errors.length === 0 ? (
                      <Check className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-medium ${importResult.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'}`}>
                        가져오기 완료
                      </h4>
                      <div className="mt-2 text-sm">
                        <p className={importResult.errors.length === 0 ? 'text-green-700' : 'text-yellow-700'}>
                          <span className="font-medium">{importResult.itemsCreated}</span>개 아이템, 
                          <span className="font-medium"> {importResult.tagsCreated}</span>개 태그가 생성되었습니다.
                        </p>
                        {importResult.errors.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium text-yellow-800">일부 항목에서 오류 발생:</p>
                            <ul className="mt-1 space-y-1 text-yellow-700 max-h-32 overflow-y-auto">
                              {importResult.errors.slice(0, 5).map((error, index) => (
                                <li key={index}>• {error}</li>
                              ))}
                              {importResult.errors.length > 5 && (
                                <li>...외 {importResult.errors.length - 5}개</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Import Button */}
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!validation?.valid || isImporting || isValidating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      가져오는 중...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      가져오기
                    </>
                  )}
                </button>
              )}

              {/* Close Button after import */}
              {importResult && (
                <button
                  onClick={handleClose}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-500 text-white rounded-xl font-medium hover:bg-slate-600 transition-colors"
                >
                  닫기
                </button>
              )}
            </div>
          )}

          {/* AI Import Tab (Placeholder) */}
          {activeTab === 'import-ai' && (
            <div className="space-y-4">
              <div className="p-8 text-center">
                <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-800 mb-2">AI 가져오기</h3>
                <p className="text-slate-500">
                  AI를 활용한 스마트 가져오기 기능은<br />
                  곧 출시될 예정입니다.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportExportModal;
