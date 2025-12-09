import React, { useState } from 'react';
import { LockKeyhole, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface EncryptionUnlockProps {
  onUnlock: (key: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const EncryptionUnlock: React.FC<EncryptionUnlockProps> = ({ onUnlock, isLoading, error }) => {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      await onUnlock(key);
    }
  };

  return (
    <div className="p-8 flex flex-col items-center gap-6">
      {/* Lock Icon */}
      <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
        <LockKeyhole size={36} className="text-slate-500" />
      </div>
      
      {/* Title */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">암호화된 아이템</h3>
        <p className="text-sm text-slate-500">내용을 보려면 암호를 입력하세요</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="암호 입력"
            className="w-full px-4 py-3 pr-12 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
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

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading || !key.trim()}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              확인 중...
            </>
          ) : (
            '잠금 해제'
          )}
        </button>
      </form>
    </div>
  );
};

export default EncryptionUnlock;
