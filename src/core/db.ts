/** IndexedDB 持久化:工区 / 数据体 / 层位 */

const DB_NAME = 'seismic-studio';
const DB_VER = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('volumes')) db.createObjectStore('volumes', { keyPath: 'projectId' });
        if (!db.objectStoreNames.contains('horizons')) {
          const s = db.createObjectStore('horizons', { keyPath: 'id' });
          s.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function txAll<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>[]): Promise<T[]> {
  return open().then(db => new Promise<T[]>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const reqs = fn(t.objectStore(store));
    const out: T[] = new Array(reqs.length);
    let done = 0;
    reqs.forEach((r, i) => {
      r.onsuccess = () => { out[i] = r.result; if (++done === reqs.length) resolve(out); };
      r.onerror = () => reject(r.error);
    });
    if (reqs.length === 0) resolve([]);
  }));
}

// ---- projects ----
export interface ProjectRow {
  id: string; name: string; created: number;
  dims: { nx: number; ny: number; nz: number };
  minVal: number; maxVal: number;
  sampleIntervalUs?: number; source: string; byteSize: number;
}
export const listProjects = () => tx<ProjectRow[]>('projects', 'readonly', s => s.getAll() as IDBRequest<ProjectRow[]>);
export const putProject = (p: ProjectRow) => tx('projects', 'readwrite', s => s.put(p));
export const deleteProjectRow = (id: string) => tx('projects', 'readwrite', s => s.delete(id));

// ---- volumes ----
export interface VolumeRow {
  projectId: string;
  dims: { nx: number; ny: number; nz: number };
  buffer: ArrayBuffer; // Float32 [-1,1]
}
export const putVolume = (v: VolumeRow) => tx('volumes', 'readwrite', s => s.put(v));
export const getVolume = (projectId: string) => tx<VolumeRow | undefined>('volumes', 'readonly', s => s.get(projectId) as IDBRequest<VolumeRow | undefined>);
export const deleteVolume = (projectId: string) => tx('volumes', 'readwrite', s => s.delete(projectId));

// ---- horizons ----
export interface HorizonRow {
  id: string; projectId: string; name: string; color: string;
  buffer: ArrayBuffer; // Float32 nx*ny, NaN = 未拾取
  updated: number;
}
export const putHorizon = (h: HorizonRow) => tx('horizons', 'readwrite', s => s.put(h));
export const deleteHorizon = (id: string) => tx('horizons', 'readwrite', s => s.delete(id));

export async function listHorizons(projectId: string): Promise<HorizonRow[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('horizons', 'readonly');
    const idx = t.objectStore('horizons').index('projectId');
    const req = idx.getAll(projectId);
    req.onsuccess = () => resolve(req.result as HorizonRow[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProjectCascade(id: string): Promise<void> {
  const hs = await listHorizons(id);
  await txAll('horizons', 'readwrite', s => hs.map(h => s.delete(h.id)));
  await deleteVolume(id);
  await deleteProjectRow(id);
}
