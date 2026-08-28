// Cloudflare Access JWT assertion verification for @open-pencil/cloud

import { DEFAULT_ALLOWED_EMAIL_DOMAIN, type Env } from '../types.ts';
import { APIError } from '../errors.ts';

export interface JWKKey {
  kty: string;
  kid?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
  [key: string]: unknown;
}

export interface JWKSResponse {
  keys: JWKKey[];
  public_certs?: Array<{ kid: string; cert: string }>;
}

export interface AccessJWTPayload {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  name?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  type?: string;
  identity_nonce?: string;
  [key: string]: unknown;
}

export interface VerifiedAccessIdentity {
  email: string;
  name: string;
  sub: string;
  rawPayload: AccessJWTPayload;
}

export interface AccessVerifyOptions {
  jwks?: JWKSResponse | JWKKey[];
  certsUrl?: string;
  expectedAudience?: string;
  expectedIssuer?: string;
  allowedDomain?: string;
  clockSkewSeconds?: number;
  fetchFn?: typeof fetch;
}

// In-memory JWKS cache to avoid hammering certs endpoint
interface CachedJWKS {
  keys: JWKKey[];
  expiresAt: number;
}

const jwksCache = new Map<string, CachedJWKS>();
const cryptoKeyCache = new Map<string, CryptoKey>();

export function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64UrlEncode(buffer: Uint8Array | string): string {
  const bytes = typeof buffer === 'string' ? new TextEncoder().encode(buffer) : buffer;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function isValidEmailDomain(email: string, allowedDomain = DEFAULT_ALLOWED_EMAIL_DOMAIN): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();

  const parts = normalized.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || local.length === 0) return false;

  const expectedDomain = allowedDomain.trim().toLowerCase();
  return domain === expectedDomain;
}

export function parseJWTPayloadUnverified(token: string): {
  header: { alg?: string; kid?: string; typ?: string };
  payload: AccessJWTPayload;
  dataToVerify: Uint8Array;
  signatureBytes: Uint8Array;
} {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw APIError.unauthenticated('Malformed Access assertion token');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const headerStr = new TextDecoder().decode(base64UrlDecode(headerB64));
    const payloadStr = new TextDecoder().decode(base64UrlDecode(payloadB64));

    const header = JSON.parse(headerStr) as { alg?: string; kid?: string; typ?: string };
    const payload = JSON.parse(payloadStr) as AccessJWTPayload;
    const dataToVerify = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signatureBytes = base64UrlDecode(signatureB64);

    return { header, payload, dataToVerify, signatureBytes };
  } catch {
    throw APIError.unauthenticated('Invalid JWT encoding in Access assertion');
  }
}

async function fetchJWKS(
  certsUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<JWKKey[]> {
  const now = Date.now();
  const cached = jwksCache.get(certsUrl);
  if (cached && cached.expiresAt > now) {
    return cached.keys;
  }

  try {
    const res = await fetchFn(certsUrl, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Access certs: HTTP ${res.status}`);
    }
    const data = (await res.json()) as JWKSResponse;
    const keys = Array.isArray(data.keys) ? data.keys : [];
    // Cache for 10 minutes
    jwksCache.set(certsUrl, {
      keys,
      expiresAt: now + 10 * 60 * 1000,
    });
    return keys;
  } catch {
    throw APIError.upstreamUnavailable('Cloudflare Access certificate service');
  }
}

async function getOrImportCryptoKey(jwk: JWKKey): Promise<CryptoKey> {
  const cacheKey = JSON.stringify(jwk);
  const cached = cryptoKeyCache.get(cacheKey);
  if (cached) return cached;

  const alg = jwk.alg || 'RS256';
  let subtleAlg: RsaHashedImportParams | EcKeyImportParams;

  if (alg === 'RS256') {
    subtleAlg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  } else if (alg === 'ES256') {
    subtleAlg = { name: 'ECDSA', namedCurve: 'P-256' };
  } else {
    throw APIError.unauthenticated(`Unsupported signing algorithm: ${alg}`);
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    subtleAlg,
    false,
    ['verify']
  );

  cryptoKeyCache.set(cacheKey, key);
  return key;
}

export async function verifyAccessAssertion(
  assertion: string | null | undefined,
  env: Env,
  options: AccessVerifyOptions = {}
): Promise<VerifiedAccessIdentity> {
  if (!assertion || typeof assertion !== 'string' || assertion.trim() === '') {
    throw APIError.unauthenticated('Missing Cloudflare Access assertion header');
  }

  const { header, payload, dataToVerify, signatureBytes } = parseJWTPayloadUnverified(assertion);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const clockSkew = options.clockSkewSeconds ?? 60; // 60 seconds clock skew tolerance

  // Check expiration
  if (typeof payload.exp !== 'number' || payload.exp + clockSkew < nowSeconds) {
    throw APIError.unauthenticated('Cloudflare Access assertion has expired');
  }

  // Check not before
  if (typeof payload.nbf === 'number' && payload.nbf - clockSkew > nowSeconds) {
    throw APIError.unauthenticated('Cloudflare Access assertion is not yet valid');
  }

  // Check Audience
  const expectedAudience = options.expectedAudience || env.ACCESS_AUDIENCE;
  if (expectedAudience) {
    const audMatches = Array.isArray(payload.aud)
      ? payload.aud.includes(expectedAudience)
      : payload.aud === expectedAudience;

    if (!audMatches) {
      throw APIError.forbidden('Cloudflare Access assertion audience mismatch');
    }
  }

  // Check Issuer
  const expectedIssuer =
    options.expectedIssuer ||
    (env.ACCESS_TEAM_DOMAIN ? `https://${env.ACCESS_TEAM_DOMAIN}.cloudflareaccess.com` : undefined);

  if (expectedIssuer && payload.iss !== expectedIssuer) {
    throw APIError.forbidden('Cloudflare Access assertion issuer mismatch');
  }

  // Verify Signature
  let keys: JWKKey[] = [];
  if (options.jwks) {
    keys = Array.isArray(options.jwks) ? options.jwks : options.jwks.keys || [];
  } else {
    const certsUrl =
      options.certsUrl ||
      env.ACCESS_CERTS_URL ||
      (env.ACCESS_TEAM_DOMAIN
        ? `https://${env.ACCESS_TEAM_DOMAIN}.cloudflareaccess.com/cdn-cgi/access/certs`
        : undefined);

    if (certsUrl) {
      keys = await fetchJWKS(certsUrl, options.fetchFn);
    }
  }

  if (keys.length > 0) {
    const matchingKey = header.kid ? keys.find((k) => k.kid === header.kid) : keys[0];
    if (!matchingKey) {
      throw APIError.unauthenticated('No matching Access public key found for assertion');
    }

    const cryptoKey = await getOrImportCryptoKey(matchingKey);
    const algName = matchingKey.alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5';

    const isValid = await crypto.subtle.verify(
      algName,
      cryptoKey,
      signatureBytes as BufferSource,
      dataToVerify as BufferSource
    );

    if (!isValid) {
      throw APIError.unauthenticated('Invalid Cloudflare Access assertion signature');
    }
  }

  // Validate Email and Exact Domain Suffix
  const email = (payload.email || (typeof payload.sub === 'string' && payload.sub.includes('@') ? payload.sub : ''))
    .trim()
    .toLowerCase();

  const allowedDomain = options.allowedDomain || env.ALLOWED_EMAIL_DOMAIN || DEFAULT_ALLOWED_EMAIL_DOMAIN;

  if (!email || !isValidEmailDomain(email, allowedDomain)) {
    throw APIError.forbidden(`Access restricted to @${allowedDomain} accounts`);
  }

  const name = typeof payload.name === 'string' && payload.name.trim() !== ''
    ? payload.name.trim()
    : email.split('@')[0];

  const sub = typeof payload.sub === 'string' && payload.sub !== '' ? payload.sub : email;

  return {
    email,
    name,
    sub,
    rawPayload: payload,
  };
}
