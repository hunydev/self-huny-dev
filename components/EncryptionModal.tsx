import React, { useState } from 'react';
import { X, LockKeyhole, Unlock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface EncryptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'encrypt' | 'decrypt' | 'delete';
  currentTitle?: string;
  requireTitle?: boolean;
  onConfirm: (key: string, title?: string) => Promise<void>;
}

const EncryptionModal: React.FC<EncryptionModalProps> = ({
  isOpen,
  onClose,
  mode,
  currentTitle,
  requireTitle = false,
  onConfirm,
}) => {
  const [key, setKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [title, setTitle] = useState(currentTitle || '');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!key.trim()) {
      setError('암호를 입력하세요');
      return;
    }

    if (mode === 'encrypt' && key !== confirmKey) {
      setError('암호가 일치하지 않습니다');
      return;
    }

    if (mode === 'encrypt' && requireTitle && !title.trim()) {
      setError('제목을 입력하세요');
      return;
    }

    if (key.length < 4) {
      setError('암호는 4자 이상이어야 합니다');
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(key, title.trim() || undefined);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setKey('');
    setConfirmKey('');
    setTitle(currentTitle || '');
    setShowKey(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const titles = {
    encrypt: '아이템 암호화',
    decrypt: '암호화 해제',
    delete: '암호화된 아이템 삭제',
  };

  const descriptions = {
    encrypt: '이 아이템을 암호화합니다. 암호화 후에는 암호를 입력해야 내용을 볼 수 있습니다.',
    decrypt: '암호화를 해제합니다. 암호화 키를 입력하세요.',
    delete: '이 암호화된 아이템을 삭제합니다. 암호화 키를 입력하세요.',
  };

  const buttonTexts = {
    encrypt: '암호화',
    decrypt: '암호화 해제',
    delete: '삭제',
  };

  const buttonColors = {
    encrypt: 'bg-indigo-600 hover:bg-indigo-700',
    decrypt: 'bg-amber-600 hover:bg-amber-700',
    delete: 'bg-red-600 hover:bg-red-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {mode === 'encrypt' ? (
              <LockKeyhole size={20} className="text-indigo-600" />
            ) : mode === 'decrypt' ? (
              <Unlock size={20} className="text-amber-600" />
            ) : (
              <LockKeyhole size={20} className="text-red-600" />
            )}
            <h2 className="text-lg font-semibold text-slate-800">{titles[mode]}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600">{descriptions[mode]}</p>

          {/* Title input for encryption (when required) */}
          {mode === 'encrypt' && requireTitle && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="아이템 제목"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500 mt-1">
                암호화된 아이템은 제목으로만 구분할 수 있습니다
              </p>
            </div>
          )}

          {/* Key input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              암호화 키
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="암호 입력 (4자 이상)"
                className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm key for encryption */}
          {mode === 'encrypt' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                암호 확인
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={confirmKey}
                  onChange={(e) => setConfirmKey(e.target.value)}
                  placeholder="암호 다시 입력"
                  className="w-full px-4 py-2.5 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
              disabled={isLoading}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`flex-1 py-2.5 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${buttonColors[mode]}`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  처리 중...
                </>
              ) : (
                buttonTexts[mode]
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EncryptionModal;
