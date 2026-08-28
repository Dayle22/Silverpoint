// D1 Database Repository Layer for @open-pencil/cloud

import {
  BIOSCULPTURE_WORKSPACE_ID,
  type User,
  type UserWithMembership,
  type UserRole,
  type MemberStatus,
  type ProjectFolder,
  type Project,
  type AuditEvent,
  type IDatabaseBinding,
} from '../types.ts';
import { APIError } from '../errors.ts';

export class CloudRepository {
  constructor(private readonly db: IDatabaseBinding) {}

  // User & Membership Methods
  async getUserByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const row = await this.db
      .prepare('SELECT id, email, name, created_at, last_seen_at FROM users WHERE email = ? COLLATE NOCASE')
      .bind(normalizedEmail)
      .first<{
        id: string;
        email: string;
        name: string;
        created_at: string;
        last_seen_at: string;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const row = await this.db
      .prepare('SELECT id, email, name, created_at, last_seen_at FROM users WHERE id = ?')
      .bind(id)
      .first<{
        id: string;
        email: string;
        name: string;
        created_at: string;
        last_seen_at: string;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    };
  }

  async getUserWithMembership(
    userId: string,
    workspaceId = BIOSCULPTURE_WORKSPACE_ID
  ): Promise<UserWithMembership | null> {
    const row = await this.db
      .prepare(`
        SELECT u.id, u.email, u.name, u.created_at, u.last_seen_at,
               wm.role, wm.status
        FROM users u
        INNER JOIN workspace_members wm ON u.id = wm.user_id
        WHERE u.id = ? AND wm.workspace_id = ?
      `)
      .bind(userId, workspaceId)
      .first<{
        id: string;
        email: string;
        name: string;
        created_at: string;
        last_seen_at: string;
        role: string;
        status: string;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      role: row.role as UserRole,
      status: row.status as MemberStatus,
    };
  }

  async createOrUpdateUser(params: {
    id: string;
    email: string;
    name: string;
    role?: UserRole;
    workspaceId?: string;
  }): Promise<UserWithMembership> {
    const workspaceId = params.workspaceId ?? BIOSCULPTURE_WORKSPACE_ID;
    const role = params.role ?? 'member';
    const normalizedEmail = params.email.trim().toLowerCase();
    const now = new Date().toISOString();

    const existing = await this.getUserByEmail(normalizedEmail);
    const userId = existing ? existing.id : params.id;

    if (existing) {
      await this.db
        .prepare('UPDATE users SET name = ?, last_seen_at = ? WHERE id = ?')
        .bind(params.name, now, userId)
        .run();
    } else {
      try {
        await this.db
          .prepare('INSERT INTO users (id, email, name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
          .bind(userId, normalizedEmail, params.name, now, now)
          .run();
      } catch (err: unknown) {
        if (String(err).includes('UNIQUE') || String(err).includes('uq_users_email')) {
          throw APIError.conflict(`User with email '${normalizedEmail}' already exists`);
        }
        throw err;
      }
    }

    // Ensure workspace membership exists
    const membership = await this.getUserWithMembership(userId, workspaceId);
    if (!membership) {
      await this.db
        .prepare('INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at) VALUES (?, ?, ?, ?, ?)')
        .bind(workspaceId, userId, role, 'active', now)
        .run();
    }

    const updated = await this.getUserWithMembership(userId, workspaceId);
    if (!updated) {
      throw APIError.internal('Failed to retrieve user after upsert');
    }
    return updated;
  }

  async listWorkspaceMembers(workspaceId = BIOSCULPTURE_WORKSPACE_ID): Promise<UserWithMembership[]> {
    const res = await this.db
      .prepare(`
        SELECT u.id, u.email, u.name, u.created_at, u.last_seen_at,
               wm.role, wm.status
        FROM users u
        INNER JOIN workspace_members wm ON u.id = wm.user_id
        WHERE wm.workspace_id = ?
        ORDER BY u.name ASC
      `)
      .bind(workspaceId)
      .all<{
        id: string;
        email: string;
        name: string;
        created_at: string;
        last_seen_at: string;
        role: string;
        status: string;
      }>();

    return (res.results || []).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      role: row.role as UserRole,
      status: row.status as MemberStatus,
    }));
  }

  // Folder Operations
  async listFolders(workspaceId = BIOSCULPTURE_WORKSPACE_ID, includeArchived = false): Promise<ProjectFolder[]> {
    const query = includeArchived
      ? 'SELECT id, workspace_id, parent_id, name, dropbox_folder_id, dropbox_path, created_at, archived_at FROM project_folders WHERE workspace_id = ? ORDER BY name ASC'
      : 'SELECT id, workspace_id, parent_id, name, dropbox_folder_id, dropbox_path, created_at, archived_at FROM project_folders WHERE workspace_id = ? AND archived_at IS NULL ORDER BY name ASC';

    const res = await this.db
      .prepare(query)
      .bind(workspaceId)
      .all<{
        id: string;
        workspace_id: string;
        parent_id: string | null;
        name: string;
        dropbox_folder_id: string | null;
        dropbox_path: string | null;
        created_at: string;
        archived_at: string | null;
      }>();

    return (res.results || []).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id,
      name: row.name,
      dropboxFolderId: row.dropbox_folder_id,
      dropboxPath: row.dropbox_path,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
    }));
  }

  async getFolderById(id: string): Promise<ProjectFolder | null> {
    const row = await this.db
      .prepare('SELECT id, workspace_id, parent_id, name, dropbox_folder_id, dropbox_path, created_at, archived_at FROM project_folders WHERE id = ?')
      .bind(id)
      .first<{
        id: string;
        workspace_id: string;
        parent_id: string | null;
        name: string;
        dropbox_folder_id: string | null;
        dropbox_path: string | null;
        created_at: string;
        archived_at: string | null;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id,
      name: row.name,
      dropboxFolderId: row.dropbox_folder_id,
      dropboxPath: row.dropbox_path,
      createdAt: row.created_at,
      archivedAt: row.archived_at,
    };
  }

  async createFolder(folder: Omit<ProjectFolder, 'createdAt' | 'archivedAt'>): Promise<ProjectFolder> {
    const now = new Date().toISOString();
    await this.db
      .prepare('INSERT INTO project_folders (id, workspace_id, parent_id, name, dropbox_folder_id, dropbox_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(
        folder.id,
        folder.workspaceId,
        folder.parentId,
        folder.name,
        folder.dropboxFolderId,
        folder.dropboxPath,
        now
      )
      .run();

    return {
      ...folder,
      createdAt: now,
      archivedAt: null,
    };
  }

  async archiveFolder(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare('UPDATE project_folders SET archived_at = ? WHERE id = ?')
      .bind(now, id)
      .run();
  }

  // Project Operations
  async listProjects(
    workspaceId = BIOSCULPTURE_WORKSPACE_ID,
    folderId?: string | null,
    includeArchived = false
  ): Promise<Project[]> {
    let query = 'SELECT id, workspace_id, folder_id, name, dropbox_file_id, dropbox_rev, current_state_vector, created_by, created_at, updated_at, archived_at FROM projects WHERE workspace_id = ?';
    const params: unknown[] = [workspaceId];

    if (folderId !== undefined) {
      if (folderId === null) {
        query += ' AND folder_id IS NULL';
      } else {
        query += ' AND folder_id = ?';
        params.push(folderId);
      }
    }

    if (!includeArchived) {
      query += ' AND archived_at IS NULL';
    }

    query += ' ORDER BY updated_at DESC';

    const res = await this.db.prepare(query).bind(...params).all<{
      id: string;
      workspace_id: string;
      folder_id: string | null;
      name: string;
      dropbox_file_id: string | null;
      dropbox_rev: string | null;
      current_state_vector: string | null;
      created_by: string;
      created_at: string;
      updated_at: string;
      archived_at: string | null;
    }>();

    return (res.results || []).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      folderId: row.folder_id,
      name: row.name,
      dropboxFileId: row.dropbox_file_id,
      dropboxRev: row.dropbox_rev,
      currentStateVector: row.current_state_vector,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    }));
  }

  async getProjectById(id: string): Promise<Project | null> {
    const row = await this.db
      .prepare('SELECT id, workspace_id, folder_id, name, dropbox_file_id, dropbox_rev, current_state_vector, created_by, created_at, updated_at, archived_at FROM projects WHERE id = ?')
      .bind(id)
      .first<{
        id: string;
        workspace_id: string;
        folder_id: string | null;
        name: string;
        dropbox_file_id: string | null;
        dropbox_rev: string | null;
        current_state_vector: string | null;
        created_by: string;
        created_at: string;
        updated_at: string;
        archived_at: string | null;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      workspaceId: row.workspace_id,
      folderId: row.folder_id,
      name: row.name,
      dropboxFileId: row.dropbox_file_id,
      dropboxRev: row.dropbox_rev,
      currentStateVector: row.current_state_vector,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
    };
  }

  async createProject(project: Omit<Project, 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<Project> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO projects (
          id, workspace_id, folder_id, name, dropbox_file_id,
          dropbox_rev, current_state_vector, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        project.id,
        project.workspaceId,
        project.folderId,
        project.name,
        project.dropboxFileId,
        project.dropboxRev,
        project.currentStateVector,
        project.createdBy,
        now,
        now
      )
      .run();

    return {
      ...project,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
  }

  async updateProjectRevision(id: string, dropboxRev: string, stateVector?: string | null): Promise<void> {
    const now = new Date().toISOString();
    if (stateVector !== undefined) {
      await this.db
        .prepare('UPDATE projects SET dropbox_rev = ?, current_state_vector = ?, updated_at = ? WHERE id = ?')
        .bind(dropboxRev, stateVector, now, id)
        .run();
    } else {
      await this.db
        .prepare('UPDATE projects SET dropbox_rev = ?, updated_at = ? WHERE id = ?')
        .bind(dropboxRev, now, id)
        .run();
    }
  }

  async archiveProject(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare('UPDATE projects SET archived_at = ? WHERE id = ?')
      .bind(now, id)
      .run();
  }

  // Audit Events
  async recordAuditEvent(event: Omit<AuditEvent, 'createdAt'>): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(`
        INSERT INTO audit_events (id, workspace_id, actor_id, action, target_type, target_id, details_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        event.id,
        event.workspaceId,
        event.actorId,
        event.action,
        event.targetType,
        event.targetId,
        event.detailsJson,
        now
      )
      .run();
  }
}
