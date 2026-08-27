'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowsOut, ArrowCounterClockwise, CheckCircle, Play, WarningCircle } from '@phosphor-icons/react';
import type { GameEvidence, GameProject } from '../lib/arcade';
import { hasCelebrated, rememberCelebration } from '../lib/browser-workspace';

type Props = {
  project: GameProject;
  onEvidence?: (evidence: GameEvidence) => void;
  onRuntimeError?: (message: string) => void;
  variant?: 'default' | 'workbench';
};

function safeScript(value: string) {
  return value.replace(/<\/script/gi, '<\\/script');
}

function makeDocument(project: GameProject, token: string) {
  const bridge = `(() => { const send=(type,payload={})=>parent.postMessage({source:'lantern-game',token:${JSON.stringify(token)},type,payload},'*'); window.lantern=Object.freeze({ evidence:(payload)=>send('evidence',payload), complete:(payload)=>send('complete',payload), confetti:(payload)=>send('confetti',payload) }); window.addEventListener('error',(event)=>send('runtime-error',{message:event.message||'Game runtime error'})); window.addEventListener('unhandledrejection',(event)=>send('runtime-error',{message:String(event.reason||'Unhandled game error')})); send('ready',{title:${JSON.stringify(project.title)}}); })();`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; font-src 'none';"><style>${project.css}</style></head><body>${project.html}<script>${safeScript(bridge)}<\/script><script>${safeScript(project.javascript)}<\/script></body></html>`;
}

function readableDetail(value: unknown, fallback: string) {
  if (typeof value === 'string') return value.slice(0, 800);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    try {
      return Object.entries(value as Record<string, unknown>).slice(0, 10).map(([key, item]) => `${key}: ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`).join(' · ').slice(0, 800);
    } catch { return fallback; }
  }
  return fallback;
}

function evidenceFromPayload(project: GameProject, payload: Record<string, unknown> | undefined, complete: boolean): GameEvidence | null {
  if (!payload || typeof payload !== 'object') return null;
  const event = typeof payload.event === 'string' ? payload.event.trim().slice(0, 80) : complete ? 'mastery' : 'interaction';
  const mastery = typeof payload.mastery === 'string' ? payload.mastery.trim().slice(0, 320) : undefined;
  const detail = readableDetail(payload.detail, complete ? 'Learning challenge completed.' : 'Game interaction recorded.');
  if (!event || (!detail && !mastery)) return null;
  return { gameId: project.id, event, detail, mastery: mastery || undefined, at: new Date().toISOString() };
}

export default function SandboxGameCanvas({ project, onEvidence, onRuntimeError, variant = 'default' }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'complete' | 'error'>('loading');
  const [celebration, setCelebration] = useState(0);
  const completedRef = useRef(false);
  const instanceId = useId();
  const token = useMemo(() => `${instanceId}-${project.id}-${project.revision}-${run}`, [instanceId, project.id, project.revision, run]);
  const source = useMemo(() => makeDocument(project, token), [project, token]);

  useEffect(() => {
    const readyFallback = window.setTimeout(() => {
      setStatus((current) => current === 'loading' ? 'ready' : current);
    }, 500);
    return () => window.clearTimeout(readyFallback);
  }, [token]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { source?: string; token?: string; type?: string; payload?: Record<string, unknown> };
      if (data.source !== 'lantern-game' || data.token !== token) return;
      if (data.type === 'ready') setStatus('ready');
      if (data.type === 'runtime-error') {
        const message = String(data.payload?.message || 'Game runtime error');
        setStatus('error');
        onRuntimeError?.(message);
      }
      if (data.type === 'evidence' || data.type === 'complete') {
        const complete = data.type === 'complete';
        const item = evidenceFromPayload(project, data.payload, complete);
        if (!item) {
          onRuntimeError?.('The game sent invalid learning evidence.');
          return;
        }
        if (complete) {
          completedRef.current = true;
          setStatus('complete');
          if (!hasCelebrated(project.id, project.revision)) {
            rememberCelebration(project.id, project.revision);
            setCelebration((value) => value + 1);
            window.setTimeout(() => setCelebration(0), 1600);
          }
        }
        onEvidence?.(item);
      }
      if (data.type === 'confetti' && completedRef.current && !hasCelebrated(project.id, project.revision)) {
        rememberCelebration(project.id, project.revision);
        setCelebration((value) => value + 1);
        window.setTimeout(() => setCelebration(0), 1600);
      }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onEvidence, onRuntimeError, project, token]);

  async function enterFullscreen() {
    await shellRef.current?.requestFullscreen?.();
  }

  return (
    <section className={`sandbox-game ${variant === 'workbench' ? 'sandbox-workbench' : ''}`} ref={shellRef} aria-label={`${project.title} game canvas`}>
      <header>
        <div>
          <span className={`sandbox-status ${status}`} />
          <small>{project.source === 'agent' ? 'Agent-created draft' : 'Playable demo'}</small>
          <b>{project.title}</b>
        </div>
        <div className="sandbox-actions">
          <button type="button" onClick={() => { setStatus('loading'); setRun((value) => value + 1); }} aria-label="Restart game"><ArrowCounterClockwise size={16} /></button>
          <button type="button" onClick={enterFullscreen} aria-label="Open game fullscreen"><ArrowsOut size={16} /></button>
        </div>
      </header>
      <div className="sandbox-frame-wrap">
        {status === 'loading' && <div className="sandbox-loading"><Play size={20} weight="fill" /> Preparing game…</div>}
        <iframe
          ref={frameRef}
          key={`${project.id}-${project.revision}-${run}`}
          title={`${project.title} playable game`}
          sandbox="allow-scripts"
          srcDoc={source}
          onLoad={() => setStatus((current) => current === 'loading' ? 'ready' : current)}
        />
        {celebration > 0 && <div className="sandbox-confetti" key={celebration} aria-hidden="true">{Array.from({ length: 34 }, (_, index) => <i key={index} style={{ left: `${(index * 37) % 101}%`, animationDelay: `${(index % 9) * 35}ms`, background: ['#3454e7','#ffb43a','#2ecf9a','#f3665e','#8c6cff'][index % 5], transform: `rotate(${index * 29}deg)` } as CSSProperties} />)}</div>}
        {status === 'complete' && <div className="sandbox-complete" role="status" aria-live="polite"><CheckCircle size={18} weight="fill" /> Mastery evidence captured</div>}
        {status === 'error' && <div className="sandbox-error"><WarningCircle size={18} weight="fill" /> Runtime error captured for the agent</div>}
      </div>
      <footer>
        <div><span>Learning goal</span><b>{project.learningGoal}</b></div>
        <div><span>Runtime</span><b>Isolated web game</b></div>
        <div><span>Revision</span><b>{project.revision}</b></div>
      </footer>
    </section>
  );
}
