export interface DropboxEntry {
  '.tag': 'file' | 'folder' | 'deleted';
  id: string;
  name: string;
  path_lower?: string;
  path_display?: string;
  rev?: string;
  size?: number;
  server_modified?: string;
}

export interface DropboxListFolderResult {
  entries: DropboxEntry[];
  cursor: string;
  has_more: boolean;
}

export interface DropboxFileMetadata {
  '.tag': 'file';
  id: string;
  name: string;
  path_lower?: string;
  path_display?: string;
  rev: string;
  size: number;
  server_modified?: string;
}
