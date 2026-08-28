// Cloudflare Turnstile Server-Side Siteverify validation for @open-pencil/cloud

import { APIError } from '../errors.ts';

export const DEFAULT_TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyParams {
  token: string;
  secretKey: string;
  remoteIp?: string | null;
  expectedAction?: string;
  expectedHostname?: string;
  siteverifyUrl?: string;
  fetchFn?: typeof fetch;
}

export interface TurnstileVerifyResult {
  success: boolean;
  challengeTs?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

interface CloudflareTurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export async function verifyTurnstileToken(params: TurnstileVerifyParams): Promise<TurnstileVerifyResult> {
  const {
    token,
    secretKey,
    remoteIp,
    expectedAction = 'signup',
    expectedHostname,
    siteverifyUrl = DEFAULT_TURNSTILE_SITEVERIFY_URL,
    fetchFn = fetch,
  } = params;

  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw APIError.invalidRequest('Missing or empty Turnstile challenge token');
  }

  if (!secretKey || typeof secretKey !== 'string' || secretKey.trim() === '') {
    throw APIError.internal('Turnstile secret key is not configured');
  }

  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token.trim());
  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }

  let response: Response;
  try {
    response = await fetchFn(siteverifyUrl, {
      method: 'POST',
      body: formData,
    });
  } catch (err: unknown) {
    // Fail closed on network error / timeout
    throw APIError.upstreamUnavailable('Cloudflare Turnstile verification service');
  }

  if (!response.ok) {
    throw APIError.upstreamUnavailable(`Turnstile verification returned HTTP ${response.status}`);
  }

  let data: CloudflareTurnstileResponse;
  try {
    data = (await response.json()) as CloudflareTurnstileResponse;
  } catch {
    // Fail closed on non-JSON response
    throw APIError.upstreamUnavailable('Turnstile returned non-JSON response');
  }

  if (!data || typeof data !== 'object' || data.success !== true) {
    const errorCodes = Array.isArray(data?.['error-codes']) ? data['error-codes'].join(', ') : 'unknown';
    throw APIError.forbidden(`Turnstile challenge failed: ${errorCodes}`, {
      errorCodes: data?.['error-codes'],
    });
  }

  // Validate Action
  if (expectedAction) {
    if (data.action && data.action !== expectedAction) {
      throw APIError.forbidden(
        `Turnstile action mismatch: expected '${expectedAction}', received '${data.action}'`
      );
    }
  }

  // Validate Hostname
  if (expectedHostname) {
    if (data.hostname && data.hostname !== expectedHostname) {
      throw APIError.forbidden(
        `Turnstile hostname mismatch: expected '${expectedHostname}', received '${data.hostname}'`
      );
    }
  }

  return {
    success: true,
    challengeTs: data.challenge_ts,
    hostname: data.hostname,
    action: data.action,
    cdata: data.cdata,
  };
}
