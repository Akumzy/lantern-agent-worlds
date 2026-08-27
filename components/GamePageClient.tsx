'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Check, GameController, LightbulbFilament, MagicWand, Play, ShieldCheck, Target } from '@phosphor-icons/react';
import type { GameEvidence, GameProject } from '../lib/arcade';
import { readBrowserWorkspace, writeBrowserWorkspace } from '../lib/browser-workspace';
import SandboxGameCanvas from './SandboxGameCanvas';

export default function GamePageClient({ game, related }: { game: GameProject; related: GameProject[] }) {
  const [evidence, setEvidence] = useState<GameEvidence[]>([]);
  const [runtimeError, setRuntimeError] = useState('');
  const mastery = evidence.find((item) => item.mastery)?.mastery;

  function rememberEvidence(item: GameEvidence) {
    setEvidence((current) => [item, ...current].slice(0, 10));
    if (game.source !== 'agent') return;
    const workspace = readBrowserWorkspace();
    if (!workspace) return;
    const { version: _version, updatedAt: _updatedAt, ...draft } = workspace;
    void _version; void _updatedAt;
    writeBrowserWorkspace({ ...draft, evidence: [item, ...workspace.evidence].slice(0, 40), selectedGameId: game.id });
  }

  function rememberRuntimeError(message: string) {
    setRuntimeError(message);
    if (game.source !== 'agent') return;
    const workspace = readBrowserWorkspace();
    if (!workspace) return;
    const { version: _version, updatedAt: _updatedAt, ...draft } = workspace;
    void _version; void _updatedAt;
    writeBrowserWorkspace({
      ...draft,
      runtimeErrors: { ...workspace.runtimeErrors, [game.id]: [message, ...(workspace.runtimeErrors[game.id] || [])].slice(0, 12) },
      phase: 'error',
      selectedGameId: game.id,
    });
  }

  return (
    <main className="game-page-shell">
      <header className="game-page-nav">
        <Link className="arcade-brand" href="/" aria-label="Lantern home"><span><LightbulbFilament size={22} weight="fill" /></span><b>Lantern</b></Link>
        <Link className="back-to-arcade" href="/#games"><ArrowLeft size={16} /> Back to games</Link>
        <div><span>{game.subject}</span><span>{game.ageBand}</span></div>
      </header>

      <section className="game-page-heading">
        <div><p>Playable learning game</p><h1>{game.title}</h1><span>{game.description}</span></div>
        <Link href="/#create"><MagicWand size={17} weight="duotone" /> Remix with my agent</Link>
      </section>

      <section className="game-play-layout">
        <SandboxGameCanvas
          project={game}
          onEvidence={rememberEvidence}
          onRuntimeError={rememberRuntimeError}
        />
        <aside className="game-mission-card">
          <div className="mission-label"><Target size={17} weight="fill" /> Mission</div>
          <h2>{game.learningGoal}</h2>
          <p>Try the challenge, notice what changes, and use the feedback to improve your next move.</p>
          <div className="mission-steps">
            <span className="active"><i>1</i><b>Play</b><small>Make a choice in the game.</small></span>
            <span className={evidence.length ? 'active' : ''}><i>2</i><b>Notice</b><small>Read what your action changed.</small></span>
            <span className={mastery ? 'active' : ''}><i>3</i><b>Show understanding</b><small>Complete the mastery challenge.</small></span>
          </div>
          <div className={`game-evidence-card ${mastery ? 'complete' : ''}`} aria-live="polite">
            {mastery ? <Check size={20} weight="bold" /> : <GameController size={20} weight="duotone" />}
            <div><span>{mastery ? 'Mastery evidence captured' : 'Waiting for game evidence'}</span><b>{mastery || evidence[0]?.detail || 'Play to make learning visible.'}</b></div>
          </div>
          {runtimeError && <p className="game-runtime-notice">The game reported an error. Restart it or ask the creating agent to inspect diagnostics.</p>}
          <div className="game-safety-note"><ShieldCheck size={17} weight="fill" /><span><b>Safe game frame</b><small>No external network, storage, or hidden navigation.</small></span></div>
        </aside>
      </section>

      <section className="related-games">
        <div><span>Keep exploring</span><h2>More games to play</h2></div>
        <div>{related.map((item) => <Link href={`/games/${item.id}`} key={item.id}><span>{item.subject} · {item.ageBand}</span><b>{item.title}</b><small>{item.learningGoal}</small><i><Play size={13} weight="fill" /> Play</i></Link>)}</div>
      </section>
    </main>
  );
}
