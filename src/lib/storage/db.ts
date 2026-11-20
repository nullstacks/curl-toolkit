import Dexie, { type Table } from 'dexie';
import type { RequestModel } from '../../types';

export interface HistoryEntry {
  id: string;
  createdAt: number;
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  error: string | null;
  request: RequestModel;
  favorite: boolean;
}

export interface Folder {
  id: string;
  collectionId: string;
  parentId: string | null;
  name: string;
  createdAt: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface SavedRequest {
  id: string;
  name: string;
  collectionId: string | null;
  folderId: string | null;
  favorite: boolean;
  request: RequestModel;
  createdAt: number;
  updatedAt: number;
}

export interface Environment {
  id: string;
  name: string;
  variables: Array<{ id: string; key: string; value: string; secret: boolean; enabled: boolean }>;
  createdAt: number;
  updatedAt: number;
}

export interface Preferences {
  key: 'prefs';
  theme: 'dark' | 'light';
  excludeSensitiveOnSave: boolean;
  historyLimit: number;
  activeEnvironmentId: string | null;
  defaultTimeoutMs: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  key: 'prefs',
  theme: 'dark',
  excludeSensitiveOnSave: false,
  historyLimit: 500,
  activeEnvironmentId: null,
  defaultTimeoutMs: 30_000,
};

export class ToolkitDB extends Dexie {
  history!: Table<HistoryEntry, string>;
  requests!: Table<SavedRequest, string>;
  collections!: Table<Collection, string>;
  folders!: Table<Folder, string>;
  environments!: Table<Environment, string>;
  preferences!: Table<Preferences, 'prefs'>;

  constructor(name = 'curl-toolkit') {
    super(name);
    this.version(1).stores({
      history: 'id, createdAt, method, favorite',
      requests: 'id, collectionId, folderId, favorite, updatedAt',
      collections: 'id, updatedAt',
      folders: 'id, collectionId, parentId',
      environments: 'id, updatedAt',
      preferences: 'key',
    });
  }
}

export const db = new ToolkitDB();
