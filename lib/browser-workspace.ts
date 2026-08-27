import type { GameEvidence, GameProject } from './arcade';

export const WORKSPACE_KEY = 'lantern.arcade.workspace.v1';
export const CELEBRATIONS_KEY = 'lantern.arcade.celebrations.v1';

export type StoredBuildPhase = 'idle' | 'handoff' | 'planning' | 'drafting' | 'coding' | 'validating' | 'preview' | 'review' | 'error';

export type BrowserWorkspace = {
  version: 1;
  request: string;
  games: GameProject[];
  selectedGameId: string | null;
  evidence: GameEvidence[];
  runtimeErrors: Record<string, string[]>;
  phase: StoredBuildPhase;
  updatedAt: string;
};

function isGameProject(value: unknown): value is GameProject {
  if (!value || typeof value !== 'object') return false;
  const game = value as Partial<GameProject>;
  return typeof game.id === 'string' && game.id.length > 2
    && typeof game.title === 'string' && typeof game.description === 'string'
    && typeof game.learningGoal === 'string' && typeof game.html === 'string'
    && typeof game.css === 'string' && typeof game.javascript === 'string'
    && typeof game.revision === 'number' && game.source === 'agent';
}

function isEvidence(value: unknown): value is GameEvidence {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<GameEvidence>;
  return typeof item.gameId === 'string' && typeof item.event === 'string'
    && typeof item.detail === 'string' && typeof item.at === 'string';
}

function isBuildPhase(value: unknown): value is StoredBuildPhase {
  return typeof value === 'string' && ['idle','handoff','planning','drafting','coding','validating','preview','review','error'].includes(value);
}

export function readBrowserWorkspace(): BrowserWorkspace | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw || raw.length > 2_500_000) return null;
    const parsed = JSON.parse(raw) as Partial<BrowserWorkspace> & { runtimeErrors?: unknown };
    if (parsed.version !== 1 || !Array.isArray(parsed.games)) return null;
    const games = parsed.games.filter(isGameProject).slice(0, 8);
    return {
      version: 1,
      request: typeof parsed.request === 'string' ? parsed.request.slice(0, 2000) : '',
      games,
      selectedGameId: typeof parsed.selectedGameId === 'string' ? parsed.selectedGameId : null,
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter(isEvidence).slice(0, 40) : [],
      runtimeErrors: normalizeRuntimeErrors(parsed.runtimeErrors, typeof parsed.selectedGameId === 'string' ? parsed.selectedGameId : null),
      phase: isBuildPhase(parsed.phase) ? parsed.phase : 'idle',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function normalizeRuntimeErrors(value: unknown, selectedGameId: string | null) {
  if (Array.isArray(value)) {
    const legacy = value.filter((item): item is string => typeof item === 'string').slice(0, 12);
    return selectedGameId && legacy.length ? { [selectedGameId]: legacy } : {};
  }
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([gameId, errors]) => gameId.length > 2 && Array.isArray(errors))
    .slice(0, 8)
    .map(([gameId, errors]) => [gameId, (errors as unknown[]).filter((item): item is string => typeof item === 'string').slice(0, 12)]));
}

export function writeBrowserWorkspace(workspace: Omit<BrowserWorkspace, 'version' | 'updatedAt'>) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ ...workspace, version: 1, updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export function hasCelebrated(gameId: string, revision: number) {
  if (typeof window === 'undefined') return false;
  try {
    const keys = JSON.parse(window.localStorage.getItem(CELEBRATIONS_KEY) || '[]') as unknown;
    return Array.isArray(keys) && keys.includes(`${gameId}:${revision}`);
  } catch {
    return false;
  }
}

export function rememberCelebration(gameId: string, revision: number) {
  if (typeof window === 'undefined') return;
  try {
    const raw = JSON.parse(window.localStorage.getItem(CELEBRATIONS_KEY) || '[]') as unknown;
    const keys = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
    window.localStorage.setItem(CELEBRATIONS_KEY, JSON.stringify([`${gameId}:${revision}`, ...keys.filter((key) => key !== `${gameId}:${revision}`)].slice(0, 60)));
  } catch {
    // Confetti history is optional and must never interrupt the game.
  }
}
