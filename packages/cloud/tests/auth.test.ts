// Unit and contract tests for Cloudflare Access & Turnstile authentication in @open-pencil/cloud

import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CloudRepository } from '../src/db/repository.ts';
import { createRouter } from '../src/index.ts';
import { base64UrlEncode, type JWKKey } from '../src/auth/access.ts';
import { BIOSCULPTURE_WORKSPACE_ID, type Env, type IDatabaseBinding } from '../src/types.ts';
import type { ErrorResponseBody } from '../src/errors.ts';

type SqliteBindValue = string | number | bigint | boolean | null | Uint8Array;

interface DatabaseRow {
  [column: string]: unknown;
}

function createInMemoryD1(migrationSql: string): { db: Database; d1: IDatabaseBinding } {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(migrationSql);

  const d1: IDatabaseBinding = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T = unknown>(colName?: string): Promise<T | null> {
              const stmt = db.prepare(query);
              const row = stmt.get(...(values as SqliteBindValue[]));
              if (!row || typeof row !== 'object') return null;
              if (colName) {
                const map = row as DatabaseRow;
                return (map[colName] as T) ?? null;
              }
              return row as T;
            },
            async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
              const stmt = db.prepare(query);
              const rows = stmt.all(...(values as SqliteBindValue[])) as T[];
              return { results: rows, success: true };
            },
            async run(): Promise<{ success: boolean; meta?: unknown }> {
              const stmt = db.prepare(query);
              stmt.run(...(values as SqliteBindValue[]));
              return { success: true };
            },
          };
        },
      };
    },
  };

  return { db, d1 };
}

// Test RSA Keypair for signing test Access JWTs
let testPrivateKey: CryptoKey;
let testPublicKeyJwk: JWKKey;
const TEST_KID = 'test-access-key-1';
const TEST_AUDIENCE = 'test-aud-12345';
const TEST_ISSUER = 'https://biosculpture-test.cloudflareaccess.com';

async function createSignedAccessJWT(
  payload: Record<string, unknown>,
  headerOverrides: Record<string, unknown> = {},
  key: CryptoKey = testPrivateKey
): Promise<string> {
  const header = {
    alg: 'RS256',
    kid: TEST_KID,
    typ: 'JWT',
    ...headerOverrides,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    dataToSign
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

describe('Access Identity & Turnstile Onboarding', () => {
  let env: Env;
  let repo: CloudRepository;
  let migrationSql: string;

  beforeAll(async () => {
    // Generate RSA-2048 keypair for cryptographic testing
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
    testPrivateKey = keyPair.privateKey;
    const exportedJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    testPublicKeyJwk = {
      ...exportedJwk,
      kid: TEST_KID,
      alg: 'RS256',
      use: 'sig',
    };
  });

  beforeEach(() => {
    migrationSql = readFileSync(
      join(import.meta.dir, '../migrations/0001_biosculpture_workspace.sql'),
      'utf-8'
    );
    const inMem = createInMemoryD1(migrationSql);
    env = {
      DB: inMem.d1,
      ALLOWED_EMAIL_DOMAIN: 'biosculpture.com',
      ACCESS_AUDIENCE: TEST_AUDIENCE,
      ACCESS_TEAM_DOMAIN: 'biosculpture-test',
      TURNSTILE_SECRET: 'test-turnstile-secret',
      PRODUCTION_HOSTNAME: 'canvas.biosculpture.com',
    };
    repo = new CloudRepository(env.DB);
  });

  describe('Cloudflare Access Verification & Domain Guard', () => {
    it('rejects requests without Cf-Access-Jwt-Assertion header', async () => {
      const router = createRouter(env, {
        authOptions: { accessOptions: { jwks: [testPublicKeyJwk] } },
        repo,
      });

      const res = await router(new Request('https://canvas.biosculpture.com/api/session/me'));
      expect(res.status).toBe(401);

      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('unauthenticated');
    });

    it('rejects expired Access assertions', async () => {
      const expiredPayload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user1',
        email: 'artist@biosculpture.com',
        name: 'Artist One',
        exp: Math.floor(Date.now() / 1000) - 300, // 5 min ago
        iat: Math.floor(Date.now() / 1000) - 600,
      };

      const token = await createSignedAccessJWT(expiredPayload);
      const router = createRouter(env, {
        authOptions: {
          accessOptions: { jwks: [testPublicKeyJwk], clockSkewSeconds: 0 },
        },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/me', {
        headers: { 'Cf-Access-Jwt-Assertion': token },
      });

      const res = await router(req);
      expect(res.status).toBe(401);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('unauthenticated');
      expect(body.error.message).toContain('expired');
    });

    it('rejects assertions with mismatched audience', async () => {
      const wrongAudPayload = {
        iss: TEST_ISSUER,
        aud: 'wrong-aud-999',
        sub: 'user1',
        email: 'artist@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(wrongAudPayload);
      const router = createRouter(env, {
        authOptions: { accessOptions: { jwks: [testPublicKeyJwk] } },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/me', {
        headers: { 'Cf-Access-Jwt-Assertion': token },
      });

      const res = await router(req);
      expect(res.status).toBe(403);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('forbidden');
      expect(body.error.message).toContain('audience mismatch');
    });

    it('rejects forged assertions with invalid signatures', async () => {
      // Create a second key pair that is not in JWKS
      const forgedKeyPair = await crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
      );

      const validPayload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user1',
        email: 'artist@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      // Sign with unknown private key
      const forgedToken = await createSignedAccessJWT(
        validPayload,
        {},
        forgedKeyPair.privateKey
      );

      const router = createRouter(env, {
        authOptions: { accessOptions: { jwks: [testPublicKeyJwk] } },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/me', {
        headers: { 'Cf-Access-Jwt-Assertion': forgedToken },
      });

      const res = await router(req);
      expect(res.status).toBe(401);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('unauthenticated');
      expect(body.error.message).toContain('Invalid Cloudflare Access assertion signature');
    });

    it('rejects lookalike email domains and external emails', async () => {
      const maliciousEmails = [
        'person@biosculpture.com.attacker.test',
        'person@attacker.biosculpture.com',
        'person@fakebiosculpture.com',
        'person@notbiosculpture.com',
        'person@gmail.com',
      ];

      for (const email of maliciousEmails) {
        const payload = {
          iss: TEST_ISSUER,
          aud: TEST_AUDIENCE,
          sub: 'user1',
          email,
          exp: Math.floor(Date.now() / 1000) + 3600,
        };

        const token = await createSignedAccessJWT(payload);
        const router = createRouter(env, {
          authOptions: { accessOptions: { jwks: [testPublicKeyJwk] } },
          repo,
        });

        const req = new Request('https://canvas.biosculpture.com/api/session/me', {
          headers: { 'Cf-Access-Jwt-Assertion': token },
        });

        const res = await router(req);
        expect(res.status).toBe(403);
        const body = (await res.json()) as ErrorResponseBody;
        expect(body.error.code).toBe('forbidden');
        expect(body.error.message).toContain('Access restricted to @biosculpture.com');
      }
    });

    it('returns needsBootstrap for a valid @biosculpture.com user on first login', async () => {
      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user1',
        email: 'newartist@biosculpture.com',
        name: 'New Artist',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);
      const router = createRouter(env, {
        authOptions: { accessOptions: { jwks: [testPublicKeyJwk] } },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/me', {
        headers: { 'Cf-Access-Jwt-Assertion': token },
      });

      const res = await router(req);
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        user: null;
        needsBootstrap: boolean;
        email: string;
        suggestedName: string;
      };
      expect(body.user).toBeNull();
      expect(body.needsBootstrap).toBe(true);
      expect(body.email).toBe('newartist@biosculpture.com');
      expect(body.suggestedName).toBe('New Artist');
    });

    it('returns 403 Forbidden for suspended members and prevents access', async () => {
      // Create user and mark status as suspended
      const user = await repo.createOrUpdateUser({
        id: 'usr_suspended_1',
        email: 'suspended@biosculpture.com',
        name: 'Suspended Member',
        role: 'member',
      });

      // Update workspace membership status to suspended
      await env.DB.prepare(
        'UPDATE workspace_members SET status = ? WHERE user_id = ? AND workspace_id = ?'
      )
        .bind('suspended', user.id, BIOSCULPTURE_WORKSPACE_ID)
        .run();

      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: user.id,
        email: 'suspended@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);
      const router = createRouter(env, {
        authOptions: { accessOptions: { jwks: [testPublicKeyJwk] } },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/me', {
        headers: { 'Cf-Access-Jwt-Assertion': token },
      });

      const res = await router(req);
      expect(res.status).toBe(403);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('forbidden');
      expect(body.error.message).toContain('suspended');
    });
  });

  describe('Turnstile-Gated First-Login Bootstrap', () => {
    it('successfully bootstraps a new user profile with valid Turnstile verification', async () => {
      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user_first_login',
        email: 'designer@biosculpture.com',
        name: 'Initial Name',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);

      // Mock Turnstile fetch returning success
      const mockTurnstileFetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            challenge_ts: new Date().toISOString(),
            hostname: 'canvas.biosculpture.com',
            action: 'signup',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const router = createRouter(env, {
        authOptions: {
          accessOptions: { jwks: [testPublicKeyJwk] },
          turnstileFetchFn: mockTurnstileFetch as typeof fetch,
        },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/bootstrap', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnstileToken: 'valid_turnstile_token_123',
          displayName: 'Sarah Designer',
        }),
      });

      const res = await router(req);
      expect(res.status).toBe(201);

      const body = (await res.json()) as {
        user: { id: string; email: string; displayName: string; role: string };
      };
      expect(body.user.email).toBe('designer@biosculpture.com');
      expect(body.user.displayName).toBe('Sarah Designer');
      expect(body.user.role).toBe('member');

      // Subsequent call to /api/session/me now returns active authenticated user
      const meReq = new Request('https://canvas.biosculpture.com/api/session/me', {
        headers: { 'Cf-Access-Jwt-Assertion': token },
      });
      const meRes = await router(meReq);
      expect(meRes.status).toBe(200);
      const meBody = (await meRes.json()) as { user: { email: string; displayName: string } };
      expect(meBody.user.email).toBe('designer@biosculpture.com');
      expect(meBody.user.displayName).toBe('Sarah Designer');
    });

    it('provisions exactly once: repeated bootstrap returns existing active user', async () => {
      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user_repeat',
        email: 'repeat@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);

      const mockTurnstileFetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            hostname: 'canvas.biosculpture.com',
            action: 'signup',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const router = createRouter(env, {
        authOptions: {
          accessOptions: { jwks: [testPublicKeyJwk] },
          turnstileFetchFn: mockTurnstileFetch as typeof fetch,
        },
        repo,
      });

      // 1st Bootstrap
      const req1 = new Request('https://canvas.biosculpture.com/api/session/bootstrap', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnstileToken: 'token_1',
          displayName: 'First Name',
        }),
      });
      const res1 = await router(req1);
      expect(res1.status).toBe(201);
      const body1 = (await res1.json()) as { user: { id: string } };

      // 2nd Bootstrap with same Access assertion
      const req2 = new Request('https://canvas.biosculpture.com/api/session/bootstrap', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnstileToken: 'token_2',
          displayName: 'Updated Name',
        }),
      });
      const res2 = await router(req2);
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as { user: { id: string; displayName: string } };

      // ID remains stable
      expect(body2.user.id).toBe(body1.user.id);
      expect(body2.user.displayName).toBe('Updated Name');
    });

    it('rejects bootstrap when Turnstile validation fails', async () => {
      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user_fail',
        email: 'fail@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);

      // Turnstile returns success: false
      const mockTurnstileFetch = async () => {
        return new Response(
          JSON.stringify({
            success: false,
            'error-codes': ['invalid-input-response'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const router = createRouter(env, {
        authOptions: {
          accessOptions: { jwks: [testPublicKeyJwk] },
          turnstileFetchFn: mockTurnstileFetch as typeof fetch,
        },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/bootstrap', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnstileToken: 'bad_token',
        }),
      });

      const res = await router(req);
      expect(res.status).toBe(403);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('forbidden');
      expect(body.error.message).toContain('Turnstile challenge failed');
    });

    it('rejects bootstrap on Turnstile action mismatch', async () => {
      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user_action_mismatch',
        email: 'mismatch@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);

      // Turnstile action is 'login' instead of expected 'signup'
      const mockTurnstileFetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            action: 'login',
            hostname: 'canvas.biosculpture.com',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const router = createRouter(env, {
        authOptions: {
          accessOptions: { jwks: [testPublicKeyJwk] },
          turnstileFetchFn: mockTurnstileFetch as typeof fetch,
        },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/bootstrap', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnstileToken: 'token_mismatch',
        }),
      });

      const res = await router(req);
      expect(res.status).toBe(403);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('forbidden');
      expect(body.error.message).toContain('action mismatch');
    });

    it('rejects bootstrap on Turnstile hostname mismatch', async () => {
      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user_hostname_mismatch',
        email: 'hostmismatch@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);

      // Turnstile hostname is attacker host
      const mockTurnstileFetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            action: 'signup',
            hostname: 'evil-phishing-site.test',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const router = createRouter(env, {
        authOptions: {
          accessOptions: { jwks: [testPublicKeyJwk] },
          turnstileFetchFn: mockTurnstileFetch as typeof fetch,
        },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/bootstrap', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnstileToken: 'token_host_mismatch',
        }),
      });

      const res = await router(req);
      expect(res.status).toBe(403);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('forbidden');
      expect(body.error.message).toContain('hostname mismatch');
    });

    it('fails closed when Turnstile upstream service is unreachable or non-JSON', async () => {
      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'user_upstream_err',
        email: 'upstream@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);

      // Network error simulation
      const mockTurnstileFetch = async () => {
        throw new Error('Connection reset by peer');
      };

      const router = createRouter(env, {
        authOptions: {
          accessOptions: { jwks: [testPublicKeyJwk] },
          turnstileFetchFn: mockTurnstileFetch as typeof fetch,
        },
        repo,
      });

      const req = new Request('https://canvas.biosculpture.com/api/session/bootstrap', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnstileToken: 'token_upstream_err',
        }),
      });

      const res = await router(req);
      expect(res.status).toBe(503);
      const body = (await res.json()) as ErrorResponseBody;
      expect(body.error.code).toBe('upstream_unavailable');
    });

    it('never trusts an email supplied in client JSON: Access assertion is the sole authority', async () => {
      const payload = {
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        sub: 'real_user',
        email: 'real.user@biosculpture.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await createSignedAccessJWT(payload);

      const mockTurnstileFetch = async () => {
        return new Response(
          JSON.stringify({
            success: true,
            action: 'signup',
            hostname: 'canvas.biosculpture.com',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const router = createRouter(env, {
        authOptions: {
          accessOptions: { jwks: [testPublicKeyJwk] },
          turnstileFetchFn: mockTurnstileFetch as typeof fetch,
        },
        repo,
      });

      // Attacker tries to inject a different email in the JSON body
      const req = new Request('https://canvas.biosculpture.com/api/session/bootstrap', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          turnstileToken: 'valid_token',
          email: 'victim.admin@biosculpture.com', // Must be ignored!
          displayName: 'Real User',
        }),
      });

      const res = await router(req);
      expect(res.status).toBe(201);
      const body = (await res.json()) as { user: { email: string } };

      // Result MUST be real.user@biosculpture.com from Access assertion
      expect(body.user.email).toBe('real.user@biosculpture.com');
    });
  });
});
