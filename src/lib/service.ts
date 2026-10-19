import { invoke } from '@tauri-apps/api/core';
import { createDemo } from './demo';
import { upgradePalette } from './colors';
import type { Configuration, Snapshot } from './types';

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const STORAGE_KEY = 'tempo-demo-v1';
let memory: Snapshot | undefined;
function demo(): Snapshot {
  if (!memory) {
    try {
      memory = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') ?? undefined;
    } catch {
      /* A damaged demo can be reset. */
    }
    if (!memory?.config?.settings) memory = createDemo();
    if (upgradePalette(memory.config)) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
      } catch {
        /* Keep the new palette in memory if browser storage is full. */
      }
    }
  }
  return memory;
}
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demo()));
}
export async function getSnapshot(): Promise<Snapshot> {
  if (isDesktop) return invoke('get_snapshot');
  const data = demo();
  if (data.pause?.endsAt && Date.now() >= data.pause.endsAt && !data.pause.notified) {
    data.pause.notified = true;
    // A browser demo requires explicit resume so the alarm remains visible after a suspended tab.
    persist();
  }
  return structuredClone(data);
}
export async function saveConfig(config: Configuration): Promise<void> {
  if (isDesktop) return invoke('save_config', { config });
  const data = demo();
  data.config = structuredClone(config);
  if (!config.projects.some((p) => p.id === data.currentProjectId && !p.archived))
    data.currentProjectId = null;
  persist();
}
export async function startPause(minutes: number | null): Promise<void> {
  if (isDesktop) return invoke('start_pause', { minutes });
  demo().pause = {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    endsAt: minutes === null ? null : Date.now() + minutes * 60_000,
    notified: false,
  };
  persist();
}
export async function extendPause(minutes: number): Promise<void> {
  if (isDesktop) return invoke('extend_pause', { minutes });
  const pause = demo().pause;
  if (pause) {
    pause.endsAt = Math.max(pause.endsAt ?? Date.now(), Date.now()) + minutes * 60_000;
    pause.notified = false;
    persist();
  }
}
export async function resumeTracking(): Promise<void> {
  if (isDesktop) return invoke('resume_tracking');
  const data = demo();
  const pause = data.pause;
  if (pause)
    data.events.push({
      id: pause.id,
      start: pause.startedAt,
      end: Date.now(),
      app: '',
      title: '',
      domain: null,
      projectId: null,
      kind: 'pause',
    });
  data.pause = null;
  persist();
}
export async function setCurrentProject(projectId: string | null): Promise<void> {
  if (isDesktop) return invoke('set_current_project', { projectId });
  demo().currentProjectId = projectId;
  persist();
}
export async function setAutostart(enabled: boolean): Promise<void> {
  if (!isDesktop)
    throw new Error('A inicialização com o Windows está disponível no aplicativo instalado.');
  return invoke('set_autostart', { enabled });
}
export async function getAutostart(): Promise<boolean> {
  return isDesktop ? invoke('get_autostart') : false;
}
export interface UpdateInfo {
  currentVersion: string;
  availableVersion: string | null;
  notes: string | null;
}
export interface UpdateProgress {
  phase: 'downloading' | 'installing';
  downloaded: number;
  total: number | null;
}
export async function checkForUpdates(): Promise<UpdateInfo> {
  if (!isDesktop) throw new Error('Abra o aplicativo Windows para verificar atualizações.');
  return invoke('check_for_updates');
}
export async function installUpdate(): Promise<void> {
  if (!isDesktop) throw new Error('Abra o aplicativo Windows para atualizar.');
  return invoke('install_update');
}
export async function testAlarm(): Promise<void> {
  if (isDesktop) return invoke('test_alarm');
}
export async function createBackup(): Promise<string> {
  if (isDesktop) return invoke('create_backup');
  downloadFile('tempo-demonstracao.json', JSON.stringify(demo(), null, 2), 'application/json');
  return 'Arquivo de demonstração exportado';
}
export async function deleteHistory(start: number, end: number): Promise<void> {
  if (isDesktop) return invoke('delete_history', { start, end });
  const data = demo();
  data.events = data.events.flatMap((e) => {
    if (e.end <= start || e.start >= end) return [e];
    const assignment = data.config.assignments[e.id];
    delete data.config.assignments[e.id];
    const parts = [];
    if (e.start < start) {
      parts.push({ ...e, end: start });
      if (assignment) data.config.assignments[e.id] = assignment;
    }
    if (e.end > end) {
      const id = crypto.randomUUID();
      parts.push({ ...e, id, start: end });
      if (assignment) data.config.assignments[id] = structuredClone(assignment);
    }
    return parts;
  });
  persist();
}
export function downloadFile(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  memory = createDemo();
  persist();
}
