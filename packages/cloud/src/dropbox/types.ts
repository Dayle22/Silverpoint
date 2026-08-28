// Types and path contracts for Dropbox Repository integration

export interface DropboxConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenUrl?: string;
  apiBaseUrl?: string;
  contentBaseUrl?: string;
  fetchFn?: typeof fetch;
}

export type DropboxEntryTag = 'file' | 'folder' | 'deleted';

export interface DropboxMetadata {
  '.tag': DropboxEntryTag;
  id: string;
  name: string;
  path_lower?: string;
  path_display?: string;
}

export interface DropboxFolderMetadata extends DropboxMetadata {
  '.tag': 'folder';
}

export interface DropboxFileMetadata extends DropboxMetadata {
  '.tag': 'file';
  rev: string;
  size: number;
  client_modified?: string;
  server_modified?: string;
  content_hash?: string;
}

export type DropboxEntry = DropboxFolderMetadata | DropboxFileMetadata | DropboxMetadata;

export interface DropboxListFolderResult {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
}

export type DropboxUploadMode =
  | { '.tag': 'add' }
  | { '.tag': 'overwrite' }
  | { '.tag': 'update'; update: string };

export interface DropboxUploadParams {
  path: string;
  mode?: DropboxUploadMode;
  autorename?: boolean;
  mute?: boolean;
}

export interface DropboxDownloadResult {
  metadata: DropboxFileMetadata;
  content: Uint8Array;
}

export interface ProjectJsonManifest {
  id: string;
  name: string;
  folderId: string;
  workspaceId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// Managed Dropbox App Folder Path Helpers
export const MANAGED_PROJECTS_ROOT = '/Projects';

export function getManagedFolderPath(folderId: string): string {
  const sanitized = folderId.replace(/^\/+|\/+$/g, '');
  return `${MANAGED_PROJECTS_ROOT}/${sanitized}`;
}

export function getManagedProjectFolderPath(folderId: string, projectId: string): string {
  const sanitizedFolder = folderId.replace(/^\/+|\/+$/g, '');
  const sanitizedProj = projectId.replace(/^\/+|\/+$/g, '');
  return `${MANAGED_PROJECTS_ROOT}/${sanitizedFolder}/${sanitizedProj}`;
}

export function getManagedCurrentFigPath(folderId: string, projectId: string): string {
  return `${getManagedProjectFolderPath(folderId, projectId)}/current.fig`;
}

export function getManagedThumbnailPath(folderId: string, projectId: string): string {
  return `${getManagedProjectFolderPath(folderId, projectId)}/current.thumb.jpg`;
}

export function getManagedProjectJsonPath(folderId: string, projectId: string): string {
  return `${getManagedProjectFolderPath(folderId, projectId)}/project.json`;
}

export function getManagedVersionFigPath(folderId: string, projectId: string, versionId: string): string {
  const sanitizedVer = versionId.replace(/^\/+|\/+$/g, '');
  return `${getManagedProjectFolderPath(folderId, projectId)}/versions/${sanitizedVer}.fig`;
}
