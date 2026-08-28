// Serialization and byte utilities for @open-pencil/cloud room collaboration

import * as Y from 'yjs';

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64(str: string): Uint8Array {
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

export function toUint8Array(data: string | number[] | Uint8Array | ArrayBuffer): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  if (typeof data === 'string') {
    return decodeBase64(data);
  }
  throw new Error('Unsupported data type for Uint8Array conversion');
}

export function safeParseJSON<T = unknown>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Checks if a client's state vector contains all the state in the canonical ydoc.
 * In Yjs, Y.encodeStateAsUpdate(ydoc, clientVector) returns the missing diff.
 * An empty Yjs update is exactly 2 bytes: [0, 0].
 */
export function isStateVectorCurrent(ydoc: Y.Doc, clientVector: Uint8Array): boolean {
  try {
    const diff = Y.encodeStateAsUpdate(ydoc, clientVector);
    return diff.length <= 2;
  } catch {
    return false;
  }
}
