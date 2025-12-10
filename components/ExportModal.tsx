import React, { useState } from 'react';
import { X, Download, FileArchive, Check, AlertCircle, Loader2 } from 'lucide-react';
import { exportData } from '../services/importExportService';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExportProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportComplete, setExportComplete] = useState(false);

  const resetState = () => {
    setIsExporting(false);
    setExportProgress(null);
    setExportError(null);
    setExportComplete(false);
  };

  const handleExport = async () => {
    resetState();
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

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  const getProgressPercentage = (): number => {
    if (!exportProgress) return 0;
    if (exportProgress.total === 0) return 0;
    return Math.round((exportProgress.current / exportProgress.total) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-800">내보내기</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
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
      </div>
    </div>
  );
};

export default ExportModal;
