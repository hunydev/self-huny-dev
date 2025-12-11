import { Context } from 'hono';
import type { Env, Variables } from '../index';

const AUTH_SERVER = 'https://auth.huny.dev';

export interface AuthUser {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

// Verify JWT token with OAuth server
async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const response = await fetch(`${AUTH_SERVER}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Extract token from Authorization header
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

// Auth middleware - verifies token and attaches user to context
export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);

  if (!token) {
    return c.json({ error: 'Unauthorized - No token provided' }, 401);
  }

  const user = await verifyToken(token);

  if (!user) {
    return c.json({ error: 'Unauthorized - Invalid token' }, 401);
  }

  // Attach user to context
  c.set('user', user);

  await next();
}

// Optional auth middleware - attaches user if token is valid, but doesn't require it
export async function optionalAuthMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader);

  if (token) {
    const user = await verifyToken(token);
    if (user) {
      c.set('user', user);
    }
  }

  await next();
}

// Helper to get user from context
export function getUser(c: Context<{ Bindings: Env; Variables: Variables }>): AuthUser {
  return c.get('user') as AuthUser;
}

// Helper to get optional user from context (may be undefined)
export function getOptionalUser(c: Context<{ Bindings: Env; Variables: Variables }>): AuthUser | undefined {
  return c.get('user') as AuthUser | undefined;
}

// Extract token from cookie
function extractTokenFromCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }
  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'auth_token' && value) {
      return value;
    }
  }
  return null;
}

// Verify token from cookie (for share target)
export async function verifyTokenFromCookie(cookieHeader: string | null | undefined): Promise<AuthUser | null> {
  const token = extractTokenFromCookie(cookieHeader);
  if (!token) {
    return null;
  }
  return await verifyToken(token);
}
