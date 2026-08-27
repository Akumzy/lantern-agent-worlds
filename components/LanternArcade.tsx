/* eslint-disable @next/next/no-html-link-for-pages -- vinext client navigation currently throws during transitions; full document links are intentional. */
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BracketsCurly, Check, Copy, FloppyDisk, GameController,
  LightbulbFilament, Play, ShieldCheck, Target, Trash, Wrench,
} from '@phosphor-icons/react';
import {
  arcadeCapabilities, arcadeToolDefinitions, blankAgentProject, demoGames, validateGameSource,
  type GameEvidence, type GameProject,
} from '../lib/arcade';
import {
  readBrowserWorkspace, writeBrowserWorkspace, WORKSPACE_KEY, type BrowserWorkspace, type StoredBuildPhase,
} from '../lib/browser-workspace';
import SandboxGameCanvas from './SandboxGameCanvas';

const legacyStarterRequest = 'A multiplication adventure for an 8-year-old who loves space. Practise the 6 times table with three short levels.';
const starterRequest = 'A bridge-building adventure for an 8-year-old. Practise equivalent fractions by repairing three sections of a sky bridge.';
type BuildActivity = { id: number; label: string; detail: string; tone?: 'good' | 'error' };
type WorkspaceDraft = Omit<BrowserWorkspace, 'version' | 'updatedAt'>;

const phaseCopy: Record<StoredBuildPhase, { label: string; detail: string }> = {
  idle: { label: 'Waiting for an agent', detail: 'Copy the brief, then paste it into a browser agent that can use WebMCP.' },
  handoff: { label: 'Instructions copied', detail: 'Paste them into your agent. Lantern will show every build step here.' },
  planning: { label: 'Agent is planning', detail: 'Reading canvas capabilities and the safe game contract.' },
  drafting: { label: 'Creating the draft', detail: 'Setting the learning goal, learner, and game identity.' },
  coding: { label: 'Programming the world', detail: 'Writing the complete game source inside the sandbox limits.' },
  validating: { label: 'Checking the build', detail: 'Inspecting source, runtime errors, and learning evidence.' },
  preview: { label: 'Playtest ready', detail: 'The latest revision is running in the live canvas.' },
  review: { label: 'Ready for human review', detail: 'Validated and saved locally. It has not been published.' },
  error: { label: 'Build needs attention', detail: 'The exact problem is available to the agent through diagnostics.' },
};

const buildPipeline = [
  ['Read capabilities', 'Inspect the canvas and safety contract.'],
  ['Create draft', 'Set the learner, goal, and revision.'],
  ['Write game source', 'Program the complete playable world.'],
  ['Validate', 'Check source, runtime, and evidence.'],
  ['Open playtest', 'Put the latest revision in the canvas.'],
] as const;

const phaseProgress: Record<StoredBuildPhase, number> = { idle: -1, handoff: -1, planning: 0, drafting: 1, coding: 2, validating: 3, preview: 4, review: 5, error: 3 };

function buildAgentPrompt(request: string) {
  const origin = typeof window === 'undefined' ? 'https://lantern.example' : window.location.origin;
  return `Open ${origin}. Use the page's WebMCP tools to create a kid-safe learning game. First call get_game_canvas_capabilities and list_saved_game_drafts. Continue a matching draft with resume_game_draft, or create one with create_game_draft. Write the complete game with set_game_source and open it with preview_game. Build a clear objective, interactive mechanics, useful feedback, accessible controls, and a short mastery challenge. Use lantern.evidence() to report learning and lantern.complete() when the learner demonstrates mastery; Lantern will handle the celebration. Check get_game_runtime_diagnostics, resolve errors, and then request review.\n\nGame request:\n${request.trim()}`;
}

function toolResult(ok: boolean, summary: string, data: Record<string, unknown> = {}) {
  return { content: [{ type: 'text', text: summary }], structuredContent: { ok, summary, ...data } };
}

function makeGameId(title: string, requestId: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'learning-game';
  return `${slug}-${requestId.slice(-6).toLowerCase()}`;
}

export default function LanternArcade() {
  const [request, setRequest] = useState(starterRequest);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [webMcp, setWebMcp] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [agentActive, setAgentActive] = useState(false);
  const [phase, setPhase] = useState<StoredBuildPhase>('idle');
  const [selectedGame, setSelectedGame] = useState<GameProject>(demoGames[0]);
  const [agentDraft, setAgentDraft] = useState<GameProject | null>(null);
  const [resumeCandidate, setResumeCandidate] = useState<GameProject | null>(null);
  const [savedGames, setSavedGames] = useState<GameProject[]>([]);
  const [evidence, setEvidence] = useState<GameEvidence[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const [storageState, setStorageState] = useState<'loading' | 'saved' | 'error'>('loading');
  const [activity, setActivity] = useState<BuildActivity[]>([]);
  const draftRef = useRef<GameProject | null>(null);
  const evidenceRef = useRef<GameEvidence[]>([]);
  const errorsRef = useRef<string[]>([]);
  const activityRef = useRef<BuildActivity[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const ledgerRef = useRef(new Map<string, unknown>());
  const workspaceRef = useRef<WorkspaceDraft>({ request: starterRequest, games: [], selectedGameId: null, evidence: [], runtimeErrors: {}, phase: 'idle' });
  const executeRef = useRef<(name: string, input: Record<string, unknown>) => unknown>(() => toolResult(false, 'Lantern is still preparing its game tools.'));

  function saveWorkspace(patch: Partial<WorkspaceDraft> = {}) {
    workspaceRef.current = { ...workspaceRef.current, ...patch };
    setStorageState(writeBrowserWorkspace(workspaceRef.current) ? 'saved' : 'error');
  }

  function addActivity(label: string, detail: string, tone?: BuildActivity['tone']) {
    activityRef.current = [{ id: Date.now() + Math.random(), label, detail, tone }, ...activityRef.current].slice(0, 5);
    setActivity(activityRef.current);
  }

  function markPhase(next: StoredBuildPhase, label?: string, detail?: string, tone?: BuildActivity['tone']) {
    setPhase(next);
    saveWorkspace({ phase: next });
    if (label) addActivity(label, detail || phaseCopy[next].detail, tone);
  }

  function persistProject(project: GameProject) {
    const games = [project, ...workspaceRef.current.games.filter((game) => game.id !== project.id)].slice(0, 8);
    setSavedGames(games);
    saveWorkspace({ games, selectedGameId: project.id });
  }

  function rememberEvidence(item: GameEvidence) {
    evidenceRef.current = [item, ...evidenceRef.current].slice(0, 40);
    setEvidence(evidenceRef.current);
    saveWorkspace({ evidence: evidenceRef.current });
  }

  function rememberRuntimeError(message: string) {
    const gameId = draftRef.current?.id || selectedGame.id;
    errorsRef.current = [message, ...errorsRef.current].slice(0, 12);
    setRuntimeErrors(errorsRef.current);
    saveWorkspace({ runtimeErrors: { ...workspaceRef.current.runtimeErrors, [gameId]: errorsRef.current }, phase: 'error' });
    setPhase('error');
    addActivity('Runtime issue captured', message, 'error');
  }

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      const stored = readBrowserWorkspace();
      if (stored) {
        const restoredRequest = !stored.request || stored.request === legacyStarterRequest ? starterRequest : stored.request;
        workspaceRef.current = { request: restoredRequest, games: stored.games, selectedGameId: stored.selectedGameId, evidence: stored.evidence, runtimeErrors: stored.runtimeErrors, phase: stored.phase };
        setRequest(restoredRequest);
        setSavedGames(stored.games);
        const candidate = stored.games.find((game) => game.id === stored.selectedGameId) || stored.games[0] || null;
        setResumeCandidate(candidate);
      }
      setStorageState('saved');
    }, 0);
    function onStorage(event: StorageEvent) {
      if (event.key !== WORKSPACE_KEY) return;
      const next = readBrowserWorkspace();
      if (!next) return;
      workspaceRef.current.games = next.games;
      setSavedGames(next.games);
      addActivity('Workspace changed in another tab', 'Resume the newest saved revision before editing.');
    }
    window.addEventListener('storage', onStorage);
    return () => { window.clearTimeout(hydrateTimer); window.removeEventListener('storage', onStorage); };
  }, []);

  useEffect(() => {
    executeRef.current = (name, input) => {
      setAgentActive(true);
      if (name === 'get_game_canvas_capabilities') {
        return toolResult(true, 'Lantern Arcade game-canvas capabilities are ready.', { capabilities: arcadeCapabilities, authoringBridge: { evidence: 'lantern.evidence({ event, detail, mastery? })', complete: 'lantern.complete({ mastery, detail? })', confetti: 'Mastery completion triggers host-controlled confetti automatically.' } });
      }
      if (name === 'get_game_runtime_diagnostics') {
        const requestedId = typeof input.gameId === 'string' ? input.gameId : draftRef.current?.id;
        const draft = requestedId ? workspaceRef.current.games.find((game) => game.id === requestedId) || (draftRef.current?.id === requestedId ? draftRef.current : null) : draftRef.current;
        const gameErrors = draft ? workspaceRef.current.runtimeErrors[draft.id] || [] : [];
        const gameEvidence = draft ? workspaceRef.current.evidence.filter((item) => item.gameId === draft.id) : [];
        return toolResult(true, draft ? `Diagnostics for ${draft.title}.` : 'No agent-authored draft exists yet.', { gameId: draft?.id || null, revision: draft?.revision || null, validationErrors: draft ? validateGameSource(draft) : [], runtimeErrors: gameErrors, recentEvidence: gameEvidence });
      }
      if (name === 'list_saved_game_drafts') {
        return toolResult(true, workspaceRef.current.games.length ? 'Browser-saved game drafts are available.' : 'No browser-saved game drafts exist yet.', {
          drafts: workspaceRef.current.games.map((game) => ({ gameId: game.id, title: game.title, subject: game.subject, ageBand: game.ageBand, revision: game.revision, status: game.status, learningGoal: game.learningGoal })),
        });
      }

      const requestId = String(input.requestId || '');
      if (!requestId) return toolResult(false, 'A requestId is required.', { code: 'invalid_request' });
      if (ledgerRef.current.has(requestId)) return ledgerRef.current.get(requestId);
      let result: unknown;

      if (name === 'resume_game_draft') {
        const project = workspaceRef.current.games.find((game) => game.id === String(input.gameId));
        if (!project) result = toolResult(false, 'The saved game draft was not found on this device.', { code: 'game_not_found' });
        else {
          draftRef.current = project;
          setAgentDraft(project);
          setSelectedGame(project);
          setResumeCandidate(null);
          const gameEvidence = workspaceRef.current.evidence.filter((item) => item.gameId === project.id);
          evidenceRef.current = gameEvidence;
          setEvidence(gameEvidence);
          errorsRef.current = workspaceRef.current.runtimeErrors[project.id] || [];
          setRuntimeErrors(errorsRef.current);
          markPhase('preview', 'Saved draft resumed', `${project.title} · revision ${project.revision}`);
          result = toolResult(true, `Resumed “${project.title}”.`, { gameId: project.id, revision: project.revision, status: project.status, nextTool: 'set_game_source' });
        }
      } else if (name === 'create_game_draft') {
        const project = blankAgentProject({ id: makeGameId(String(input.title || 'Learning game'), requestId), title: String(input.title || 'Learning game'), description: String(input.description || ''), learningGoal: String(input.learningGoal || ''), subject: String(input.subject || 'Learning'), ageBand: String(input.ageBand || 'Kids'), durationMinutes: Number(input.durationMinutes || 10) });
        draftRef.current = project;
        errorsRef.current = [];
        evidenceRef.current = [];
        setRuntimeErrors([]);
        setEvidence([]);
        setAgentDraft(project);
        setSelectedGame(project);
        setResumeCandidate(null);
        saveWorkspace({ runtimeErrors: { ...workspaceRef.current.runtimeErrors, [project.id]: [] } });
        persistProject(project);
        markPhase('drafting', 'Draft created', `${project.title} · revision ${project.revision}`);
        result = toolResult(true, `Created the game draft “${project.title}”.`, { gameId: project.id, revision: project.revision, status: project.status, nextTool: 'set_game_source' });
      } else if (name === 'set_game_source') {
        const draft = draftRef.current;
        if (!draft || draft.id !== String(input.gameId)) result = toolResult(false, 'The requested game draft was not found.', { code: 'game_not_found' });
        else if (draft.revision !== Number(input.expectedRevision)) result = toolResult(false, `Revision conflict. The current revision is ${draft.revision}.`, { code: 'revision_conflict', currentRevision: draft.revision });
        else {
          const source = { html: String(input.html || ''), css: String(input.css || ''), javascript: String(input.javascript || '') };
          const validationErrors = validateGameSource(source);
          if (validationErrors.length) {
            markPhase('error', 'Source rejected', validationErrors[0], 'error');
            result = toolResult(false, 'The game source did not pass Lantern’s safety validation.', { code: 'unsafe_game_source', validationErrors });
          } else {
            const next: GameProject = { ...draft, ...source, revision: draft.revision + 1 };
            draftRef.current = next;
            setAgentDraft(next);
            setSelectedGame(next);
            errorsRef.current = [];
            setRuntimeErrors([]);
            saveWorkspace({ runtimeErrors: { ...workspaceRef.current.runtimeErrors, [next.id]: [] } });
            persistProject(next);
            markPhase('coding', 'World programmed', `${next.title} · revision ${next.revision} is safely stored on this device.`);
            result = toolResult(true, `Updated the source for “${next.title}”.`, { gameId: next.id, revision: next.revision, status: next.status, nextTool: 'preview_game' });
          }
        }
      } else if (name === 'preview_game') {
        const draft = draftRef.current;
        if (!draft || draft.id !== String(input.gameId)) result = toolResult(false, 'The requested game draft was not found.', { code: 'game_not_found' });
        else {
          setSelectedGame(draft);
          persistProject(draft);
          markPhase('preview', 'Playtest opened', `${draft.title} is running in the live canvas.`, 'good');
          const gameErrors = workspaceRef.current.runtimeErrors[draft.id] || [];
          errorsRef.current = gameErrors;
          setRuntimeErrors(gameErrors);
          result = toolResult(true, `Opened “${draft.title}” in the visible sandboxed game canvas.`, { gameId: draft.id, revision: draft.revision, runtimeErrors: gameErrors });
        }
      } else if (name === 'request_game_review') {
        const draft = draftRef.current;
        if (!draft || draft.id !== String(input.gameId)) result = toolResult(false, 'The requested game draft was not found.', { code: 'game_not_found' });
        else if (draft.revision !== Number(input.expectedRevision)) result = toolResult(false, `Revision conflict. The current revision is ${draft.revision}.`, { code: 'revision_conflict', currentRevision: draft.revision });
        else {
          const validationErrors = validateGameSource(draft);
          const gameErrors = workspaceRef.current.runtimeErrors[draft.id] || [];
          if (validationErrors.length || gameErrors.length) {
            markPhase('error', 'Review blocked', 'Resolve validation and runtime issues first.', 'error');
            result = toolResult(false, 'Resolve validation and runtime errors before requesting review.', { code: 'game_not_ready', validationErrors, runtimeErrors: gameErrors });
          } else {
            const next: GameProject = { ...draft, revision: draft.revision + 1, status: 'review' };
            draftRef.current = next;
            setAgentDraft(next);
            setSelectedGame(next);
            persistProject(next);
            markPhase('review', 'Human review requested', `${next.title} is validated, saved, and not published.`, 'good');
            result = toolResult(true, `“${next.title}” is ready for parent or teacher review. It has not been published.`, { gameId: next.id, revision: next.revision, status: next.status });
          }
        }
      } else result = toolResult(false, `Unknown Lantern Arcade tool: ${name}`, { code: 'unsupported_tool' });
      ledgerRef.current.set(requestId, result);
      return result;
    };
  // The WebMCP dispatcher intentionally owns the current mutable workspace refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const context = document.modelContext || navigator.modelContext;
    const controller = new AbortController();
    let live = true;
    if (!context) {
      const timer = window.setTimeout(() => setWebMcp('unavailable'), 0);
      return () => { window.clearTimeout(timer); controller.abort(); };
    }
    Promise.all(arcadeToolDefinitions.map((definition) => Promise.resolve(context.registerTool({ ...definition, inputSchema: definition.inputSchema as unknown as Record<string, unknown>, annotations: definition.annotations ? definition.annotations as unknown as Record<string, unknown> : undefined, execute: (input: Record<string, unknown>) => executeRef.current(definition.name, input) }, { signal: controller.signal })))).then(() => live && setWebMcp('ready')).catch(() => live && setWebMcp('unavailable'));
    return () => { live = false; controller.abort(); };
  }, []);

  function updateRequest(value: string) {
    setRequest(value);
    workspaceRef.current.request = value;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveWorkspace({ request: value }), 240);
  }

  async function copyAgentPrompt() {
    const prompt = buildAgentPrompt(request);
    setCopyError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      markPhase('handoff', 'Agent instructions copied', 'Paste them into ChatGPT or another browser agent with WebMCP access.');
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = prompt;
      fallback.setAttribute('readonly', '');
      fallback.style.cssText = 'position:fixed;left:-9999px;opacity:0';
      document.body.appendChild(fallback);
      fallback.select();
      let fallbackCopied = false;
      try {
        fallbackCopied = document.execCommand('copy');
      } catch {
        fallbackCopied = false;
      } finally {
        fallback.remove();
      }
      if (fallbackCopied) {
        setCopied(true);
        markPhase('handoff', 'Agent instructions copied', 'Paste them into ChatGPT or another browser agent with WebMCP access.');
        window.setTimeout(() => setCopied(false), 2400);
      } else {
        setCopyError('Clipboard access was blocked. Copy the brief, then ask your browser agent to open this page and use its WebMCP tools.');
      }
    }
  }

  function resumeGame(game: GameProject) {
    draftRef.current = game;
    setAgentDraft(game);
    setSelectedGame(game);
    setResumeCandidate(null);
    const gameEvidence = workspaceRef.current.evidence.filter((item) => item.gameId === game.id);
    evidenceRef.current = gameEvidence;
    setEvidence(gameEvidence);
    errorsRef.current = workspaceRef.current.runtimeErrors[game.id] || [];
    setRuntimeErrors(errorsRef.current);
    markPhase(game.status === 'review' ? 'review' : 'preview', 'Local draft resumed', `${game.title} · revision ${game.revision}`);
    saveWorkspace({ selectedGameId: game.id });
  }

  function startFresh() {
    draftRef.current = null;
    evidenceRef.current = [];
    errorsRef.current = [];
    setAgentDraft(null);
    setResumeCandidate(null);
    setSelectedGame(demoGames.find((game) => game.id === 'fraction-forge') || demoGames[0]);
    setEvidence([]);
    setRuntimeErrors([]);
    setAgentActive(false);
    markPhase('idle');
    saveWorkspace({ selectedGameId: null, evidence: [] });
  }

  function removeSavedGame(gameId: string) {
    const game = workspaceRef.current.games.find((item) => item.id === gameId);
    if (!game || !window.confirm(`Remove “${game.title}” from this browser? This cannot be undone.`)) return;
    const games = workspaceRef.current.games.filter((game) => game.id !== gameId);
    const runtimeErrors = { ...workspaceRef.current.runtimeErrors };
    delete runtimeErrors[gameId];
    setSavedGames(games);
    if (draftRef.current?.id === gameId) startFresh();
    saveWorkspace({ games, runtimeErrors, selectedGameId: workspaceRef.current.selectedGameId === gameId ? null : workspaceRef.current.selectedGameId });
    if (resumeCandidate?.id === gameId) setResumeCandidate(null);
  }

  const buildIsBusy = ['planning', 'drafting', 'coding', 'validating'].includes(phase);
  const connectionLabel = webMcp === 'checking' ? 'Checking WebMCP' : webMcp === 'unavailable' ? 'WebMCP unavailable here' : agentActive ? buildIsBusy ? 'Agent connected and building' : 'Agent connected · ready' : 'WebMCP available · waiting for agent';
  const currentPhase = phaseCopy[phase];
  const progress = phaseProgress[phase];

  return (
    <main className="arcade-shell" id="main-content">
      <a className="skip-link" href="#create">Skip to game builder</a>
      <header className="arcade-nav">
        <a className="arcade-brand" href="/" aria-label="Lantern home"><span><LightbulbFilament size={23} weight="fill" /></span><b>Lantern</b></a>
        <nav aria-label="Primary navigation"><a href="#games">Games</a><a href="#grown-ups">Safeguards</a></nav>
      </header>

      <section className="calm-intro" aria-labelledby="lantern-title">
        <p>Agent-programmable learning games</p>
        <h1 id="lantern-title">Describe the lesson.<br /><em>Play the world.</em></h1>
        <div><span>Give your browser agent one learning goal. It writes the game, opens a safe playtest, and saves the result on this device.</span><a href="#create">Make a game <ArrowRight size={16} /></a></div>
      </section>

      <section className="game-workbench" id="create">
        <div className="workbench-body">
          <aside className="brief-pane">
            <span className="quiet-kicker">Build brief</span>
            <h2>What should they practise?</h2>
            <p>Name the learner, the skill, and a world they would enjoy.</p>
            <label className="workbench-prompt"><span className="sr-only">Learning game brief</span><textarea name="learning-game-brief" autoComplete="off" maxLength={2000} value={request} onChange={(event) => updateRequest(event.target.value)} rows={7} placeholder="Example: A bridge-building adventure for an 8-year-old learning equivalent fractions…" /></label>
            <button className="workbench-copy" type="button" onClick={copyAgentPrompt} disabled={!request.trim()}>{copied ? <Check size={18} weight="bold" /> : <Copy size={18} />}<span><b>{copied ? 'Handoff copied' : 'Copy for my browser agent'}</b><small>{copied ? 'Paste it into your agent.' : 'Includes this page and the build steps.'}</small></span></button>
            {copyError && <p className="copy-error" role="status" aria-live="polite">{copyError}</p>}
            <div className={`studio-status ${webMcp} ${agentActive ? 'active' : ''}`}><i /><span><b>{connectionLabel}</b><small>{currentPhase.label} · sandboxed on this device</small></span></div>
            {resumeCandidate && <aside className="workbench-resume"><span><FloppyDisk size={16} /><b>Resume {resumeCandidate.title}</b><small>Local revision {resumeCandidate.revision}</small></span><div><button type="button" onClick={() => resumeGame(resumeCandidate)}>Resume</button><button type="button" onClick={startFresh}>Ignore</button></div></aside>}
          </aside>

          <section className="playtest-pane">
            <header><div><span>Now playing</span><b>{selectedGame.title}</b></div><div><span className={`local-save ${storageState}`}><FloppyDisk size={14} /> {agentDraft ? storageState === 'error' ? 'Not saved' : 'Saved locally' : 'Demo game'}</span>{agentDraft && <a href={`/games/local/${agentDraft.id}`}>Open game page <ArrowRight size={14} /></a>}</div></header>
            <div className="workbench-canvas"><SandboxGameCanvas variant="workbench" key={`${selectedGame.id}-${selectedGame.revision}`} project={selectedGame} onEvidence={rememberEvidence} onRuntimeError={rememberRuntimeError} />{buildIsBusy && <div className="building-overlay"><span><Wrench size={25} weight="duotone" /></span><b>{currentPhase.label}</b><small>{currentPhase.detail}</small><i /></div>}</div>
          </section>

          <section className="workbench-drawer">
            <div className={`build-summary phase-${phase}`} aria-live="polite"><i /><span><b>{currentPhase.label}</b><small>{runtimeErrors[0] || currentPhase.detail}</small></span></div>
            <details><summary>Build details <span>{Math.max(0, progress + 1)} / 5</span></summary><div className="thread-pipeline">{buildPipeline.map(([label, detail], index) => <div className={`${index < progress ? 'complete' : ''} ${index === progress ? 'current' : ''}`} key={label}><i>{index < progress ? <Check size={9} weight="bold" /> : index + 1}</i><span><b>{label}</b><small>{detail}</small></span></div>)}</div>{activity.length > 0 && <div className="thread-events">{activity.slice(0, 3).map((item) => <div className={`thread-event ${item.tone || ''}`} key={item.id}><i /><span><b>{item.label}</b><small>{item.detail}</small></span></div>)}</div>}</details>
            <details><summary>Learning evidence <span>{evidence.length}</span></summary><p>{evidence[0]?.mastery || evidence[0]?.detail || 'Play the game to capture what the learner understands.'}</p></details>
            {savedGames.length > 0 && <details className="local-library"><summary>Saved games <span>{savedGames.length}</span></summary><div>{savedGames.map((game) => <article key={game.id}><button type="button" onClick={() => resumeGame(game)}><b>{game.title}</b><small>{game.subject} · r{game.revision}</small></button><a href={`/games/local/${game.id}`} aria-label={`Play ${game.title}`}><Play size={12} weight="fill" /></a><button type="button" onClick={() => removeSavedGame(game.id)} aria-label={`Remove ${game.title}`}><Trash size={12} /></button></article>)}</div></details>}
          </section>
        </div>
      </section>

      <section className="arcade-thesis"><span>WHAT LANTERN DOES</span><h2>Code becomes play.<br />Play becomes evidence.</h2><p>A browser agent can write a complete web game—not a dressed-up quiz—then run it safely, inspect the result, and preserve the draft on this device.</p><div className="runtime-spec"><span><b>WORLD</b> Canvas, WebGL, physics, shaders</span><span><b>INPUT</b> Touch, keyboard, audio</span><span><b>PROOF</b> Attempts, corrections, mastery</span></div></section>

      <section className="game-shelf" id="games"><div className="arcade-section-heading"><div><span>Playable proof</span><h2>Explore games built for learning</h2></div><p>Each demo uses a different game loop, gives useful feedback, and records evidence a grown-up can understand.</p></div><div className="game-card-grid">{demoGames.map((game) => <article className={`game-card game-card-${game.thumbnail} ${selectedGame.id === game.id ? 'selected' : ''}`} key={game.id}><div className="game-card-art" aria-hidden="true"><span /><span /><span /><GameController size={35} weight="duotone" /></div><div className="game-card-copy"><span>{game.subject} · {game.ageBand}</span><h3>{game.title}</h3><p>{game.description}</p></div><div className="game-card-footer"><small><Target size={14} weight="fill" /> {game.learningGoal}</small><a href={`/games/${game.id}`}><Play size={13} weight="fill" /> Play game</a></div></article>)}</div></section>

      <section className="grown-ups" id="grown-ups"><div><p className="arcade-eyebrow">For parents and teachers</p><h2>Creative freedom inside firm boundaries.</h2><p>Agents can invent mechanics and worlds. Games cannot quietly contact outside services, collect personal information, open new pages, or publish without review.</p></div><div className="safety-grid"><span><ShieldCheck size={21} weight="fill" /><b>No external network</b><small>Games run offline inside an isolated frame.</small></span><span><BracketsCurly size={21} weight="fill" /><b>Source validation</b><small>Unsafe APIs and oversized code are rejected.</small></span><span><FloppyDisk size={21} weight="fill" /><b>Device-local drafts</b><small>Work survives refreshes without leaving this browser.</small></span><span><Check size={21} weight="bold" /><b>Human review</b><small>Agents request review; they do not publish alone.</small></span></div></section>
      <footer className="arcade-footer"><a className="arcade-brand" href="/"><span><LightbulbFilament size={21} weight="fill" /></span><b>Lantern</b></a><p>Make a learning world from one sentence.</p><a href="#create">Build with your agent <ArrowRight size={15} /></a></footer>
    </main>
  );
}
