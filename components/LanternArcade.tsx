'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BracketsCurly, Check, Copy, Cube, GameController,
  LightbulbFilament, MagicWand, Play, Robot, ShieldCheck, Sparkle, Target,
} from '@phosphor-icons/react';
import {
  arcadeCapabilities, arcadeToolDefinitions, blankAgentProject, demoGames, validateGameSource,
  type GameEvidence, type GameProject,
} from '../lib/arcade';
import SandboxGameCanvas from './SandboxGameCanvas';

const starterRequest = 'A multiplication adventure for an 8-year-old who loves space. Practise the 6 times table with three short levels.';

function buildAgentPrompt(request: string) {
  const origin = typeof window === 'undefined' ? 'https://lantern.example' : window.location.origin;
  return `Open ${origin}. Use the page's WebMCP tools to create a kid-safe learning game. First call get_game_canvas_capabilities. Then create a draft with create_game_draft, write the complete game with set_game_source, and open it with preview_game. Build a clear objective, interactive mechanics, useful feedback, accessible controls, and a short mastery challenge. Use lantern.evidence() and lantern.complete() inside the game to report learning evidence. Check get_game_runtime_diagnostics and resolve errors before requesting review.\n\nGame request:\n${request.trim()}`;
}

function toolResult(ok: boolean, summary: string, data: Record<string, unknown> = {}) {
  return { content: [{ type: 'text', text: summary }], structuredContent: { ok, summary, ...data } };
}

function makeGameId(title: string, requestId: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'learning-game';
  return `${slug}-${requestId.slice(-6).toLowerCase()}`;
}

export default function LanternArcade() {
  const [placed, setPlaced] = useState(3);
  const [request, setRequest] = useState(starterRequest);
  const [copied, setCopied] = useState(false);
  const [webMcp, setWebMcp] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [selectedGame, setSelectedGame] = useState<GameProject>(demoGames[0]);
  const [agentDraft, setAgentDraft] = useState<GameProject | null>(null);
  const [evidence, setEvidence] = useState<GameEvidence[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<string[]>([]);
  const draftRef = useRef<GameProject | null>(null);
  const evidenceRef = useRef<GameEvidence[]>([]);
  const errorsRef = useRef<string[]>([]);
  const ledgerRef = useRef(new Map<string, unknown>());
  const executeRef = useRef<(name: string, input: Record<string, unknown>) => unknown>(() => toolResult(false, 'Lantern Arcade is still preparing its game tools.'));

  function rememberEvidence(item: GameEvidence) {
    evidenceRef.current = [item, ...evidenceRef.current].slice(0, 12);
    setEvidence(evidenceRef.current);
  }

  function rememberRuntimeError(message: string) {
    errorsRef.current = [message, ...errorsRef.current].slice(0, 8);
    setRuntimeErrors(errorsRef.current);
  }

  function openGame(project: GameProject) {
    setSelectedGame(project);
    window.setTimeout(() => document.getElementById('game-studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  }

  useEffect(() => {
    executeRef.current = (name, input) => {
    if (name === 'get_game_canvas_capabilities') {
      return toolResult(true, 'Lantern Arcade game-canvas capabilities are ready.', {
        capabilities: arcadeCapabilities,
        authoringBridge: { evidence: 'lantern.evidence({ event, detail, mastery? })', complete: 'lantern.complete({ mastery, detail? })' },
      });
    }
    if (name === 'get_game_runtime_diagnostics') {
      const draft = draftRef.current;
      return toolResult(true, draft ? `Diagnostics for ${draft.title}.` : 'No agent-authored draft exists yet.', {
        gameId: draft?.id || null, revision: draft?.revision || null,
        validationErrors: draft ? validateGameSource(draft) : [], runtimeErrors: errorsRef.current, recentEvidence: evidenceRef.current,
      });
    }

    const requestId = String(input.requestId || '');
    if (!requestId) return toolResult(false, 'A requestId is required.', { code: 'invalid_request' });
    if (ledgerRef.current.has(requestId)) return ledgerRef.current.get(requestId);
    let result: unknown;

    if (name === 'create_game_draft') {
      const project = blankAgentProject({
        id: makeGameId(String(input.title || 'Learning game'), requestId), title: String(input.title || 'Learning game'),
        description: String(input.description || ''), learningGoal: String(input.learningGoal || ''),
        subject: String(input.subject || 'Learning'), ageBand: String(input.ageBand || 'Kids'), durationMinutes: Number(input.durationMinutes || 10),
      });
      draftRef.current = project; errorsRef.current = []; setRuntimeErrors([]); setAgentDraft(project); setSelectedGame(project);
      result = toolResult(true, `Created the game draft “${project.title}”.`, { gameId: project.id, revision: project.revision, status: project.status, nextTool: 'set_game_source' });
    } else if (name === 'set_game_source') {
      const draft = draftRef.current;
      if (!draft || draft.id !== String(input.gameId)) result = toolResult(false, 'The requested game draft was not found.', { code: 'game_not_found' });
      else if (draft.revision !== Number(input.expectedRevision)) result = toolResult(false, `Revision conflict. The current revision is ${draft.revision}.`, { code: 'revision_conflict', currentRevision: draft.revision });
      else {
        const source = { html: String(input.html || ''), css: String(input.css || ''), javascript: String(input.javascript || '') };
        const validationErrors = validateGameSource(source);
        if (validationErrors.length) result = toolResult(false, 'The game source did not pass Lantern’s safety validation.', { code: 'unsafe_game_source', validationErrors });
        else {
          const next = { ...draft, ...source, revision: draft.revision + 1 };
          draftRef.current = next; setAgentDraft(next); setSelectedGame(next); errorsRef.current = []; setRuntimeErrors([]);
          result = toolResult(true, `Updated the source for “${next.title}”.`, { gameId: next.id, revision: next.revision, status: next.status, nextTool: 'preview_game' });
        }
      }
    } else if (name === 'preview_game') {
      const draft = draftRef.current;
      if (!draft || draft.id !== String(input.gameId)) result = toolResult(false, 'The requested game draft was not found.', { code: 'game_not_found' });
      else {
        setSelectedGame(draft);
        window.setTimeout(() => document.getElementById('game-studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        result = toolResult(true, `Opened “${draft.title}” in the visible sandboxed game canvas.`, { gameId: draft.id, revision: draft.revision, runtimeErrors: errorsRef.current });
      }
    } else if (name === 'request_game_review') {
      const draft = draftRef.current;
      if (!draft || draft.id !== String(input.gameId)) result = toolResult(false, 'The requested game draft was not found.', { code: 'game_not_found' });
      else if (draft.revision !== Number(input.expectedRevision)) result = toolResult(false, `Revision conflict. The current revision is ${draft.revision}.`, { code: 'revision_conflict', currentRevision: draft.revision });
      else {
        const validationErrors = validateGameSource(draft);
        if (validationErrors.length || errorsRef.current.length) result = toolResult(false, 'Resolve validation and runtime errors before requesting review.', { code: 'game_not_ready', validationErrors, runtimeErrors: errorsRef.current });
        else {
          const next: GameProject = { ...draft, revision: draft.revision + 1, status: 'review' };
          draftRef.current = next; setAgentDraft(next); setSelectedGame(next);
          result = toolResult(true, `“${next.title}” is ready for parent or teacher review. It has not been published.`, { gameId: next.id, revision: next.revision, status: next.status });
        }
      }
    } else result = toolResult(false, `Unknown Lantern Arcade tool: ${name}`, { code: 'unsupported_tool' });
    ledgerRef.current.set(requestId, result);
      return result;
    };
  }, []);

  useEffect(() => {
    const context = document.modelContext || navigator.modelContext;
    const controller = new AbortController();
    let live = true;
    if (!context) {
      const timer = window.setTimeout(() => setWebMcp('unavailable'), 0);
      return () => { window.clearTimeout(timer); controller.abort(); };
    }
    Promise.all(arcadeToolDefinitions.map((definition) => Promise.resolve(context.registerTool({
      ...definition, inputSchema: definition.inputSchema as unknown as Record<string, unknown>,
      annotations: definition.annotations ? definition.annotations as unknown as Record<string, unknown> : undefined,
      execute: (input: Record<string, unknown>) => executeRef.current(definition.name, input),
    }, { signal: controller.signal })))).then(() => live && setWebMcp('ready')).catch(() => live && setWebMcp('unavailable'));
    return () => { live = false; controller.abort(); };
  }, []);

  async function copyAgentPrompt() {
    await navigator.clipboard.writeText(buildAgentPrompt(request)); setCopied(true); window.setTimeout(() => setCopied(false), 2400);
  }

  return (
    <main className="arcade-shell">
      <header className="arcade-nav">
        <Link className="arcade-brand" href="/" aria-label="Lantern home"><span><LightbulbFilament size={23} weight="fill" /></span><b>Lantern</b></Link>
        <nav aria-label="Primary navigation"><a href="#games">Play games</a><a href="#how">How it works</a><a href="#grown-ups">For grown-ups</a></nav>
        <div className="arcade-nav-actions"><span className={`arcade-agent-state ${webMcp}`}>{webMcp === 'ready' ? 'Agent canvas ready' : 'WebMCP canvas'}</span><a className="arcade-create-link" href="#create">Create a game</a></div>
      </header>

      <section className="arcade-hero">
        <div className="arcade-hero-copy">
          <p className="arcade-eyebrow">The AI-programmable learning arcade</p><h1>Describe a game.<br /><em>Learn by playing.</em></h1>
          <p className="arcade-deck">Your browser agent turns any learning goal into a safe web game kids can play right here.</p>
          <div className="arcade-trust-row"><span><ShieldCheck size={18} weight="fill" /> Kid-safe runtime</span><span><Sparkle size={18} weight="fill" /> Powered by WebMCP</span></div>
          <a className="arcade-play-link" href="#fraction-forge"><Play size={17} weight="fill" /> Play the demo</a>
        </div>
        <section className="fraction-forge" id="fraction-forge" aria-label="Playable Fraction Forge demo">
          <div className="forge-toolbar"><div><span className="forge-live-dot" /> Playable demo</div><b>Fraction Forge</b><button type="button" onClick={() => setPlaced(0)}>Reset</button></div>
          <div className="forge-world">
            <div className="forge-mission">Build <strong>3/4</strong> of the bridge</div><div className="forge-island forge-island-left" aria-hidden="true" /><div className="forge-island forge-island-right" aria-hidden="true" /><div className="forge-guide" aria-hidden="true"><Robot size={38} weight="duotone" /></div>
            <div className="bridge" aria-label={`${Math.min(placed, 3)} of 4 equal bridge parts placed`}>{[0, 1, 2, 3].map((piece) => <span key={piece} className={piece < placed ? 'placed' : ''} />)}</div>
            {placed < 3 ? <button className="bridge-piece" type="button" onClick={() => setPlaced((value) => Math.min(3, value + 1))}>Place the next piece</button> : <div className="forge-success"><Check size={18} weight="bold" /> 3 of 4 equal parts</div>}
          </div>
          <div className="forge-evidence"><span>Learning evidence</span><b>{placed >= 3 ? 'Understands part–whole relationships' : 'Keep building the bridge'}</b></div>
        </section>
      </section>

      <section className="arcade-create" id="create">
        <div className="arcade-create-copy"><span>Create with your browser agent</span><h2>Create a new learning game</h2><p>Describe the learner, goal, and kind of game. Lantern prepares a complete handoff prompt for your agent.</p></div>
        <label className="arcade-request"><span className="sr-only">Describe the learning game</span><textarea value={request} onChange={(event) => setRequest(event.target.value)} rows={3} /><div><span>Age 8</span><span>Maths</span><span>10 minutes</span></div></label>
        <div className="arcade-copy-action"><button type="button" onClick={copyAgentPrompt} disabled={!request.trim()}>{copied ? <Check size={19} weight="bold" /> : <Copy size={19} />}{copied ? 'Copied — paste into your agent' : 'Copy agent prompt'}</button><small>Includes this site URL, tool names, and safe game-building instructions.</small><code>Open Lantern and use its WebMCP tools to create…</code></div>
      </section>

      <section className="game-shelf" id="games">
        <div className="arcade-section-heading"><div><span>Made inside Lantern</span><h2>Play what other agents made</h2></div><p>Every game has a clear learning goal, immediate feedback, and evidence a grown-up can understand.</p></div>
        <div className="game-card-grid">{demoGames.map((game) => <article className={`game-card game-card-${game.thumbnail} ${selectedGame.id === game.id ? 'selected' : ''}`} key={game.id}><div className="game-card-art" aria-hidden="true"><span /><span /><span /><GameController size={35} weight="duotone" /></div><div className="game-card-copy"><span>{game.subject} · {game.ageBand}</span><h3>{game.title}</h3><p>{game.description}</p></div><div className="game-card-footer"><small><Target size={14} weight="fill" /> {game.learningGoal}</small><button type="button" onClick={() => openGame(game)}><Play size={13} weight="fill" /> Play</button></div></article>)}</div>
      </section>

      <section className="arcade-studio" id="game-studio">
        <div className="studio-copy"><p className="arcade-eyebrow">One canvas, any web game</p><h2>Your agent can program the whole world.</h2><p>Lantern accepts HTML, CSS, Canvas 2D, WebGL, render loops, physics, audio, and shaders—then runs the result inside an isolated, no-network game frame.</p><div className="runtime-chip-grid"><span><BracketsCurly size={18} /> HTML + CSS + JS</span><span><Cube size={18} /> 2D + 3D</span><span><Sparkle size={18} /> GLSL shaders</span><span><Target size={18} /> Mastery events</span></div><div className="studio-state"><span>{agentDraft ? 'Agent draft' : 'Selected demo'}</span><b>{selectedGame.title}</b><small>{agentDraft ? `${agentDraft.status} · revision ${agentDraft.revision}` : 'Choose any game above, or ask your agent to make one.'}</small></div><div className="evidence-log" aria-live="polite"><span>Live evidence</span>{runtimeErrors.length > 0 ? <p className="runtime-error">{runtimeErrors[0]}</p> : evidence.length > 0 ? <p><Check size={15} weight="bold" /> {evidence[0].mastery || evidence[0].detail}</p> : <p>Play the game. Lantern will record what the interaction demonstrates.</p>}</div></div>
        <SandboxGameCanvas key={`${selectedGame.id}-${selectedGame.revision}`} project={selectedGame} onEvidence={rememberEvidence} onRuntimeError={rememberRuntimeError} />
      </section>

      <section className="arcade-how" id="how"><div className="arcade-section-heading"><div><span>The creation loop</span><h2>From one sentence to a game they can play.</h2></div></div><div className="how-grid"><article><i>1</i><MagicWand size={25} weight="duotone" /><h3>Describe the goal</h3><p>Say who is learning, what they need to understand, and what kind of game would excite them.</p></article><article><i>2</i><BracketsCurly size={25} weight="duotone" /><h3>Your agent builds</h3><p>WebMCP tools create the draft, write the game source, preview it, and return useful diagnostics.</p></article><article><i>3</i><GameController size={25} weight="duotone" /><h3>A child plays</h3><p>The sandbox turns code into an accessible game with keyboard, touch, sound, and fullscreen controls.</p></article><article><i>4</i><Target size={25} weight="duotone" /><h3>Learning becomes visible</h3><p>The game reports attempts and mastery—not time spent, streaks, or addictive reward loops.</p></article></div></section>

      <section className="grown-ups" id="grown-ups"><div><p className="arcade-eyebrow">For parents and teachers</p><h2>Creative freedom inside firm boundaries.</h2><p>Agents can invent mechanics and worlds. They cannot quietly contact outside services, collect personal information, open new pages, or publish without review.</p></div><div className="safety-grid"><span><ShieldCheck size={21} weight="fill" /><b>No external network</b><small>Games run offline inside an isolated frame.</small></span><span><BracketsCurly size={21} weight="fill" /><b>Source validation</b><small>Unsafe APIs and oversized code are rejected.</small></span><span><Target size={21} weight="fill" /><b>Meaningful evidence</b><small>Rewards explain what the learner demonstrated.</small></span><span><Check size={21} weight="bold" /><b>Human review</b><small>Agents request review; they do not publish alone.</small></span></div></section>

      <footer className="arcade-footer"><Link className="arcade-brand" href="/"><span><LightbulbFilament size={21} weight="fill" /></span><b>Lantern</b></Link><p>Describe a game. Learn by playing.</p><a href="#create">Create with your agent <ArrowRight size={15} /></a></footer>
    </main>
  );
}
