import { Context } from 'hono';
import type { Env } from '../index';

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
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: () => Promise<void>) {
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

// Helper to get user from context
export function getUser(c: Context): AuthUser {
  return c.get('user') as AuthUser;
}

// Helper to get optional user from context (returns undefined if not authenticated)
export function getOptionalUser(c: Context): AuthUser | undefined {
  return c.get('user') as AuthUser | undefined;
}
