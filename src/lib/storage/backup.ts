import { db, type Collection, type Environment, type Folder, type HistoryEntry, type SavedRequest } from './db';

export const BACKUP_FORMAT = 'curl-toolkit-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: {
    history: unknown[];
    requests: unknown[];
    collections: unknown[];
    folders: unknown[];
    environments: unknown[];
  };
}

export async function buildBackup(includeHistory: boolean): Promise<BackupFile> {
  const [history, requests, collections, folders, environments] = await Promise.all([
    includeHistory ? db.history.toArray() : Promise.resolve([]),
    db.requests.toArray(),
    db.collections.toArray(),
    db.folders.toArray(),
    db.environments.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: { history, requests, collections, folders, environments },
  };
}

/** Validates the shape of an imported file before anything is written. */
export function parseBackup(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  const b = parsed as Partial<BackupFile>;
  if (b.format !== BACKUP_FORMAT) throw new Error('This file was not exported by cURL Toolkit.');
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app.');
  }
  const d = b.data;
  if (!d || typeof d !== 'object') throw new Error('The backup has no data section.');
  for (const key of ['history', 'requests', 'collections', 'folders', 'environments'] as const) {
    if (!Array.isArray(d[key])) throw new Error(`The backup section "${key}" is missing or invalid.`);
  }
  return b as BackupFile;
}

/** Writes backup rows with put(), so importing the same file twice does not duplicate data. */
export async function restoreBackup(file: BackupFile): Promise<number> {
  const d = file.data;
  let count = 0;
  await db.transaction('rw', [db.history, db.requests, db.collections, db.folders, db.environments], async () => {
    await db.history.bulkPut(d.history as HistoryEntry[]);
    await db.requests.bulkPut(d.requests as SavedRequest[]);
    await db.collections.bulkPut(d.collections as Collection[]);
    await db.folders.bulkPut(d.folders as Folder[]);
    await db.environments.bulkPut(d.environments as Environment[]);
    count = d.history.length + d.requests.length + d.collections.length + d.folders.length + d.environments.length;
  });
  return count;
}
