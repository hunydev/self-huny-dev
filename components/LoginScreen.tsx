import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen: React.FC = () => {
  const { login, isLoading, authError, clearAuthError } = useAuth();

  const handleLogin = async () => {
    // Clear any previous error before attempting login
    if (authError) {
      clearAuthError();
    }
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / App Name */}
        <div className="text-center mb-8">
          <img 
            src="/icons/icon-192.png" 
            alt="Self" 
            className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg"
          />
          <h1 className="text-3xl font-bold text-white mb-2">Self</h1>
          <p className="text-gray-400">나만의 개인 저장소</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-700/50">
          <h2 className="text-xl font-semibold text-white text-center mb-6">
            로그인이 필요합니다
          </h2>
          
          <p className="text-gray-400 text-center mb-8">
            메모, 이미지, 링크를 저장하고 관리하려면<br />
            먼저 로그인해주세요.
          </p>

          <button
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Huny 계정으로 로그인
          </button>

          <p className="text-gray-500 text-sm text-center mt-6">
            auth.huny.dev를 통해 안전하게 인증됩니다
          </p>
        </div>

        {/* Auth Error Message */}
        {authError && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="font-medium">인증에 실패했습니다</p>
                <p className="text-sm mt-1 text-red-300">{authError}</p>
              </div>
              <button
                onClick={clearAuthError}
                className="p-1 hover:bg-red-500/30 rounded transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
