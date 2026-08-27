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

type ChoiceGameOptions = Omit<GameProject, 'html' | 'css' | 'javascript' | 'revision' | 'status' | 'source'> & {
  kicker: string;
  question: string;
  choices: Array<{ label: string; correct?: boolean }>;
  success: string;
  hint: string;
  accent: string;
  accentSoft: string;
  illustration: string;
};

function choiceGame(options: ChoiceGameOptions): GameProject {
  const buttons = options.choices.map((choice) =>
    `<button type="button" data-correct="${choice.correct ? 'true' : 'false'}">${choice.label}</button>`,
  ).join('');
  return {
    id: options.id,
    title: options.title,
    description: options.description,
    learningGoal: options.learningGoal,
    subject: options.subject,
    ageBand: options.ageBand,
    durationMinutes: options.durationMinutes,
    thumbnail: options.thumbnail,
    revision: 1,
    status: 'demo',
    source: 'lantern',
    html: `<main class="world"><div class="scene" aria-hidden="true">${options.illustration}</div><p class="kicker">${options.kicker}</p><h1>${options.question}</h1><div class="choices">${buttons}</div><p class="feedback" role="status">Choose an answer to test your idea.</p><button class="again" type="button">Play again</button></main>`,
    css: `:root{--ink:#17213c;--accent:${options.accent};--soft:${options.accentSoft}}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:28px;background:linear-gradient(145deg,var(--soft),#fff);color:var(--ink);font-family:ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif}.world{width:min(720px,100%);text-align:center}.scene{min-height:155px;display:grid;place-items:center;margin-bottom:15px;border:2px solid var(--ink);border-radius:24px;background:white;box-shadow:8px 9px 0 rgba(23,33,60,.12);font-size:72px;letter-spacing:10px}.kicker{margin:0 0 8px;color:var(--accent);font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}h1{max-width:620px;margin:0 auto 22px;font-size:clamp(28px,5vw,48px);line-height:1.05;letter-spacing:-.045em}.choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px}.choices button,.again{min-height:54px;border:2px solid var(--ink);border-radius:14px;background:white;color:var(--ink);font:900 18px inherit;box-shadow:4px 5px 0 rgba(23,33,60,.14);cursor:pointer}.choices button:hover,.choices button:focus-visible{transform:translateY(-2px);border-color:var(--accent)}.choices button.correct{background:#d8f8e9;border-color:#147251}.choices button.wrong{background:#fff0ed;border-color:#ad4f46}.feedback{min-height:42px;margin:18px 0 0;font-weight:800}.again{display:none;margin:10px auto 0;padding:0 20px;background:var(--accent);color:white}.again.visible{display:inline-block}@media(max-width:520px){body{padding:16px}.scene{min-height:120px;font-size:50px}.choices{grid-template-columns:1fr 1fr}}`,
    javascript: `const choices=[...document.querySelectorAll('[data-correct]')];const feedback=document.querySelector('.feedback');const again=document.querySelector('.again');choices.forEach(button=>button.addEventListener('click',()=>{const correct=button.dataset.correct==='true';choices.forEach(choice=>choice.disabled=true);button.classList.add(correct?'correct':'wrong');if(correct){feedback.textContent=${JSON.stringify(options.success)};lantern.evidence({event:'mastery',detail:${JSON.stringify(options.success)},mastery:${JSON.stringify(options.learningGoal)}});lantern.complete({mastery:${JSON.stringify(options.learningGoal)}});}else{feedback.textContent=${JSON.stringify(options.hint)};lantern.evidence({event:'attempt',detail:button.textContent||'Incorrect choice'});}again.classList.add('visible');}));again.addEventListener('click',()=>{choices.forEach(choice=>{choice.disabled=false;choice.classList.remove('correct','wrong')});feedback.textContent='Choose an answer to test your idea.';again.classList.remove('visible');});`,
  };
}

export const demoGames: GameProject[] = [
  choiceGame({
    id: 'fraction-forge', title: 'Fraction Forge', description: 'Repair a bridge with equal fraction pieces.',
    learningGoal: 'Understand part–whole relationships', subject: 'Maths', ageBand: 'Ages 7–9', durationMinutes: 8,
    thumbnail: 'bridge', kicker: 'Bridge repair', question: 'Which picture shows three quarters?',
    choices: [{label:'1 / 4'}, {label:'2 / 4'}, {label:'3 / 4',correct:true}, {label:'4 / 4'}],
    success: 'Exactly—three of four equal parts is three quarters.', hint: 'Count how many equal parts are selected out of four.',
    accent: '#3454e7', accentSoft: '#dce8ff', illustration: '🌿 🌉 💧',
  }),
  choiceGame({
    id: 'word-wizard', title: 'Word Wizard Workshop', description: 'Repair enchanted words by choosing the correct spelling.',
    learningGoal: 'Build spelling and vocabulary', subject: 'English', ageBand: 'Ages 8–10', durationMinutes: 9,
    thumbnail: 'word', kicker: 'Spell repair', question: 'Which spelling completes the sentence: “I ___ the ball”?',
    choices: [{label:'caut'}, {label:'caught',correct:true}, {label:'cot'}, {label:'cought'}],
    success: 'Caught is the correct past tense of catch.', hint: 'Listen for the “aw” sound, then look for the silent letters.',
    accent: '#8c4fd6', accentSoft: '#f0e2ff', illustration: '📖 ✨ 🪄',
  }),
  choiceGame({
    id: 'eco-city', title: 'Eco City Builder', description: 'Power a growing city without increasing pollution.',
    learningGoal: 'Reason about energy choices and sustainability', subject: 'Science', ageBand: 'Ages 10–12', durationMinutes: 12,
    thumbnail: 'eco', kicker: 'City decision', question: 'Which energy source is renewable and works at night?',
    choices: [{label:'Solar'}, {label:'Wind',correct:true}, {label:'Coal'}, {label:'Diesel'}],
    success: 'Wind can generate renewable energy day or night when air is moving.', hint: 'Look for a source that does not depend on sunlight or fuel.',
    accent: '#168b61', accentSoft: '#d8f6e8', illustration: '🌬️ 🏙️ 🌱',
  }),
  choiceGame({
    id: 'rhythm-times', title: 'Rhythm Times Tables', description: 'Keep the beat by choosing the next multiple.',
    learningGoal: 'Build fluency with the 6 times table', subject: 'Maths', ageBand: 'Ages 6–8', durationMinutes: 7,
    thumbnail: 'rhythm', kicker: 'Keep the beat', question: '6, 12, 18, 24… what comes next?',
    choices: [{label:'28'}, {label:'30',correct:true}, {label:'32'}, {label:'36'}],
    success: 'Yes—add six each time, so the next beat is 30.', hint: 'Start at 24 and count forward six steps.',
    accent: '#e35b54', accentSoft: '#ffe1dd', illustration: '🥁 🎵 6×',
  }),
];

export const arcadeCapabilities = {
  runtime: 'sandboxed_web_game_v1',
  renderers: ['dom', 'canvas_2d', 'webgl', 'threejs_scene_graph'],
  features: ['render_loop', 'pointer_input', 'keyboard_input', 'audio', 'physics', 'glsl_shaders', 'mastery_events'],
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
  [/\b(eval|Function)\s*\(/i, 'Dynamic code evaluation is unavailable inside game drafts.'],
  [/\b(import\s*\(|require\s*\()/i, 'Dynamic imports are unavailable inside game drafts.'],
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
    description: 'Read validation errors, runtime errors, and recent mastery evidence for the visible game preview.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
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
