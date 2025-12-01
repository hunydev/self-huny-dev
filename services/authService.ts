// HunyDev SSO OAuth 2.0 Service

const CLIENT_ID = 'client_BBonadEVFcfxGoHxB0DnJtsw';
const AUTH_SERVER = 'https://auth.huny.dev';

// Dynamic callback URI based on environment
const getCallbackUri = () => {
  const origin = window.location.origin;
  return `${origin}/auth/callback`;
};

// Token refresh buffer (5 minutes before expiry)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

export interface User {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

// PKCE Utilities
function base64UrlEncode(array: Uint8Array): string {
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

// Initiate login (redirect method)
export async function initiateLogin(): Promise<void> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Store for callback verification
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: getCallbackUri(),
    scope: 'openid profile email',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${AUTH_SERVER}/oauth/authorize?${params.toString()}`;
}

// Handle callback and exchange code for tokens
export async function handleCallback(): Promise<{ accessToken: string; user: User; refreshToken?: string; expiresAt?: number }> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }

  const savedState = sessionStorage.getItem('oauth_state');
  const codeVerifier = sessionStorage.getItem('pkce_code_verifier');

  if (!code || !state || !codeVerifier) {
    throw new Error('Missing authentication parameters');
  }

  if (state !== savedState) {
    throw new Error('State mismatch - possible CSRF attack');
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(`${AUTH_SERVER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: getCallbackUri(),
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const tokens: TokenResponse = await tokenResponse.json();

  // Fetch user info
  const user = await fetchUserInfo(tokens.access_token);

  // Clean up PKCE data
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('oauth_state');

  // Calculate expiry
  const expiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined;

  return {
    accessToken: tokens.access_token,
    user,
    refreshToken: tokens.refresh_token,
    expiresAt,
  };
}

// Fetch user info from OAuth server
export async function fetchUserInfo(accessToken: string): Promise<User> {
  const response = await fetch(`${AUTH_SERVER}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return await response.json();
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
  try {
    const response = await fetch(`${AUTH_SERVER}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

// Logout (revoke token)
export async function logout(accessToken?: string): Promise<void> {
  if (accessToken) {
    try {
      await fetch(`${AUTH_SERVER}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: accessToken }),
      });
    } catch {
      // Continue with local logout even if revoke fails
    }
  }
}

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  EXPIRES_AT: 'auth_expires_at',
  USER: 'auth_user',
};

// Save auth data to localStorage
export function saveAuthData(data: {
  accessToken: string;
  user: User;
  refreshToken?: string;
  expiresAt?: number;
}): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
  if (data.refreshToken) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
  }
  if (data.expiresAt) {
    localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, String(data.expiresAt));
  }
}

// Load auth data from localStorage
export function loadAuthData(): {
  accessToken: string | null;
  user: User | null;
  refreshToken: string | null;
  expiresAt: number | null;
} {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const expiresAtStr = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);

  return {
    accessToken,
    user: userStr ? JSON.parse(userStr) : null,
    refreshToken,
    expiresAt: expiresAtStr ? parseInt(expiresAtStr, 10) : null,
  };
}

// Clear auth data from localStorage
export function clearAuthData(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

// Check if token needs refresh
export function needsRefresh(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - REFRESH_BUFFER_MS;
}

// Check if token is expired
export function isExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt;
}
