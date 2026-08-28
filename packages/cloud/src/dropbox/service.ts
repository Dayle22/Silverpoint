// Dropbox and D1 Repository Service for Projects, Folders, Snapshots and Thumbnails

import {
  BIOSCULPTURE_WORKSPACE_ID,
  type ProjectFolder,
  type Project,
  type UserRole,
} from '../types.ts';
import { APIError } from '../errors.ts';
import { CloudRepository } from '../db/repository.ts';
import type { IDropboxClient } from './client.ts';
import {
  getManagedFolderPath,
  getManagedCurrentFigPath,
  getManagedThumbnailPath,
  getManagedProjectJsonPath,
  getManagedVersionFigPath,
  type ProjectJsonManifest,
} from './types.ts';

export interface CreateFolderParams {
  name: string;
  parentId?: string | null;
  workspaceId?: string;
  actorId: string;
}

export interface CreateProjectParams {
  name: string;
  folderId: string;
  workspaceId?: string;
  actorId: string;
  initialFig?: Uint8Array;
  initialThumb?: Uint8Array;
}

export interface UpdateSnapshotParams {
  bytes: Uint8Array;
  expectedRev: string;
  stateVector?: string | null;
  actorId: string;
  retainVersion?: boolean;
}

export class DropboxRepositoryService {
  constructor(
    private readonly repo: CloudRepository,
    private readonly dropbox: IDropboxClient
  ) {}

  // Folder Operations
  async listFolders(workspaceId = BIOSCULPTURE_WORKSPACE_ID): Promise<ProjectFolder[]> {
    return await this.repo.listFolders(workspaceId, false);
  }

  async createFolder(params: CreateFolderParams): Promise<ProjectFolder> {
    const name = params.name?.trim();
    if (!name) {
      throw APIError.invalidRequest('Folder name is required');
    }

    const workspaceId = params.workspaceId || BIOSCULPTURE_WORKSPACE_ID;
    const parentId = params.parentId || null;

    if (parentId) {
      const parent = await this.repo.getFolderById(parentId);
      if (!parent || parent.archivedAt) {
        throw APIError.notFound('Parent folder not found');
      }
    }

    const folderId = `fld_${crypto.randomUUID().replace(/-/g, '')}`;
    const dropboxPath = getManagedFolderPath(folderId);

    // 1. Create in Dropbox App Folder
    const dbxFolder = await this.dropbox.createFolder(dropboxPath);

    // 2. Insert into D1
    let createdFolder: ProjectFolder;
    try {
      createdFolder = await this.repo.createFolder({
        id: folderId,
        workspaceId,
        parentId,
        name,
        dropboxFolderId: dbxFolder.id,
        dropboxPath: dbxFolder.path_display || dropboxPath,
      });
    } catch (err: unknown) {
      // Record compensating audit event and attempt cleanup
      await this.repo.recordAuditEvent({
        id: `aud_${crypto.randomUUID().replace(/-/g, '')}`,
        workspaceId,
        actorId: params.actorId,
        action: 'folder.create_failed_compensation',
        targetType: 'folder',
        targetId: folderId,
        detailsJson: JSON.stringify({
          error: String(err),
          dropboxFolderId: dbxFolder.id,
        }),
      });

      try {
        await this.dropbox.deletePath(dbxFolder.id);
      } catch {
        // Suppress cleanup failure to surface original error
      }
      throw err;
    }

    // 3. Record success audit event
    await this.repo.recordAuditEvent({
      id: `aud_${crypto.randomUUID().replace(/-/g, '')}`,
      workspaceId,
      actorId: params.actorId,
      action: 'folder.create',
      targetType: 'folder',
      targetId: folderId,
      detailsJson: JSON.stringify({
        name,
        parentId,
        dropboxFolderId: dbxFolder.id,
      }),
    });

    return createdFolder;
  }

  // Project Operations
  async listProjects(
    workspaceId = BIOSCULPTURE_WORKSPACE_ID,
    folderId?: string | null
  ): Promise<Project[]> {
    return await this.repo.listProjects(workspaceId, folderId, false);
  }

  async getProjectById(projectId: string): Promise<Project> {
    const project = await this.repo.getProjectById(projectId);
    if (!project || project.archivedAt) {
      throw APIError.notFound(`Project '${projectId}' not found`);
    }
    return project;
  }

  async createProject(params: CreateProjectParams): Promise<Project> {
    const name = params.name?.trim();
    if (!name) {
      throw APIError.invalidRequest('Project name is required');
    }

    const folderId = params.folderId?.trim();
    if (!folderId) {
      throw APIError.invalidRequest('folderId is required for project creation');
    }

    const folder = await this.repo.getFolderById(folderId);
    if (!folder || folder.archivedAt) {
      throw APIError.notFound('Target folder not found');
    }

    const workspaceId = params.workspaceId || BIOSCULPTURE_WORKSPACE_ID;
    const projectId = `prj_${crypto.randomUUID().replace(/-/g, '')}`;
    const now = new Date().toISOString();

    const manifestPath = getManagedProjectJsonPath(folderId, projectId);
    const figPath = getManagedCurrentFigPath(folderId, projectId);
    const thumbPath = getManagedThumbnailPath(folderId, projectId);

    const manifest: ProjectJsonManifest = {
      id: projectId,
      name,
      folderId,
      workspaceId,
      createdBy: params.actorId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    let uploadedFigMeta: { id: string; rev: string } | null = null;
    let initialFigBytes = params.initialFig;
    if (!initialFigBytes || initialFigBytes.length === 0) {
      // Empty minimal binary placeholder for new .fig
      initialFigBytes = new TextEncoder().encode('FIGMA_EMPTY_CANVAS_V1');
    }

    try {
      // 1. Upload manifest
      await this.dropbox.uploadFile(
        manifestPath,
        JSON.stringify(manifest, null, 2),
        { '.tag': 'add' }
      );

      // 2. Upload initial snapshot
      uploadedFigMeta = await this.dropbox.uploadFile(
        figPath,
        initialFigBytes,
        { '.tag': 'add' }
      );

      // 3. Upload thumbnail if provided
      if (params.initialThumb && params.initialThumb.length > 0) {
        await this.dropbox.uploadFile(
          thumbPath,
          params.initialThumb,
          { '.tag': 'add' }
        );
      }
    } catch (err: unknown) {
      if (err instanceof APIError) throw err;
      throw APIError.upstreamUnavailable('Failed to initialize project files in Dropbox');
    }

    // 4. Save metadata to D1
    let createdProject: Project;
    try {
      createdProject = await this.repo.createProject({
        id: projectId,
        workspaceId,
        folderId,
        name,
        dropboxFileId: uploadedFigMeta.id,
        dropboxRev: uploadedFigMeta.rev,
        currentStateVector: null,
        createdBy: params.actorId,
      });
    } catch (err: unknown) {
      // Record compensating audit event and clean up Dropbox folder
      await this.repo.recordAuditEvent({
        id: `aud_${crypto.randomUUID().replace(/-/g, '')}`,
        workspaceId,
        actorId: params.actorId,
        action: 'project.create_failed_compensation',
        targetType: 'project',
        targetId: projectId,
        detailsJson: JSON.stringify({
          error: String(err),
          folderId,
          dropboxFileId: uploadedFigMeta?.id,
        }),
      });

      try {
        await this.dropbox.deletePath(figPath);
        await this.dropbox.deletePath(manifestPath);
        if (params.initialThumb) await this.dropbox.deletePath(thumbPath);
      } catch {
        // Suppress cleanup error
      }

      throw err;
    }

    // 5. Record success audit event
    await this.repo.recordAuditEvent({
      id: `aud_${crypto.randomUUID().replace(/-/g, '')}`,
      workspaceId,
      actorId: params.actorId,
      action: 'project.create',
      targetType: 'project',
      targetId: projectId,
      detailsJson: JSON.stringify({
        name,
        folderId,
        dropboxFileId: uploadedFigMeta.id,
        dropboxRev: uploadedFigMeta.rev,
      }),
    });

    return createdProject;
  }

  // Snapshot Operations
  async getSnapshot(projectId: string): Promise<{
    bytes: Uint8Array;
    rev: string;
    stateVector: string | null;
    name: string;
  }> {
    const project = await this.getProjectById(projectId);

    const downloadTarget = project.dropboxFileId || (project.folderId ? getManagedCurrentFigPath(project.folderId, project.id) : null);
    if (!downloadTarget) {
      throw APIError.notFound('Snapshot location missing for project');
    }

    const download = await this.dropbox.downloadFile(downloadTarget);
    return {
      bytes: download.content,
      rev: download.metadata.rev || project.dropboxRev || '',
      stateVector: project.currentStateVector,
      name: project.name,
    };
  }

  async updateSnapshot(
    projectId: string,
    params: UpdateSnapshotParams
  ): Promise<{ rev: string; stateVector: string | null }> {
    const project = await this.getProjectById(projectId);

    if (!params.expectedRev || typeof params.expectedRev !== 'string') {
      throw APIError.invalidRequest('expectedRev is required for snapshot update');
    }

    if (!params.bytes || params.bytes.length === 0) {
      throw APIError.invalidRequest('Snapshot content cannot be empty');
    }

    if (!project.folderId) {
      throw APIError.internal('Project has no associated folder for Dropbox path');
    }

    const figPath = getManagedCurrentFigPath(project.folderId, project.id);

    // 1. Optimistic concurrency upload with mode { '.tag': 'update', update: expectedRev }
    const updatedMeta = await this.dropbox.uploadFile(
      figPath,
      params.bytes,
      { '.tag': 'update', update: params.expectedRev }
    );

    // 2. Retain immutable version if requested
    if (params.retainVersion) {
      const versionId = `ver_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
      const versionPath = getManagedVersionFigPath(project.folderId, project.id, versionId);
      try {
        await this.dropbox.uploadFile(versionPath, params.bytes, { '.tag': 'add' });
      } catch {
        // Non-fatal if version archive fails
      }
    }

    // 3. Update D1 metadata
    const stateVector = params.stateVector !== undefined ? params.stateVector : project.currentStateVector;
    await this.repo.updateProjectRevision(project.id, updatedMeta.rev, stateVector);

    // 4. Record audit event
    await this.repo.recordAuditEvent({
      id: `aud_${crypto.randomUUID().replace(/-/g, '')}`,
      workspaceId: project.workspaceId,
      actorId: params.actorId,
      action: 'project.snapshot_update',
      targetType: 'project',
      targetId: project.id,
      detailsJson: JSON.stringify({
        prevRev: params.expectedRev,
        newRev: updatedMeta.rev,
        sizeBytes: params.bytes.byteLength,
      }),
    });

    return {
      rev: updatedMeta.rev,
      stateVector,
    };
  }

  // Thumbnail Operations
  async getThumbnail(projectId: string): Promise<{ bytes: Uint8Array; contentType: string }> {
    const project = await this.getProjectById(projectId);

    if (!project.folderId) {
      throw APIError.notFound('Thumbnail not found');
    }

    const thumbPath = getManagedThumbnailPath(project.folderId, project.id);
    try {
      const download = await this.dropbox.downloadFile(thumbPath);
      return {
        bytes: download.content,
        contentType: 'image/jpeg',
      };
    } catch (err: unknown) {
      if (err instanceof APIError && err.status === 404) {
        throw APIError.notFound('Thumbnail not found');
      }
      throw err;
    }
  }

  // Archive Operations
  async archiveProject(
    projectId: string,
    actorId: string,
    actorRole: UserRole
  ): Promise<{ success: boolean; id: string }> {
    if (actorRole !== 'admin') {
      throw APIError.forbidden('Admin role required to archive project');
    }

    const project = await this.getProjectById(projectId);

    // Archive in D1 (retains Dropbox content and audit trail)
    await this.repo.archiveProject(project.id);

    // Record audit event
    await this.repo.recordAuditEvent({
      id: `aud_${crypto.randomUUID().replace(/-/g, '')}`,
      workspaceId: project.workspaceId,
      actorId,
      action: 'project.archive',
      targetType: 'project',
      targetId: project.id,
      detailsJson: JSON.stringify({
        name: project.name,
        folderId: project.folderId,
      }),
    });

    return {
      success: true,
      id: project.id,
    };
  }
}
