import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, Undo2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'undo';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  startTime: number;
  onUndo?: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showUndoToast: (message: string, onUndo: () => void, duration?: number) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// UndoToast component with progress bar
const UndoToastItem: React.FC<{
  toast: Toast;
  onUndo: () => void;
  onDismiss: () => void;
}> = ({ toast, onUndo, onDismiss }) => {
  const [progress, setProgress] = React.useState(100);
  const animationRef = useRef<number>();
  
  React.useEffect(() => {
    const duration = toast.duration;
    const startTime = toast.startTime;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining > 0) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [toast.duration, toast.startTime]);

  const handleUndo = () => {
    onUndo();
    onDismiss();
  };

  return (
    <div className="bg-slate-800 text-white rounded-lg shadow-lg overflow-hidden animate-toast-in min-w-[280px]">
      <div className="px-4 py-3 flex items-center gap-3">
        <Undo2 size={18} className="text-blue-400 shrink-0" />
        <span className="flex-1 text-sm">{toast.message}</span>
        <button
          onClick={handleUndo}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors"
        >
          실행 취소
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-slate-700">
        <div 
          className="h-full bg-blue-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, duration, startTime: Date.now() }]);
    
    const timeout = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timeoutRefs.current.delete(id);
    }, duration);
    
    timeoutRefs.current.set(id, timeout);
  }, []);

  const showUndoToast = useCallback((message: string, onUndo: () => void, duration: number = 5000): string => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type: 'undo', duration, startTime: Date.now(), onUndo }]);
    
    const timeout = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timeoutRefs.current.delete(id);
    }, duration);
    
    timeoutRefs.current.set(id, timeout);
    return id;
  }, []);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={16} />;
      case 'error':
        return <XCircle size={16} />;
      case 'warning':
        return <AlertTriangle size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-amber-500 text-white';
      default:
        return 'bg-slate-700 text-white';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showUndoToast, dismissToast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          toast.type === 'undo' && toast.onUndo ? (
            <div key={toast.id} className="pointer-events-auto">
              <UndoToastItem
                toast={toast}
                onUndo={toast.onUndo}
                onDismiss={() => dismissToast(toast.id)}
              />
            </div>
          ) : (
            <div
              key={toast.id}
              onClick={() => dismissToast(toast.id)}
              className={`
                ${getStyles(toast.type)}
                px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 
                text-sm font-medium cursor-pointer pointer-events-auto
                animate-toast-in
              `}
            >
              {getIcon(toast.type)}
              <span>{toast.message}</span>
            </div>
          )
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
