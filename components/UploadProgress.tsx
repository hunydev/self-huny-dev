import React from 'react';
import { X, Check, AlertCircle, Loader2, Image, Video, FileText, ChevronUp, ChevronDown } from 'lucide-react';
import { useUpload, UploadItem } from '../contexts/UploadContext';

const UploadProgress: React.FC = () => {
  const { uploads, removeUpload, clearCompleted, hasActiveUploads } = useUpload();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  if (uploads.length === 0) return null;

  const activeCount = uploads.filter(u => u.status === 'pending' || u.status === 'uploading' || u.status === 'processing').length;
  const completedCount = uploads.filter(u => u.status === 'completed').length;
  const errorCount = uploads.filter(u => u.status === 'error').length;

  const getIcon = (item: UploadItem) => {
    switch (item.type) {
      case 'image': return <Image size={16} className="text-blue-500" />;
      case 'video': return <Video size={16} className="text-purple-500" />;
      default: return <FileText size={16} className="text-slate-500" />;
    }
  };

  const getStatusIcon = (item: UploadItem) => {
    switch (item.status) {
      case 'completed':
        return <Check size={14} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={14} className="text-red-500" />;
      case 'uploading':
      case 'processing':
        return <Loader2 size={14} className="text-indigo-500 animate-spin" />;
      default:
        return <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />;
    }
  };

  const getStatusText = (item: UploadItem) => {
    switch (item.status) {
      case 'pending': return '대기 중...';
      case 'uploading': return `업로드 중... ${item.progress}%`;
      case 'processing': return '처리 중...';
      case 'completed': return '완료';
      case 'error': return item.error || '오류 발생';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          {hasActiveUploads && (
            <Loader2 size={16} className="text-indigo-500 animate-spin" />
          )}
          <span className="font-medium text-slate-700 text-sm">
            업로드 {activeCount > 0 ? `(${activeCount}개 진행 중)` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(completedCount > 0 || errorCount > 0) && !hasActiveUploads && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              모두 지우기
            </button>
          )}
          {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* Upload List */}
      {!isCollapsed && (
        <div className="max-h-64 overflow-y-auto">
          {uploads.map(item => (
            <div 
              key={item.id} 
              className="px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
            >
              <div className="flex items-start gap-3">
                {/* Preview or Icon */}
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                  {item.previewUrl ? (
                    item.type === 'video' ? (
                      <video src={item.previewUrl} className="w-full h-full object-cover" />
                    ) : (
                      <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                    )
                  ) : (
                    getIcon(item)
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 truncate">
                      {item.fileName}
                    </span>
                    {getStatusIcon(item)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400">
                      {formatFileSize(item.fileSize)}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className={`text-xs ${item.status === 'error' ? 'text-red-500' : 'text-slate-500'}`}>
                      {getStatusText(item)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {(item.status === 'uploading' || item.status === 'pending') && (
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Remove button */}
                {(item.status === 'completed' || item.status === 'error') && (
                  <button
                    onClick={() => removeUpload(item.id)}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                  >
                    <X size={14} className="text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary when collapsed */}
      {isCollapsed && hasActiveUploads && (
        <div className="px-4 py-2 bg-indigo-50">
          <div className="h-1.5 bg-indigo-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ 
                width: `${uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadProgress;
