'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BracketsCurly, Check, Copy, Cube, FloppyDisk, GameController,
  LightbulbFilament, MagicWand, Play, ShieldCheck, Target, Trash, Wrench,
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
  const workspaceRef = useRef<WorkspaceDraft>({ request: starterRequest, games: [], selectedGameId: null, evidence: [], runtimeErrors: [], phase: 'idle' });
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
    errorsRef.current = [message, ...errorsRef.current].slice(0, 12);
    setRuntimeErrors(errorsRef.current);
    saveWorkspace({ runtimeErrors: errorsRef.current, phase: 'error' });
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
        markPhase('planning', 'Canvas contract read', 'The agent inspected renderers, safety limits, and the evidence bridge.');
        return toolResult(true, 'Lantern Arcade game-canvas capabilities are ready.', { capabilities: arcadeCapabilities, authoringBridge: { evidence: 'lantern.evidence({ event, detail, mastery? })', complete: 'lantern.complete({ mastery, detail? })', confetti: 'Mastery completion triggers host-controlled confetti automatically.' } });
      }
      if (name === 'get_game_runtime_diagnostics') {
        markPhase('validating', 'Build inspected', draftRef.current ? `Checked ${draftRef.current.title} and its latest evidence.` : 'No draft exists yet.');
        const draft = draftRef.current;
        return toolResult(true, draft ? `Diagnostics for ${draft.title}.` : 'No agent-authored draft exists yet.', { gameId: draft?.id || null, revision: draft?.revision || null, validationErrors: draft ? validateGameSource(draft) : [], runtimeErrors: errorsRef.current, recentEvidence: evidenceRef.current });
      }
      if (name === 'list_saved_game_drafts') {
        addActivity('Saved drafts inspected', `${workspaceRef.current.games.length} local ${workspaceRef.current.games.length === 1 ? 'draft' : 'drafts'} available.`);
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
          errorsRef.current = workspaceRef.current.runtimeErrors;
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
          result = toolResult(true, `Opened “${draft.title}” in the visible sandboxed game canvas.`, { gameId: draft.id, revision: draft.revision, runtimeErrors: errorsRef.current });
        }
      } else if (name === 'request_game_review') {
        const draft = draftRef.current;
        if (!draft || draft.id !== String(input.gameId)) result = toolResult(false, 'The requested game draft was not found.', { code: 'game_not_found' });
        else if (draft.revision !== Number(input.expectedRevision)) result = toolResult(false, `Revision conflict. The current revision is ${draft.revision}.`, { code: 'revision_conflict', currentRevision: draft.revision });
        else {
          const validationErrors = validateGameSource(draft);
          if (validationErrors.length || errorsRef.current.length) {
            markPhase('error', 'Review blocked', 'Resolve validation and runtime issues first.', 'error');
            result = toolResult(false, 'Resolve validation and runtime errors before requesting review.', { code: 'game_not_ready', validationErrors, runtimeErrors: errorsRef.current });
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
    await navigator.clipboard.writeText(buildAgentPrompt(request));
    setCopied(true);
    markPhase('handoff', 'Agent instructions copied', 'Paste them into ChatGPT or another browser agent with WebMCP access.');
    window.setTimeout(() => setCopied(false), 2400);
  }

  function resumeGame(game: GameProject) {
    draftRef.current = game;
    setAgentDraft(game);
    setSelectedGame(game);
    setResumeCandidate(null);
    const gameEvidence = workspaceRef.current.evidence.filter((item) => item.gameId === game.id);
    evidenceRef.current = gameEvidence;
    setEvidence(gameEvidence);
    errorsRef.current = workspaceRef.current.runtimeErrors;
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
    saveWorkspace({ selectedGameId: null, evidence: [], runtimeErrors: [] });
  }

  function removeSavedGame(gameId: string) {
    const games = workspaceRef.current.games.filter((game) => game.id !== gameId);
    setSavedGames(games);
    if (draftRef.current?.id === gameId) startFresh();
    saveWorkspace({ games, selectedGameId: workspaceRef.current.selectedGameId === gameId ? null : workspaceRef.current.selectedGameId });
    if (resumeCandidate?.id === gameId) setResumeCandidate(null);
  }

  const buildIsBusy = ['planning', 'drafting', 'coding', 'validating'].includes(phase);
  const connectionLabel = webMcp === 'checking' ? 'Checking WebMCP' : webMcp === 'unavailable' ? 'WebMCP unavailable here' : agentActive ? 'Agent connected and building' : 'WebMCP available · waiting for agent';
  const currentPhase = phaseCopy[phase];
  const progress = phaseProgress[phase];

  return (
    <main className="arcade-shell">
      <header className="arcade-nav">
        <Link className="arcade-brand" href="/" aria-label="Lantern home"><span><LightbulbFilament size={23} weight="fill" /></span><b>Lantern</b></Link>
        <nav aria-label="Primary navigation"><a href="#create">Make</a><a href="#games">Play</a><a href="#grown-ups">Safeguards</a></nav>
        <div className="arcade-nav-actions"><span className={`arcade-agent-state ${webMcp} ${agentActive ? 'active' : ''}`}>{connectionLabel}</span><button className="arcade-create-link" type="button" onClick={startFresh}>New brief</button></div>
      </header>

      <section className="game-workbench" id="create">
        <header className="workbench-topbar">
          <div><small>LANTERN / LOCAL GAME STUDIO</small><h1>Make a game</h1></div>
          <div className="workbench-file"><span>OPEN FILE</span><b>{selectedGame.title}</b><small>revision {selectedGame.revision} · {selectedGame.status}</small></div>
          <div className={`workbench-connection ${webMcp} ${agentActive ? 'active' : ''}`}><i /><span><b>{webMcp === 'ready' ? 'WebMCP available' : webMcp === 'checking' ? 'Checking WebMCP' : 'WebMCP unavailable'}</b><small>{agentActive ? 'Agent connected' : 'No agent connected'}</small></span></div>
        </header>

        <div className="workbench-body">
          <aside className="brief-pane">
            <div className="pane-label"><span>01</span><b>BUILD BRIEF</b></div>
            <h2>What should the player practise?</h2>
            <p>Describe one learner, one skill, and a game world they would want to explore.</p>
            <label className="workbench-prompt"><span className="sr-only">Learning game brief</span><textarea value={request} onChange={(event) => updateRequest(event.target.value)} rows={7} /></label>
            <ul className="brief-checklist"><li>Who is learning?</li><li>What should change after play?</li><li>What makes the world interesting?</li></ul>
            <button className="workbench-copy" type="button" onClick={copyAgentPrompt} disabled={!request.trim()}>{copied ? <Check size={18} weight="bold" /> : <Copy size={18} />}<span><b>{copied ? 'Handoff copied' : 'Copy handoff for my browser agent'}</b><small>{copied ? 'Paste it into your agent.' : 'URL, tools, limits, and build sequence included.'}</small></span></button>
            {resumeCandidate && <aside className="workbench-resume"><span><FloppyDisk size={16} /><b>Resume {resumeCandidate.title}</b><small>Local revision {resumeCandidate.revision}</small></span><div><button type="button" onClick={() => resumeGame(resumeCandidate)}>Resume</button><button type="button" onClick={startFresh}>Ignore</button></div></aside>}
          </aside>

          <section className="playtest-pane">
            <header><div className="pane-label"><span>02</span><b>PLAYTEST</b></div><div><span className={`local-save ${storageState}`}><FloppyDisk size={14} /> {agentDraft ? storageState === 'error' ? 'Not saved' : 'Saved on this device' : 'Example game'}</span>{agentDraft && <Link href={`/games/local/${agentDraft.id}`}>Open full page <ArrowRight size={14} /></Link>}</div></header>
            <div className="workbench-canvas"><SandboxGameCanvas variant="workbench" key={`${selectedGame.id}-${selectedGame.revision}`} project={selectedGame} onEvidence={rememberEvidence} onRuntimeError={rememberRuntimeError} />{buildIsBusy && <div className="building-overlay"><span><Wrench size={25} weight="duotone" /></span><b>{currentPhase.label}</b><small>{currentPhase.detail}</small><i /></div>}</div>
          </section>

          <aside className="inspector-pane">
            <section className="build-thread">
              <div className="pane-label"><span>03</span><b>BUILD THREAD</b></div>
              <div className={`thread-status phase-${phase}`} aria-live="polite"><i /> <span><b>{currentPhase.label}</b><small>{runtimeErrors[0] || currentPhase.detail}</small></span></div>
              <div className="thread-pipeline">{buildPipeline.map(([label, detail], index) => <div className={`${index < progress ? 'complete' : ''} ${index === progress ? 'current' : ''}`} key={label}><i>{index < progress ? <Check size={9} weight="bold" /> : index + 1}</i><span><b>{label}</b><small>{detail}</small></span></div>)}</div>
              {activity.length > 0 && <div className="thread-events"><em>RECENT ACTIVITY</em>{activity.slice(0, 2).map((item) => <div className={`thread-event ${item.tone || ''}`} key={item.id}><i /><span><b>{item.label}</b><small>{item.detail}</small></span></div>)}</div>}
            </section>
            <section className="evidence-inspector"><div className="inspector-heading"><b>LEARNING EVIDENCE</b><span>{evidence.length}</span></div><p>{evidence[0]?.mastery || evidence[0]?.detail || 'Playtest actions will show what the learner understands.'}</p></section>
            <section className="local-library"><div className="inspector-heading"><b>LOCAL DRAFTS</b><span>{savedGames.length}</span></div>{savedGames.length ? <div>{savedGames.map((game) => <article key={game.id}><button type="button" onClick={() => resumeGame(game)}><b>{game.title}</b><small>{game.subject} · r{game.revision}</small></button><Link href={`/games/local/${game.id}`} aria-label={`Play ${game.title}`}><Play size={12} weight="fill" /></Link><button type="button" onClick={() => removeSavedGame(game.id)} aria-label={`Remove ${game.title}`}><Trash size={12} /></button></article>)}</div> : <p>No local drafts yet.</p>}</section>
          </aside>
        </div>

        <footer className="workbench-statusbar"><span><BracketsCurly size={14} /> HTML / CSS / JS</span><span><Cube size={14} /> Canvas 2D / WebGL</span><span><ShieldCheck size={14} /> Isolated runtime</span><span><Target size={14} /> Evidence bridge</span></footer>
      </section>

      <section className="arcade-thesis"><span>WHAT LANTERN DOES</span><h2>Code becomes play.<br />Play becomes evidence.</h2><p>A browser agent can write a complete web game—not a dressed-up quiz—then run it safely, inspect the result, and preserve the draft on this device.</p><div className="runtime-spec"><span><b>WORLD</b> Canvas, WebGL, physics, shaders</span><span><b>INPUT</b> Touch, keyboard, audio</span><span><b>PROOF</b> Attempts, corrections, mastery</span></div></section>

      <section className="game-shelf" id="games"><div className="arcade-section-heading"><div><span>Playable proof</span><h2>Explore games built for learning</h2></div><p>Each demo uses a different game loop, gives useful feedback, and records evidence a grown-up can understand.</p></div><div className="game-card-grid">{demoGames.map((game) => <article className={`game-card game-card-${game.thumbnail} ${selectedGame.id === game.id ? 'selected' : ''}`} key={game.id}><div className="game-card-art" aria-hidden="true"><span /><span /><span /><GameController size={35} weight="duotone" /></div><div className="game-card-copy"><span>{game.subject} · {game.ageBand}</span><h3>{game.title}</h3><p>{game.description}</p></div><div className="game-card-footer"><small><Target size={14} weight="fill" /> {game.learningGoal}</small><Link href={`/games/${game.id}`}><Play size={13} weight="fill" /> Play game</Link></div></article>)}</div></section>

      <section className="arcade-how" id="how"><div className="arcade-section-heading"><div><span>The creation loop</span><h2>From one sentence to a game they can play.</h2></div></div><div className="how-grid"><article><i>1</i><MagicWand size={25} weight="duotone" /><h3>Describe the goal</h3><p>Say who is learning, what they need to understand, and what kind of world would excite them.</p></article><article><i>2</i><BracketsCurly size={25} weight="duotone" /><h3>Your agent builds</h3><p>WebMCP tools create the draft, program the game, validate it, and open a live playtest.</p></article><article><i>3</i><GameController size={25} weight="duotone" /><h3>The learner plays</h3><p>The sandbox turns code into an accessible game with keyboard, touch, sound, and fullscreen controls.</p></article><article><i>4</i><Target size={25} weight="duotone" /><h3>Learning becomes visible</h3><p>Mastery creates evidence and a brief celebration—not streaks, loot, or empty rewards.</p></article></div></section>

      <section className="grown-ups" id="grown-ups"><div><p className="arcade-eyebrow">For parents and teachers</p><h2>Creative freedom inside firm boundaries.</h2><p>Agents can invent mechanics and worlds. Games cannot quietly contact outside services, collect personal information, open new pages, or publish without review.</p></div><div className="safety-grid"><span><ShieldCheck size={21} weight="fill" /><b>No external network</b><small>Games run offline inside an isolated frame.</small></span><span><BracketsCurly size={21} weight="fill" /><b>Source validation</b><small>Unsafe APIs and oversized code are rejected.</small></span><span><FloppyDisk size={21} weight="fill" /><b>Device-local drafts</b><small>Work survives refreshes without leaving this browser.</small></span><span><Check size={21} weight="bold" /><b>Human review</b><small>Agents request review; they do not publish alone.</small></span></div></section>
      <footer className="arcade-footer"><Link className="arcade-brand" href="/"><span><LightbulbFilament size={21} weight="fill" /></span><b>Lantern</b></Link><p>Make a learning world from one sentence.</p><a href="#create">Build with your agent <ArrowRight size={15} /></a></footer>
    </main>
  );
}
