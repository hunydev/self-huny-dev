import React, { useState, useRef, useCallback } from 'react';
import { X, Upload, FileArchive, Sparkles, Check, AlertCircle, Loader2, SkipForward, Play } from 'lucide-react';
import { 
  validateImportFile, 
  importData, 
  formatFileSize,
  ValidationResult 
} from '../services/importExportService';
import { parseItems, ParsedItem } from '../services/geminiService';
import { saveItem } from '../services/db';
import { Item, ItemType } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

type TabType = 'zip' | 'ai';

interface ImportProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

// AI Import state
type AIImportPhase = 'input' | 'parsing' | 'review' | 'importing' | 'complete';

interface AIItemCandidate extends ParsedItem {
  status: 'pending' | 'added' | 'skipped';
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('zip');
  
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
  
  // AI Import state
  const [aiInput, setAiInput] = useState('');
  const [aiPhase, setAiPhase] = useState<AIImportPhase>('input');
  const [aiCandidates, setAiCandidates] = useState<AIItemCandidate[]>([]);
  const [aiCurrentIndex, setAiCurrentIndex] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiImportedCount, setAiImportedCount] = useState(0);
  const [aiSkippedCount, setAiSkippedCount] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetImportState = () => {
    setSelectedFile(null);
    setValidation(null);
    setIsValidating(false);
    setIsImporting(false);
    setImportProgress(null);
    setImportResult(null);
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

  // AI Import functions
  const resetAiState = () => {
    setAiInput('');
    setAiPhase('input');
    setAiCandidates([]);
    setAiCurrentIndex(0);
    setAiError(null);
    setAiImportedCount(0);
    setAiSkippedCount(0);
  };

  const handleAiParse = async () => {
    if (!aiInput.trim()) return;
    
    setAiPhase('parsing');
    setAiError(null);
    
    try {
      const items = await parseItems(aiInput);
      if (items.length === 0) {
        setAiError('추출할 수 있는 아이템이 없습니다.');
        setAiPhase('input');
        return;
      }
      
      setAiCandidates(items.map(item => ({ ...item, status: 'pending' as const })));
      setAiCurrentIndex(0);
      setAiPhase('review');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI 분석에 실패했습니다.');
      setAiPhase('input');
    }
  };

  const addCurrentItem = async (): Promise<boolean> => {
    const current = aiCandidates[aiCurrentIndex];
    if (!current || current.status !== 'pending') return false;
    
    try {
      const newItem: Omit<Item, 'id' | 'createdAt'> = {
        type: current.type === 'link' ? ItemType.LINK : ItemType.TEXT,
        content: current.content,
        title: current.title || undefined,
        tags: [],
        isFavorite: false,
        isEncrypted: false,
      };
      
      await saveItem(newItem);
      
      setAiCandidates(prev => prev.map((item, idx) => 
        idx === aiCurrentIndex ? { ...item, status: 'added' as const } : item
      ));
      setAiImportedCount(prev => prev + 1);
      return true;
    } catch (error) {
      console.error('Failed to add item:', error);
      return false;
    }
  };

  const handleAddItem = async () => {
    await addCurrentItem();
    moveToNext();
  };

  const handleSkipItem = () => {
    setAiCandidates(prev => prev.map((item, idx) => 
      idx === aiCurrentIndex ? { ...item, status: 'skipped' as const } : item
    ));
    setAiSkippedCount(prev => prev + 1);
    moveToNext();
  };

  const moveToNext = () => {
    const nextIndex = aiCurrentIndex + 1;
    if (nextIndex >= aiCandidates.length) {
      setAiPhase('complete');
      onImportComplete?.();
    } else {
      setAiCurrentIndex(nextIndex);
    }
  };

  const handleAutoImport = async () => {
    setAiPhase('importing');
    
    for (let i = aiCurrentIndex; i < aiCandidates.length; i++) {
      setAiCurrentIndex(i);
      const candidate = aiCandidates[i];
      
      if (candidate.status === 'pending') {
        try {
          const newItem: Omit<Item, 'id' | 'createdAt'> = {
            type: candidate.type === 'link' ? ItemType.LINK : ItemType.TEXT,
            content: candidate.content,
            title: candidate.title || undefined,
            tags: [],
            isFavorite: false,
            isEncrypted: false,
          };
          
          await saveItem(newItem);
          
          setAiCandidates(prev => prev.map((item, idx) => 
            idx === i ? { ...item, status: 'added' as const } : item
          ));
          setAiImportedCount(prev => prev + 1);
        } catch (error) {
          console.error('Failed to add item:', error);
        }
      }
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setAiPhase('complete');
    onImportComplete?.();
  };

  const handleClose = () => {
    resetImportState();
    resetAiState();
    onClose();
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'zip') {
      resetImportState();
    } else {
      resetAiState();
    }
  };

  if (!isOpen) return null;

  const getProgressPercentage = (): number => {
    if (!importProgress) return 0;
    if (importProgress.total === 0) return 0;
    return Math.round((importProgress.current / importProgress.total) * 100);
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
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-800">가져오기</h2>
          </div>
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
            onClick={() => handleTabChange('zip')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'zip'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileArchive className="w-4 h-4" />
            일반 가져오기
          </button>
          <button
            onClick={() => handleTabChange('ai')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'ai'
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
          {/* ZIP Import Tab */}
          {activeTab === 'zip' && (
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
                    <span className="text-slate-500">{getProgressPercentage()}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${getProgressPercentage()}%` }}
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

          {/* AI Import Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              {/* Input Phase */}
              {aiPhase === 'input' && (
                <>
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-6 h-6 text-purple-500 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-slate-800">AI로 아이템 추출하기</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          텍스트를 붙여넣으면 AI가 자동으로 개별 아이템을 추출합니다.
                          링크, 메모, 아이디어 등 다양한 형식을 인식합니다.
                        </p>
                      </div>
                    </div>
                  </div>

                  <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="저장할 아이템 목록을 붙여넣으세요...&#10;&#10;예시:&#10;- https://example.com 나중에 볼 링크&#10;- 회의 메모: 다음 주 발표 준비&#10;- 아이디어: 새로운 기능 제안"
                    className="w-full h-48 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm resize-none"
                  />

                  {aiError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm">{aiError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleAiParse}
                    disabled={!aiInput.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Sparkles className="w-5 h-5" />
                    AI로 분석하기
                  </button>
                </>
              )}

              {/* Parsing Phase */}
              {aiPhase === 'parsing' && (
                <div className="py-12 text-center">
                  <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">AI가 아이템을 분석하고 있습니다...</p>
                  <p className="text-sm text-slate-400 mt-1">잠시만 기다려주세요</p>
                </div>
              )}

              {/* Review Phase */}
              {aiPhase === 'review' && aiCandidates.length > 0 && (
                <>
                  {/* Progress */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {aiCurrentIndex + 1} / {aiCandidates.length} 아이템
                    </span>
                    <span className="text-slate-500">
                      추가: {aiImportedCount} | 건너뜀: {aiSkippedCount}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${((aiCurrentIndex) / aiCandidates.length) * 100}%` }}
                    />
                  </div>

                  {/* Current Item Preview */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        aiCandidates[aiCurrentIndex].type === 'link' 
                          ? 'bg-indigo-100 text-indigo-700' 
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {aiCandidates[aiCurrentIndex].type === 'link' ? '링크' : '텍스트'}
                      </span>
                    </div>
                    {aiCandidates[aiCurrentIndex].title && (
                      <h4 className="font-medium text-slate-800 mb-1">
                        {aiCandidates[aiCurrentIndex].title}
                      </h4>
                    )}
                    <p className="text-sm text-slate-600 whitespace-pre-wrap break-all line-clamp-4">
                      {aiCandidates[aiCurrentIndex].content}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleSkipItem}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                      <SkipForward className="w-4 h-4" />
                      건너뛰기
                    </button>
                    <button
                      onClick={handleAddItem}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-xl font-medium hover:bg-purple-600 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      추가하기
                    </button>
                  </div>

                  {/* Auto Import Button */}
                  <button
                    onClick={handleAutoImport}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-sm"
                  >
                    <Play className="w-4 h-4" />
                    나머지 {aiCandidates.length - aiCurrentIndex}개 모두 자동 추가
                  </button>
                </>
              )}

              {/* Auto Importing Phase */}
              {aiPhase === 'importing' && (
                <>
                  <div className="py-8 text-center">
                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">아이템을 추가하고 있습니다...</p>
                  </div>
                  
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">
                        {aiCurrentIndex + 1} / {aiCandidates.length} 처리 중
                      </span>
                      <span className="text-slate-500">{Math.round(((aiCurrentIndex + 1) / aiCandidates.length) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${((aiCurrentIndex + 1) / aiCandidates.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Complete Phase */}
              {aiPhase === 'complete' && (
                <>
                  <div className="p-4 bg-green-50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-green-800">AI 가져오기 완료</h4>
                        <div className="mt-2 text-sm text-green-700">
                          <p><span className="font-medium">{aiImportedCount}</span>개 아이템이 추가되었습니다.</p>
                          {aiSkippedCount > 0 && (
                            <p><span className="font-medium">{aiSkippedCount}</span>개 아이템을 건너뛰었습니다.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-500 text-white rounded-xl font-medium hover:bg-slate-600 transition-colors"
                  >
                    닫기
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
