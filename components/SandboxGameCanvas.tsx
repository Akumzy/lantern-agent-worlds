'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowsOut, ArrowCounterClockwise, CheckCircle, Play, WarningCircle } from '@phosphor-icons/react';
import type { GameEvidence, GameProject } from '../lib/arcade';

type Props = {
  project: GameProject;
  onEvidence?: (evidence: GameEvidence) => void;
  onRuntimeError?: (message: string) => void;
};

function safeScript(value: string) {
  return value.replace(/<\/script/gi, '<\\/script');
}

function makeDocument(project: GameProject, token: string) {
  const bridge = `(() => { const send=(type,payload={})=>parent.postMessage({source:'lantern-game',token:${JSON.stringify(token)},type,payload},'*'); window.lantern=Object.freeze({ evidence:(payload)=>send('evidence',payload), complete:(payload)=>send('complete',payload) }); window.addEventListener('error',(event)=>send('runtime-error',{message:event.message||'Game runtime error'})); window.addEventListener('unhandledrejection',(event)=>send('runtime-error',{message:String(event.reason||'Unhandled game error')})); send('ready',{title:${JSON.stringify(project.title)}}); })();`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; font-src 'none';"><style>${project.css}</style></head><body>${project.html}<script>${safeScript(bridge)}<\/script><script>${safeScript(project.javascript)}<\/script></body></html>`;
}

export default function SandboxGameCanvas({ project, onEvidence, onRuntimeError }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'complete' | 'error'>('loading');
  const instanceId = useId();
  const token = useMemo(() => `${instanceId}-${project.id}-${project.revision}-${run}`, [instanceId, project.id, project.revision, run]);
  const source = useMemo(() => makeDocument(project, token), [project, token]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { source?: string; token?: string; type?: string; payload?: Record<string, unknown> };
      if (data.source !== 'lantern-game' || data.token !== token) return;
      if (data.type === 'ready') setStatus('ready');
      if (data.type === 'complete') setStatus('complete');
      if (data.type === 'runtime-error') {
        const message = String(data.payload?.message || 'Game runtime error');
        setStatus('error');
        onRuntimeError?.(message);
      }
      if (data.type === 'evidence' || data.type === 'complete') {
        onEvidence?.({
          gameId: project.id,
          event: String(data.payload?.event || data.type),
          detail: String(data.payload?.detail || (data.type === 'complete' ? 'Learning challenge completed.' : 'Game interaction recorded.')),
          mastery: data.payload?.mastery ? String(data.payload.mastery) : undefined,
          at: new Date().toISOString(),
        });
      }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onEvidence, onRuntimeError, project.id, token]);

  async function enterFullscreen() {
    await shellRef.current?.requestFullscreen?.();
  }

  return (
    <section className="sandbox-game" ref={shellRef} aria-label={`${project.title} game canvas`}>
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
        />
        {status === 'complete' && <div className="sandbox-complete"><CheckCircle size={18} weight="fill" /> Mastery evidence captured</div>}
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
