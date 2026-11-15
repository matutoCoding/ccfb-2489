import { ViewerSettings, DEFAULT_VIEWER_SETTINGS, VolumeDims } from '../types';
import { getVolume, listProjects, ProjectRow } from './db';
import { getActiveColormapId } from './colormaps';

/** 当前打开的工区及其数据体(内存缓存) */
export interface Session {
  project: ProjectRow;
  dims: VolumeDims;
  data: Float32Array;
  settings: ViewerSettings;
}

let current: Session | null = null;

export function getSession(): Session | null { return current; }

export async function openProject(projectId: string): Promise<Session | null> {
  const projects = await listProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) return null;
  const vol = await getVolume(projectId);
  if (!vol) return null;
  current = {
    project,
    dims: vol.dims,
    data: new Float32Array(vol.buffer),
    settings: loadSettings(projectId),
  };
  localStorage.setItem('seismic-studio.last-project', projectId);
  updateIndicator();
  return current;
}

export async function openLastProject(): Promise<Session | null> {
  if (current) return current;
  const last = localStorage.getItem('seismic-studio.last-project');
  if (last) {
    const s = await openProject(last);
    if (s) return s;
  }
  const projects = await listProjects();
  if (projects.length > 0) return openProject(projects[projects.length - 1].id);
  return null;
}

export function closeSession(): void {
  current = null;
  updateIndicator();
}

export function updateIndicator(): void {
  const el = document.getElementById('project-indicator');
  if (el) el.textContent = current
    ? `当前工区:${current.project.name}(${current.dims.nx}×${current.dims.ny}×${current.dims.nz})`
    : '未打开工区';
}

// ---- 每工区浏览设置持久化 ----
function settingsKey(id: string) { return `seismic-studio.settings.${id}`; }

export function loadSettings(projectId: string): ViewerSettings {
  try {
    const raw = localStorage.getItem(settingsKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...structuredClone(DEFAULT_VIEWER_SETTINGS), ...parsed };
    }
  } catch { /* ignore */ }
  const s = structuredClone(DEFAULT_VIEWER_SETTINGS);
  s.colormapId = getActiveColormapId();
  return s;
}

let saveTimer = 0;
export function saveSettings(): void {
  if (!current) return;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (current) localStorage.setItem(settingsKey(current.project.id), JSON.stringify(current.settings));
  }, 300);
}
