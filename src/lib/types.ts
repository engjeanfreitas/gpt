export interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
}
export interface Activity {
  id: string;
  name: string;
  categoryId: string | null;
}
export interface Project {
  id: string;
  name: string;
  client: string;
  color: string;
  budgetMinutes: number | null;
  apps: string[];
  archived: boolean;
}
export interface Software {
  executable: string;
  name: string;
  categoryId: string | null;
}
export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  app: string;
  titleContains: string;
  domain: string;
  activityId: string | null;
  projectId: string | null;
}
export interface Assignment {
  projectId?: string | null;
  activityId?: string | null;
  excluded?: boolean;
}
export interface Settings {
  idleSeconds: number;
  pausePresets: number[];
  autoResume: boolean;
  alarmSound: 'soft' | 'bell' | 'none';
  alarmVolume: number;
  privacyApps: string[];
  privacyTitles: string[];
  retentionDays: number;
}
export interface Configuration {
  categories: Category[];
  activities: Activity[];
  projects: Project[];
  softwares: Software[];
  rules: Rule[];
  assignments: Record<string, Assignment>;
  settings: Settings;
}
export type EventKind = 'active' | 'idle' | 'pause' | 'unknown';
export interface TimeEvent {
  id: string;
  start: number;
  end: number;
  app: string;
  title: string;
  domain: string | null;
  projectId: string | null;
  kind: EventKind;
}
export interface PauseState {
  id: string;
  startedAt: number;
  endsAt: number | null;
  notified: boolean;
}
export interface Snapshot {
  events: TimeEvent[];
  config: Configuration;
  pause: PauseState | null;
  currentProjectId: string | null;
  capturing: boolean;
  trackingStatus: 'active' | 'afk' | 'locked' | 'paused' | 'unknown';
  platform: string;
  lastError: string | null;
}
export interface ClassifiedEvent extends TimeEvent {
  activityId: string | null;
  categoryId: string | null;
  softwareName: string;
  activityName: string;
  projectName: string;
  matchedRules: string[];
}
export type GroupMode = 'activity' | 'software' | 'project';
export type Page = 'dashboard' | 'timeline' | 'projects' | 'rules' | 'settings';
export interface DateRange {
  start: number;
  end: number;
}
export interface GroupRow {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  duration: number;
  events: ClassifiedEvent[];
  children: GroupRow[];
}
