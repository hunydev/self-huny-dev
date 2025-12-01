import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  User,
  initiateLogin,
  handleCallback,
  refreshAccessToken,
  logout as authLogout,
  saveAuthData,
  loadAuthData,
  clearAuthData,
  needsRefresh,
  isExpired,
} from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  accessToken: string | null;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Refresh timer reference
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Schedule token refresh
  const scheduleRefresh = useCallback((expiresAt: number, refreshToken: string) => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    const timeUntilRefresh = expiresAt - Date.now() - 5 * 60 * 1000; // 5 minutes before expiry

    if (timeUntilRefresh <= 0) {
      // Refresh immediately
      performRefresh(refreshToken);
    } else {
      refreshTimer = setTimeout(() => {
        performRefresh(refreshToken);
      }, timeUntilRefresh);
    }
  }, []);

  // Perform token refresh
  const performRefresh = useCallback(async (refreshToken: string) => {
    const tokens = await refreshAccessToken(refreshToken);
    
    if (tokens) {
      const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined;
      
      setAccessToken(tokens.access_token);
      
      // Update stored data
      const currentData = loadAuthData();
      saveAuthData({
        accessToken: tokens.access_token,
        user: currentData.user!,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresAt,
      });

      // Schedule next refresh
      if (expiresAt && (tokens.refresh_token || refreshToken)) {
        scheduleRefresh(expiresAt, tokens.refresh_token || refreshToken);
      }
    } else {
      // Refresh failed - clear auth state
      clearAuthData();
      setUser(null);
      setAccessToken(null);
    }
  }, [scheduleRefresh]);

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      const data = loadAuthData();
      
      if (data.accessToken && data.user) {
        // Check if token is expired
        if (isExpired(data.expiresAt)) {
          // Try to refresh
          if (data.refreshToken) {
            const tokens = await refreshAccessToken(data.refreshToken);
            if (tokens) {
              const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined;
              setUser(data.user);
              setAccessToken(tokens.access_token);
              saveAuthData({
                accessToken: tokens.access_token,
                user: data.user,
                refreshToken: tokens.refresh_token || data.refreshToken,
                expiresAt,
              });
              if (expiresAt) {
                scheduleRefresh(expiresAt, tokens.refresh_token || data.refreshToken);
              }
            } else {
              clearAuthData();
            }
          } else {
            clearAuthData();
          }
        } else {
          // Token still valid
          setUser(data.user);
          setAccessToken(data.accessToken);
          
          // Schedule refresh if needed
          if (data.expiresAt && data.refreshToken) {
            if (needsRefresh(data.expiresAt)) {
              performRefresh(data.refreshToken);
            } else {
              scheduleRefresh(data.expiresAt, data.refreshToken);
            }
          }
        }
      }
      
      setIsLoading(false);
    };

    initAuth();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
    };
  }, [scheduleRefresh, performRefresh]);

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      const isCallbackPage = window.location.pathname === '/auth/callback';

      // Handle OAuth error response
      if (error && isCallbackPage) {
        const errorMsg = errorDescription 
          ? decodeURIComponent(errorDescription) 
          : error === 'access_denied' 
            ? '접근 권한이 없습니다' 
            : '인증에 실패했습니다';
        setAuthError(errorMsg);
        window.history.replaceState({}, document.title, '/');
        setIsLoading(false);
        return;
      }

      if (code && isCallbackPage) {
        try {
          setIsLoading(true);
          const result = await handleCallback();
          
          setUser(result.user);
          setAccessToken(result.accessToken);
          saveAuthData(result);

          // Schedule refresh
          if (result.expiresAt && result.refreshToken) {
            scheduleRefresh(result.expiresAt, result.refreshToken);
          }

          // Clean URL and redirect to home
          window.history.replaceState({}, document.title, '/');
        } catch (error) {
          console.error('OAuth callback failed:', error);
          setAuthError(error instanceof Error ? error.message : '인증에 실패했습니다');
          window.history.replaceState({}, document.title, '/');
        } finally {
          setIsLoading(false);
        }
      }
    };

    handleOAuthCallback();
  }, [scheduleRefresh]);

  const login = useCallback(async () => {
    await initiateLogin();
  }, []);

  const logout = useCallback(async () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    await authLogout(accessToken || undefined);
    clearAuthData();
    setUser(null);
    setAccessToken(null);
  }, [accessToken]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        accessToken,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
