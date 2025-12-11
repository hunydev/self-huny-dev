import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

export interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';
  error?: string;
  type: 'image' | 'video' | 'file';
  previewUrl?: string; // For image/video preview
}

interface UploadContextType {
  uploads: UploadItem[];
  addUpload: (item: Omit<UploadItem, 'progress' | 'status'>) => void;
  updateUpload: (id: string, updates: Partial<UploadItem>) => void;
  removeUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
  hasActiveUploads: boolean;
  registerAbortController: (id: string, controller: AbortController) => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export const UploadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const addUpload = useCallback((item: Omit<UploadItem, 'progress' | 'status'>) => {
    setUploads(prev => [
      ...prev,
      { ...item, progress: 0, status: 'pending' }
    ]);
  }, []);

  const updateUpload = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploads(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  }, []);

  const removeUpload = useCallback((id: string) => {
    setUploads(prev => prev.filter(item => item.id !== id));
    abortControllers.current.delete(id);
  }, []);

  const cancelUpload = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    setUploads(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'cancelled', error: '업로드가 취소되었습니다' } : item
    ));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(item => 
      item.status !== 'completed' && item.status !== 'error' && item.status !== 'cancelled'
    ));
  }, []);

  const registerAbortController = useCallback((id: string, controller: AbortController) => {
    abortControllers.current.set(id, controller);
  }, []);

  const hasActiveUploads = uploads.some(u => u.status === 'pending' || u.status === 'uploading' || u.status === 'processing');

  return (
    <UploadContext.Provider value={{
      uploads,
      addUpload,
      updateUpload,
      removeUpload,
      cancelUpload,
      clearCompleted,
      hasActiveUploads,
      registerAbortController,
    }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};
