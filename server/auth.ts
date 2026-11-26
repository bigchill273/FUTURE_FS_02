import crypto from 'node:crypto';
import { getDb } from './db.ts';

const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getSigningSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  return configured && configured.length >= 16
    ? configured
    : EPHEMERAL_FALLBACK_SECRET;
}

export const SESSION_COOKIE_NAME = 'crm_session';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  createdAt: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = crypto.scryptSync(password, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64').toString('utf8');
}

export function signSessionToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
    } satisfies TokenPayload)
  );
  const signingInput = `${header}.${payload}`;
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', getSigningSecret()).update(signingInput).digest()
  );
  return `${signingInput}.${sig}`;
}

export function verifySessionToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;

  const expectedSig = base64UrlEncode(
    crypto
      .createHmac('sha256', getSigningSecret())
      .update(`${header}.${payload}`)
      .digest()
  );

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as TokenPayload;
    if (!decoded.sub || typeof decoded.exp !== 'number') return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function isHttpsRequest(request: Request): boolean {
  const proto = request.headers.get('x-forwarded-proto');
  if (proto && proto.split(',')[0].trim() === 'https') {
    return true;
  }
  return new URL(request.url).protocol === 'https:';
}

export function setSessionCookie(request: Request, token: string): string {
  const https = isHttpsRequest(request);
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${TOKEN_TTL_SECONDS}`,
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    attributes.push('Secure', 'Partitioned');
  }
  return attributes.join('; ');
}

export function clearSessionCookie(request: Request): string {
  const https = isHttpsRequest(request);
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    https ? 'SameSite=None' : 'SameSite=Lax',
  ];
  if (https) {
    attributes.push('Secure', 'Partitioned');
  }
  return attributes.join('; ');
}

export function extractAuthContext(request: Request): {
  user: AuthUser | null;
  token: string | null;
  source: 'bearer' | 'cookie' | null;
} {
  const authHeader = request.headers.get('authorization') ?? undefined;
  let token: string | null = null;
  let source: 'bearer' | 'cookie' | null = null;

  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
    source = 'bearer';
  } else {
    const cookies = parseCookies(request.headers.get('cookie') ?? undefined);
    if (cookies[SESSION_COOKIE_NAME]) {
      token = cookies[SESSION_COOKIE_NAME];
      source = 'cookie';
    }
  }

  if (!token || !source) {
    return { user: null, token: null, source: null };
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return { user: null, token: null, source: null };
  }

  const db = getDb();
  const row = db
    .prepare(
      'SELECT id, name, email, company, role, created_at FROM users WHERE id = ?'
    )
    .get(payload.sub) as
    | {
        id: string;
        name: string;
        email: string;
        company: string;
        role: string;
        created_at: string;
      }
    | undefined;

  if (!row) {
    return { user: null, token: null, source: null };
  }

  return {
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      company: row.company,
      role: row.role,
      createdAt: row.created_at,
    },
    token,
    source,
  };
}

export function isSameOriginMutation(request: Request): boolean {
  const hasCustomHeader =
    request.headers.get('x-requested-with') === 'XMLHttpRequest' ||
    request.headers.get('x-requested-with') === 'fetch';
  if (hasCustomHeader) return true;

  const origin = request.headers.get('origin');
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}
