import { newId } from '../../types';
import { DEFAULT_PREFERENCES, db, type Collection, type Environment, type Folder, type HistoryEntry, type Preferences, type SavedRequest } from './db';
import type { RequestModel } from '../../types';
import { containsSecrets, redactForStorage } from './redact';

export const repo = {
  async getPreferences(): Promise<Preferences> {
    const stored = await db.preferences.get('prefs');
    return { ...DEFAULT_PREFERENCES, ...stored };
  },

  async savePreferences(patch: Partial<Preferences>): Promise<void> {
    const current = await repo.getPreferences();
    await db.preferences.put({ ...current, ...patch, key: 'prefs' });
  },

  async addHistory(request: RequestModel, result: Pick<HistoryEntry, 'status' | 'durationMs' | 'error'>): Promise<void> {
    const prefs = await repo.getPreferences();
    const stored = redactForStorage(request, prefs.excludeSensitiveOnSave);
    await db.history.add({
      id: newId(),
      createdAt: Date.now(),
      method: request.method,
      url: request.url,
      status: result.status,
      durationMs: result.durationMs,
      error: result.error,
      request: stored,
      favorite: false,
    });
    const count = await db.history.count();
    if (count > prefs.historyLimit) {
      const excess = await db.history.orderBy('createdAt').limit(count - prefs.historyLimit).primaryKeys();
      await db.history.bulkDelete(excess);
    }
  },

  async saveRequest(name: string, request: RequestModel, collectionId: string | null, folderId: string | null, existingId?: string): Promise<{ id: string; containsSecrets: boolean }> {
    const prefs = await repo.getPreferences();
    const id = existingId ?? newId();
    const now = Date.now();
    const existing = existingId ? await db.requests.get(existingId) : undefined;
    const record: SavedRequest = {
      id,
      name,
      collectionId,
      folderId,
      favorite: existing?.favorite ?? false,
      request: redactForStorage(request, prefs.excludeSensitiveOnSave),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.requests.put(record);
    return { id, containsSecrets: containsSecrets(request) && !prefs.excludeSensitiveOnSave };
  },

  async createCollection(name: string, description = ''): Promise<Collection> {
    const now = Date.now();
    const c: Collection = { id: newId(), name, description, createdAt: now, updatedAt: now };
    await db.collections.add(c);
    return c;
  },

  async createFolder(collectionId: string, name: string, parentId: string | null): Promise<Folder> {
    const f: Folder = { id: newId(), collectionId, parentId, name, createdAt: Date.now() };
    await db.folders.add(f);
    return f;
  },

  async deleteCollection(id: string): Promise<void> {
    await db.transaction('rw', db.collections, db.folders, db.requests, async () => {
      await db.folders.where('collectionId').equals(id).delete();
      await db.requests.where('collectionId').equals(id).modify({ collectionId: null, folderId: null });
      await db.collections.delete(id);
    });
  },

  async saveEnvironment(env: Environment): Promise<void> {
    await db.environments.put({ ...env, updatedAt: Date.now() });
  },

  async clearAll(): Promise<void> {
    await db.transaction('rw', [db.history, db.requests, db.collections, db.folders, db.environments, db.preferences], async () => {
      await Promise.all([
        db.history.clear(),
        db.requests.clear(),
        db.collections.clear(),
        db.folders.clear(),
        db.environments.clear(),
        db.preferences.clear(),
      ]);
    });
  },
};
