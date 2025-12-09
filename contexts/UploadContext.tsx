import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface UploadItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  type: 'image' | 'video' | 'file';
  previewUrl?: string; // For image/video preview
}

interface UploadContextType {
  uploads: UploadItem[];
  addUpload: (item: Omit<UploadItem, 'progress' | 'status'>) => void;
  updateUpload: (id: string, updates: Partial<UploadItem>) => void;
  removeUpload: (id: string) => void;
  clearCompleted: () => void;
  hasActiveUploads: boolean;
}

const UploadContext = createContext<UploadContextType | null>(null);

export const UploadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

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
  }, []);

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(item => item.status !== 'completed' && item.status !== 'error'));
  }, []);

  const hasActiveUploads = uploads.some(u => u.status === 'pending' || u.status === 'uploading' || u.status === 'processing');

  return (
    <UploadContext.Provider value={{
      uploads,
      addUpload,
      updateUpload,
      removeUpload,
      clearCompleted,
      hasActiveUploads,
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
