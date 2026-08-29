import { createDirectDropboxStorageAdapter } from './dropbox/adapter'
import { defineStorageProvider, StorageProviderRegistry } from './registry'
import { createS3StorageAdapter } from './s3/adapter'

export const S3_STORAGE_PROVIDER = defineStorageProvider({
  id: 's3-compatible',
  label: 'S3 storage',
  description: 'AWS S3, Backblaze B2, Cloudflare R2, MinIO, and compatible storage',
  preferenceFields: [
    { id: 'endpoint', label: 'Endpoint', kind: 'url', required: true },
    { id: 'bucket', label: 'Bucket', kind: 'text', required: true },
    { id: 'region', label: 'Region', kind: 'text' }
  ],
  credentialFields: [
    { id: 'access-key-id', label: 'Access key ID', required: true },
    { id: 'secret-access-key', label: 'Secret access key', required: true }
  ],
  createAdapter: createS3StorageAdapter
})

export const DROPBOX_STORAGE_PROVIDER = defineStorageProvider({
  id: 'dropbox',
  label: 'Dropbox',
  description: 'Personal or scoped Dropbox App folder storage with direct OAuth sync',
  preferenceFields: [],
  credentialFields: [
    { id: 'app-key', label: 'App key', required: true, placeholder: 'Dropbox App key' },
    { id: 'app-secret', label: 'App secret', required: true, placeholder: 'Dropbox App secret' },
    { id: 'refresh-token', label: 'Refresh token', required: true, placeholder: 'Dropbox offline refresh token' }
  ],
  createAdapter: createDirectDropboxStorageAdapter
})

export const storageProviderRegistry = new StorageProviderRegistry([
  DROPBOX_STORAGE_PROVIDER,
  S3_STORAGE_PROVIDER
])
