import { sixYearOldDemoGames } from './demo-games-six';

export type GameStatus = 'demo' | 'draft' | 'review';

export type GameProject = {
  id: string;
  title: string;
  description: string;
  learningGoal: string;
  subject: string;
  ageBand: string;
  durationMinutes: number;
  thumbnail: 'bridge' | 'word' | 'eco' | 'rhythm' | 'agent';
  html: string;
  css: string;
  javascript: string;
  revision: number;
  status: GameStatus;
  source: 'lantern' | 'agent';
};

export type GameEvidence = {
  gameId: string;
  event: string;
  detail: string;
  mastery?: string;
  at: string;
};

export const demoGames: GameProject[] = sixYearOldDemoGames;

export const arcadeCapabilities = {
  runtime: 'sandboxed_web_game_v1',
  renderers: ['dom', 'canvas_2d', 'webgl'],
  features: ['render_loop', 'pointer_input', 'keyboard_input', 'audio', 'physics', 'glsl_shaders', 'mastery_events', 'host_confetti', 'browser_saved_drafts'],
  limits: { htmlCharacters: 24000, cssCharacters: 32000, javascriptCharacters: 48000, externalNetwork: false },
  safety: ['isolated_iframe', 'no_same_origin', 'no_external_network', 'human_review_before_publish'],
};

const blockedSourcePatterns: Array<[RegExp, string]> = [
  [/\bfetch\s*\(/i, 'Network requests are unavailable inside game drafts.'],
  [/\bXMLHttpRequest\b/i, 'XMLHttpRequest is unavailable inside game drafts.'],
  [/\bWebSocket\b/i, 'WebSockets are unavailable inside game drafts.'],
  [/\bEventSource\b/i, 'EventSource is unavailable inside game drafts.'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/i, 'Persistent browser storage is unavailable inside game drafts.'],
  [/\bwindow\.open\s*\(/i, 'Games cannot open new windows.'],
  [/\b(document\.cookie|navigator\.sendBeacon)\b/i, 'Games cannot access cookies or send beacons.'],
  [/\beval\s*\(|\bFunction\s*\(/, 'Dynamic code evaluation is unavailable inside game drafts.'],
  [/\b(import\s*\(|require\s*\()/i, 'Dynamic imports are unavailable inside game drafts.'],
  [/\bwhile\s*\(\s*(?:true|1)\s*\)/i, 'Unbounded while loops are unavailable inside game drafts. Use requestAnimationFrame for game loops.'],
  [/\bfor\s*\(\s*;\s*;\s*\)/i, 'Unbounded for loops are unavailable inside game drafts. Use requestAnimationFrame for game loops.'],
  [/<script\b/i, 'Put JavaScript in the javascript field, not inside HTML.'],
  [/<iframe\b/i, 'Nested frames are unavailable inside games.'],
];

export function validateGameSource(input: Pick<GameProject, 'html' | 'css' | 'javascript'>) {
  const errors: string[] = [];
  if (input.html.length > arcadeCapabilities.limits.htmlCharacters) errors.push('HTML exceeds the 24,000 character limit.');
  if (input.css.length > arcadeCapabilities.limits.cssCharacters) errors.push('CSS exceeds the 32,000 character limit.');
  if (input.javascript.length > arcadeCapabilities.limits.javascriptCharacters) errors.push('JavaScript exceeds the 48,000 character limit.');
  for (const [pattern, message] of blockedSourcePatterns) {
    if (pattern.test(`${input.html}\n${input.css}\n${input.javascript}`)) errors.push(message);
  }
  return [...new Set(errors)];
}

const requestId = { type: 'string', minLength: 6, maxLength: 100, description: 'Unique idempotency key for this mutation.' };
const revision = { type: 'integer', minimum: 1, description: 'Current draft revision returned by a previous tool call.' };

export const arcadeToolDefinitions = [
  {
    name: 'get_game_canvas_capabilities',
    description: 'Read Lantern Arcade renderers, game features, safety boundaries, and source-size limits before creating a game.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_saved_game_drafts',
    description: 'List agent-created learning game drafts saved on this device so an agent can continue an existing revision instead of starting over.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'resume_game_draft',
    description: 'Load one browser-saved game into the visible builder and make it the active draft for subsequent source updates.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { requestId, gameId: { type: 'string', minLength: 3, maxLength: 100 } },
      required: ['requestId', 'gameId'],
    },
  },
  {
    name: 'create_game_draft',
    description: 'Create a new kid-safe learning game draft and return its stable id and first revision.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        requestId,
        title: { type: 'string', minLength: 3, maxLength: 80 },
        description: { type: 'string', minLength: 10, maxLength: 300 },
        learningGoal: { type: 'string', minLength: 8, maxLength: 180 },
        subject: { type: 'string', minLength: 2, maxLength: 40 },
        ageBand: { type: 'string', minLength: 3, maxLength: 30 },
        durationMinutes: { type: 'integer', minimum: 3, maximum: 30 },
      },
      required: ['requestId', 'title', 'description', 'learningGoal', 'subject', 'ageBand', 'durationMinutes'],
    },
  },
  {
    name: 'set_game_source',
    description: 'Replace the sandboxed HTML, CSS, and JavaScript for a game draft. Use the provided lantern.evidence() and lantern.complete() bridge to report learning evidence.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: {
        requestId, expectedRevision: revision,
        gameId: { type: 'string', minLength: 3, maxLength: 100 },
        html: { type: 'string', minLength: 1, maxLength: arcadeCapabilities.limits.htmlCharacters },
        css: { type: 'string', maxLength: arcadeCapabilities.limits.cssCharacters },
        javascript: { type: 'string', maxLength: arcadeCapabilities.limits.javascriptCharacters },
      },
      required: ['requestId', 'expectedRevision', 'gameId', 'html', 'css', 'javascript'],
    },
  },
  {
    name: 'preview_game',
    description: 'Open the current game draft in Lantern’s visible sandboxed canvas for the user to play and review.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { requestId, gameId: { type: 'string', minLength: 3, maxLength: 100 } },
      required: ['requestId', 'gameId'],
    },
  },
  {
    name: 'get_game_runtime_diagnostics',
    description: 'Read validation errors, runtime errors, and recent mastery evidence for a saved game or the visible preview.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { gameId: { type: 'string', minLength: 3, maxLength: 100 } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'request_game_review',
    description: 'Mark a validated game draft ready for parent or teacher review. This does not publish the game.',
    inputSchema: {
      type: 'object', additionalProperties: false,
      properties: { requestId, expectedRevision: revision, gameId: { type: 'string', minLength: 3, maxLength: 100 } },
      required: ['requestId', 'expectedRevision', 'gameId'],
    },
  },
] as const;

export function blankAgentProject(input: {
  id: string; title: string; description: string; learningGoal: string; subject: string; ageBand: string; durationMinutes: number;
}): GameProject {
  return {
    ...input,
    thumbnail: 'agent', revision: 1, status: 'draft', source: 'agent',
    html: `<main><p>Agent-created learning game</p><h1>${escapeHtml(input.title)}</h1><p>${escapeHtml(input.description)}</p><button type="button">Start</button></main>`,
    css: 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef3ff;color:#17213c;font-family:system-ui,sans-serif}main{text-align:center;padding:32px}button{padding:12px 18px;border:0;border-radius:12px;background:#3454e7;color:white;font-weight:800}',
    javascript: `document.querySelector('button')?.addEventListener('click',()=>lantern.evidence({event:'started',detail:'Learner started the game.'}));`,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
}
