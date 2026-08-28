// Domain and environment types for @open-pencil/cloud

export const BIOSCULPTURE_WORKSPACE_ID = 'ws_biosculpture_default';
export const DEFAULT_ALLOWED_EMAIL_DOMAIN = 'biosculpture.com';

export type UserRole = 'member' | 'admin';
export type MemberStatus = 'active' | 'suspended';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: UserRole;
  status: MemberStatus;
  joinedAt: string;
}

export interface UserWithMembership extends User {
  role: UserRole;
  status: MemberStatus;
}

export interface ProjectFolder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  dropboxFolderId: string | null;
  dropboxPath: string | null;
  createdAt: string;
  archivedAt: string | null;
}

export interface Project {
  id: string;
  workspaceId: string;
  folderId: string | null;
  name: string;
  dropboxFileId: string | null;
  dropboxRev: string | null;
  currentStateVector: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface AuditEvent {
  id: string;
  workspaceId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  detailsJson: string | null;
  createdAt: string;
}

export interface IDatabaseBinding {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = unknown>(colName?: string): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
      run(): Promise<{ success: boolean; meta?: unknown }>;
    };
  };
}

export interface IDurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): unknown;
}

export interface Env {
  DB: IDatabaseBinding;
  PROJECT_ROOM?: IDurableObjectNamespace;
  ALLOWED_EMAIL_DOMAIN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUDIENCE?: string;
  ACCESS_CERTS_URL?: string;
  DROPBOX_CLIENT_ID?: string;
  DROPBOX_CLIENT_SECRET?: string;
  DROPBOX_REFRESH_TOKEN?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_SITEVERIFY_URL?: string;
  PRODUCTION_HOSTNAME?: string;
  ENVIRONMENT?: string;
}
