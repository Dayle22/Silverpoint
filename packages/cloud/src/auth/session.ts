// Session lookup and onboarding bootstrap handlers for @open-pencil/cloud

import {
  type Env,
  BIOSCULPTURE_WORKSPACE_ID,
  type AuthenticatedUser,
} from '../types.ts';
import { APIError, jsonResponse } from '../errors.ts';
import { CloudRepository } from '../db/repository.ts';
import { verifyAccessAssertion, type AccessVerifyOptions } from './access.ts';
import { verifyTurnstileToken, type TurnstileVerifyParams } from './turnstile.ts';

export interface BootstrapRequestBody {
  turnstileToken: string;
  displayName?: string;
}

export interface SessionMeResponse {
  user: AuthenticatedUser | null;
  needsBootstrap?: boolean;
  email?: string;
  suggestedName?: string;
}

export interface SessionBootstrapResponse {
  user: AuthenticatedUser;
}

export interface RouteAuthOptions {
  accessOptions?: AccessVerifyOptions;
  turnstileFetchFn?: typeof fetch;
}

export function extractAccessAssertionHeader(request: Request): string | null {
  return (
    request.headers.get('cf-access-jwt-assertion') ||
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    null
  );
}

export async function authenticateUser(
  request: Request,
  env: Env,
  repo: CloudRepository,
  options?: RouteAuthOptions
): Promise<AuthenticatedUser> {
  const assertion = extractAccessAssertionHeader(request);
  if (!assertion) {
    throw APIError.unauthenticated('Missing Cloudflare Access assertion header');
  }

  const verifiedIdentity = await verifyAccessAssertion(assertion, env, options?.accessOptions);
  const existingUser = await repo.getUserByEmail(verifiedIdentity.email);

  if (!existingUser) {
    throw APIError.unauthenticated('User has not completed workspace onboarding');
  }

  const membership = await repo.getUserWithMembership(existingUser.id, BIOSCULPTURE_WORKSPACE_ID);
  if (!membership) {
    throw APIError.unauthenticated('Workspace membership not found');
  }

  if (membership.status === 'suspended') {
    throw APIError.forbidden('Your Bio Sculpture workspace account is suspended');
  }

  return {
    id: existingUser.id,
    email: existingUser.email,
    displayName: existingUser.name,
    role: membership.role,
  };
}


export async function handleGetSessionMe(
  request: Request,
  env: Env,
  repo: CloudRepository,
  options?: RouteAuthOptions
): Promise<Response> {
  const assertion = extractAccessAssertionHeader(request);
  if (!assertion) {
    throw APIError.unauthenticated('Missing Cloudflare Access assertion header');
  }

  // Cryptographically verify the Access assertion and validate email domain
  const verifiedIdentity = await verifyAccessAssertion(assertion, env, options?.accessOptions);

  // Look up user in D1 repository
  const existingUser = await repo.getUserByEmail(verifiedIdentity.email);

  if (!existingUser) {
    // User does not yet exist in Bio Sculpture workspace; prompt bootstrap
    const responseBody: SessionMeResponse = {
      user: null,
      needsBootstrap: true,
      email: verifiedIdentity.email,
      suggestedName: verifiedIdentity.name,
    };
    return jsonResponse(responseBody);
  }

  // User exists - check workspace membership status
  const membership = await repo.getUserWithMembership(existingUser.id, BIOSCULPTURE_WORKSPACE_ID);
  if (!membership) {
    // Inconsistent state: user exists without membership row; prompt bootstrap
    const responseBody: SessionMeResponse = {
      user: null,
      needsBootstrap: true,
      email: verifiedIdentity.email,
      suggestedName: existingUser.name || verifiedIdentity.name,
    };
    return jsonResponse(responseBody);
  }

  if (membership.status === 'suspended') {
    throw APIError.forbidden('Your Bio Sculpture workspace account is suspended');
  }

  const authenticatedUser: AuthenticatedUser = {
    id: existingUser.id,
    email: existingUser.email,
    displayName: existingUser.name,
    role: membership.role,
  };

  return jsonResponse<SessionMeResponse>({ user: authenticatedUser });
}

export async function handlePostSessionBootstrap(
  request: Request,
  env: Env,
  repo: CloudRepository,
  body: BootstrapRequestBody,
  options?: RouteAuthOptions
): Promise<Response> {
  const assertion = extractAccessAssertionHeader(request);
  if (!assertion) {
    throw APIError.unauthenticated('Missing Cloudflare Access assertion header');
  }

  // 1. Cryptographically verify Access assertion first (Authority is Access, not client JSON)
  const verifiedIdentity = await verifyAccessAssertion(assertion, env, options?.accessOptions);

  // 2. Validate Turnstile token is present
  if (!body.turnstileToken || typeof body.turnstileToken !== 'string' || body.turnstileToken.trim() === '') {
    throw APIError.invalidRequest('Turnstile token is required for profile bootstrap');
  }

  // 3. Verify Turnstile token with Cloudflare Siteverify
  const turnstileParams: TurnstileVerifyParams = {
    token: body.turnstileToken.trim(),
    secretKey: env.TURNSTILE_SECRET || 'test_turnstile_secret',
    remoteIp: request.headers.get('cf-connecting-ip'),
    expectedAction: 'signup',
    expectedHostname: env.PRODUCTION_HOSTNAME,
    siteverifyUrl: env.TURNSTILE_SITEVERIFY_URL,
    fetchFn: options?.turnstileFetchFn,
  };

  await verifyTurnstileToken(turnstileParams);

  // 4. Check if user already exists
  const existingUser = await repo.getUserByEmail(verifiedIdentity.email);

  if (existingUser) {
    const membership = await repo.getUserWithMembership(existingUser.id, BIOSCULPTURE_WORKSPACE_ID);
    if (membership?.status === 'suspended') {
      throw APIError.forbidden('Your Bio Sculpture workspace account is suspended');
    }

    // Update display name if user provided a new one
    const updatedName = body.displayName?.trim() || existingUser.name || verifiedIdentity.name;
    const userWithMembership = await repo.createOrUpdateUser({
      id: existingUser.id,
      email: verifiedIdentity.email,
      name: updatedName,
      role: membership?.role || 'member',
      workspaceId: BIOSCULPTURE_WORKSPACE_ID,
    });

    return jsonResponse<SessionBootstrapResponse>({
      user: {
        id: userWithMembership.id,
        email: userWithMembership.email,
        displayName: userWithMembership.name,
        role: userWithMembership.role,
      },
    });
  }

  // 5. Provision brand new user in D1
  const newUserId = `usr_${crypto.randomUUID().replace(/-/g, '')}`;
  const displayName = body.displayName?.trim() || verifiedIdentity.name || verifiedIdentity.email.split('@')[0];

  const newUserWithMembership = await repo.createOrUpdateUser({
    id: newUserId,
    email: verifiedIdentity.email,
    name: displayName,
    role: 'member',
    workspaceId: BIOSCULPTURE_WORKSPACE_ID,
  });

  // 6. Record audit event
  await repo.recordAuditEvent({
    id: `aud_${crypto.randomUUID().replace(/-/g, '')}`,
    workspaceId: BIOSCULPTURE_WORKSPACE_ID,
    actorId: newUserWithMembership.id,
    action: 'user.bootstrap',
    targetType: 'user',
    targetId: newUserWithMembership.id,
    detailsJson: JSON.stringify({
      email: verifiedIdentity.email,
      name: displayName,
    }),
  });

  return jsonResponse<SessionBootstrapResponse>(
    {
      user: {
        id: newUserWithMembership.id,
        email: newUserWithMembership.email,
        displayName: newUserWithMembership.name,
        role: newUserWithMembership.role,
      },
    },
    201
  );
}
