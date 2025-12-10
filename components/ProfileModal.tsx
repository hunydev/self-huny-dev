import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
}

interface UserStats {
  totalItems: number;
  totalTags: number;
  totalFileSize: number;
}

type DeleteStep = 'idle' | 'backup-check' | 'final-confirm';
type DeleteType = 'data' | 'account' | null;

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onExport }) => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle');
  const [deleteType, setDeleteType] = useState<DeleteType>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user stats when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStats();
      setDeleteStep('idle');
      setDeleteType(null);
      setError(null);
    }
  }, [isOpen]);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/items/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDeleteDataClick = () => {
    setDeleteType('data');
    setDeleteStep('backup-check');
    setError(null);
  };

  const handleDeleteAccountClick = () => {
    setDeleteType('account');
    setDeleteStep('backup-check');
    setError(null);
  };

  const handleBackupCheckYes = () => {
    onExport();
  };

  const handleBackupCheckNo = () => {
    setDeleteStep('final-confirm');
  };

  const handleCancelDelete = () => {
    setDeleteStep('idle');
    setDeleteType(null);
    setError(null);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      if (deleteType === 'data') {
        const response = await fetch('/api/items/delete-all', {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('데이터 삭제에 실패했습니다.');
        }

        // Refresh page after data deletion
        window.location.reload();
      } else if (deleteType === 'account') {
        const response = await fetch('/api/user', {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('계정 삭제에 실패했습니다.');
        }

        // Logout and redirect after account deletion
        await logout();
        window.location.href = '/';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const renderContent = () => {
    // Backup check step
    if (deleteStep === 'backup-check') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-4 rounded-lg">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium">데이터를 백업하셨나요?</p>
              <p className="text-sm text-amber-700 mt-1">
                {deleteType === 'account' 
                  ? '계정을 삭제하면 모든 데이터가 함께 삭제됩니다.' 
                  : '삭제된 데이터는 복구할 수 없습니다.'}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleBackupCheckYes}
              className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              백업하기
            </button>
            <button
              onClick={handleBackupCheckNo}
              className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
            >
              백업 완료했어요
            </button>
          </div>

          <button
            onClick={handleCancelDelete}
            className="w-full px-4 py-2 text-slate-500 hover:text-slate-700 transition-colors text-sm"
          >
            취소
          </button>
        </div>
      );
    }

    // Final confirmation step
    if (deleteStep === 'final-confirm') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-lg">
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="font-medium">
                {deleteType === 'account' ? '정말 계정을 삭제하시겠습니까?' : '정말 모든 데이터를 삭제하시겠습니까?'}
              </p>
              <p className="text-sm text-red-700 mt-1">
                ⚠️ 이 작업은 되돌릴 수 없습니다. 모든 {deleteType === 'account' ? '계정 정보와 ' : ''}데이터가 영구적으로 삭제됩니다.
              </p>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleCancelDelete}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  삭제 중...
                </>
              ) : (
                <>
                  {deleteType === 'account' ? '계정 삭제' : '데이터 삭제'}
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    // Default view - Profile info
    return (
      <div className="space-y-6">
        {/* User Info */}
        <div className="flex items-center gap-4">
          {user?.picture ? (
            <img
              src={user.picture}
              alt={user.name || 'User'}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-medium">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-lg text-slate-800">{user?.name || '사용자'}</h3>
            {user?.email && (
              <p className="text-slate-500 text-sm">{user.email}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-slate-50 rounded-xl p-4 space-y-3">
          <h4 className="font-medium text-slate-700 text-sm">내 데이터</h4>
          {isLoadingStats ? (
            <div className="flex items-center justify-center py-4">
              <svg className="w-5 h-5 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : stats ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.totalItems}</p>
                <p className="text-xs text-slate-500">아이템</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.totalTags}</p>
                <p className="text-xs text-slate-500">태그</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{formatFileSize(stats.totalFileSize)}</p>
                <p className="text-xs text-slate-500">저장 공간</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-2">통계를 불러올 수 없습니다</p>
          )}
        </div>

        {/* Danger Zone */}
        <div className="border border-red-200 rounded-xl p-4 space-y-3">
          <h4 className="font-medium text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            위험 구역
          </h4>
          
          {/* Delete All Data */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-slate-700 text-sm">데이터 전체 삭제</p>
              <p className="text-xs text-slate-500">모든 아이템과 태그가 삭제됩니다</p>
            </div>
            <button
              onClick={handleDeleteDataClick}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              삭제
            </button>
          </div>

          <div className="border-t border-red-100"></div>

          {/* Delete Account */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-slate-700 text-sm">계정 삭제</p>
              <p className="text-xs text-slate-500">계정과 모든 데이터가 삭제됩니다</p>
            </div>
            <button
              onClick={handleDeleteAccountClick}
              className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {deleteStep === 'idle' ? '내 정보' : deleteType === 'account' ? '계정 삭제' : '데이터 삭제'}
          </h2>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
