-- Migration: 0001_biosculpture_workspace.sql
-- Bio Sculpture Single-Tenant Cloud Workspace Schema

PRAGMA foreign_keys = ON;

-- Fixed workspace constant
-- Workspace ID: 'ws_biosculpture_default'

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT OR IGNORE INTO workspaces (id, name, domain)
VALUES ('ws_biosculpture_default', 'Bio Sculpture', 'biosculpture.com');

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('member', 'admin')),
    status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
    joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (workspace_id, user_id),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_folders (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    dropbox_folder_id TEXT,
    dropbox_path TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES project_folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    folder_id TEXT,
    name TEXT NOT NULL,
    dropbox_file_id TEXT,
    dropbox_rev TEXT,
    current_state_vector TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    archived_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES project_folders(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_workspace ON project_folders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_folder ON projects(folder_id);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_events(workspace_id, created_at DESC);
