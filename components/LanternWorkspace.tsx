'use client';
/* JSON-schema tool inputs are validated at the WebMCP boundary. */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BookOpenText, CaretDown, ChatCircleDots, CheckCircle, Circle,
  Clock, LightbulbFilament, NotePencil, PlayCircle, Robot, Sparkle,
} from '@phosphor-icons/react';
import { toolDefinitions } from '../lib/tools';
import type { LanternState } from '../lib/lantern';
import LearningCanvas from './LearningCanvas';

type Result = { ok:boolean; revision?:number; summary:string; code?:string; correct?:boolean; hint?:string; explanation?:string; attemptsUsed?:number; maxAttempts?:number };
type LessonTab = 'canvas' | 'notes' | 'signals';

async function post(body:Record<string,unknown>) {
  const response = await fetch('/api/state', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  return await response.json();
}

function Logo() {
  return <span className="brand-mark" aria-hidden="true"><LightbulbFilament size={20} weight="fill" /></span>;
}

export default function LanternWorkspace() {
  const [state,setState] = useState<LanternState|null>(null), [loading,setLoading] = useState(true), [webMcp,setWebMcp] = useState<'checking'|'ready'|'unavailable'>('unavailable');
  const [question,setQuestion] = useState(''), [note,setNote] = useState(''), [toast,setToast] = useState(''), [busy,setBusy] = useState(false), [activeTab,setActiveTab] = useState<LessonTab>('canvas');
  const refresh = useCallback(async () => { const response = await fetch('/api/state',{cache:'no-store'}); const data = await response.json(); if (data.revision !== undefined) setState(data); setLoading(false); },[]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(),0); return () => window.clearTimeout(timer); },[refresh]);
  useEffect(() => {
    const controller = new AbortController(), context = document.modelContext || navigator.modelContext;
    if (!context) return () => controller.abort();
    let live = true;
    Promise.all(toolDefinitions.map(tool => Promise.resolve(context.registerTool({...tool, execute:async(input:Record<string,unknown>) => { const result = await post({kind:'tool',name:tool.name,args:input}); if (result.ok && !tool.annotations?.readOnlyHint) window.dispatchEvent(new Event('lantern-state-changed')); return result; }},{signal:controller.signal})))).then(() => live && setWebMcp('ready')).catch(() => live && setWebMcp('unavailable'));
    const update = () => refresh(); window.addEventListener('lantern-state-changed',update);
    return () => { live = false; controller.abort(); window.removeEventListener('lantern-state-changed',update); };
  },[refresh]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''),4200); return () => clearTimeout(timer); },[toast]);

  const course = state?.courses.find(item => item.id === state.activeCourseId) || state?.courses[0];
  const lesson = course?.lessons.find(item => item.id === course.activeLessonId) || course?.lessons[0];
  const notes = state?.notes.filter(item => item.courseId === course?.id && item.lessonId === lesson?.id) || [];
  const lessonRequests = state?.requests.filter(item => item.lessonId === lesson?.id) || [];
  const proposed = state?.adaptations.find(item => item.courseId === course?.id && item.status === 'proposed');
  const latestChange = state?.changes.find(item => item.courseId === course?.id && !item.undone && item.revision === state.revision);

  async function tool(name:string,args:Record<string,unknown>) { if (!state) return {ok:false,summary:'Lantern is still loading.'} as Result; const result = await post({kind:'tool',name,args:{...args,requestId:crypto.randomUUID(),expectedRevision:state.revision}}); setToast(result.summary); if (result.ok) await refresh(); return result; }
  async function learner(args:Record<string,unknown>) { if (!course || !lesson) return {ok:false,summary:'No active lesson.'} as Result; const result = await post({kind:'learner',args:{...args,courseId:course.id,lessonId:lesson.id}}); setToast(result.summary); if (result.ok) await refresh(); return result; }
  async function saveQuestion() { if (!question.trim()) return; setBusy(true); const result = await learner({type:'question',content:question.trim(),responseMode:'inline beside lesson'}); if (result.ok) setQuestion(''); setBusy(false); }
  async function saveNote() { if (!note.trim()) return; setBusy(true); const result = await learner({type:'note',content:note.trim()}); if (result.ok) setNote(''); setBusy(false); }
  function openLesson(id:string) { setActiveTab('canvas'); return tool('navigate_to_learning_item',{lessonId:id}); }

  if (loading || !state || !course || !lesson) return <main className="loading-screen"><Logo/><p>Opening your learning workspace…</p></main>;
  const currentIndex = course.lessons.findIndex(item => item.id === lesson.id), nextLesson = course.lessons[currentIndex + 1];
  const attemptCounts = Object.fromEntries(lesson.quiz.map(item => [item.id,state.attempts.filter(attempt => attempt.questionId === item.id).length]));
  const completedProgress = Math.max(course.progress,Math.round((course.lessons.filter(item => item.status === 'completed' || item.id === lesson.id).length / Math.max(1,course.lessons.length)) * 100));

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Lantern home"><Logo/><span>Lantern</span></Link>
        <label className="course-switcher"><BookOpenText size={17} /><span className="sr-only">Active course</span><select value={course.id} onChange={event => tool('navigate_to_learning_item',{courseId:event.target.value})}>{state.courses.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><CaretDown size={15} /></label>
        <div className={`agent-state ${webMcp}`} role="status"><span className="agent-pulse" aria-hidden="true"/><span><b>{webMcp === 'ready' ? 'Agent tools ready' : 'Agent tools unavailable'}</b><small>{webMcp === 'ready' ? 'No agent is listening right now' : 'WebMCP is not available in this browser'}</small></span></div>
      </header>

      <aside className="outline-panel" aria-label="Course outline">
        <div className="outline-course"><span><BookOpenText size={18} weight="fill" /></span><div><small>Your course</small><b>{course.title}</b></div></div>
        <div className="outline-heading"><span>{course.lessons.length} lessons</span><b>{course.progress}% complete</b></div>
        <div className="progress-track"><i style={{width:`${course.progress}%`}}/></div>
        <div className="outline-scroll">{course.chapters.map((chapter,chapterIndex) => <section key={chapter.id} className="chapter-group"><p className="chapter-label">{String(chapterIndex + 1).padStart(2,'0')} · {chapter.title}</p><nav className="lesson-path">{chapter.lessonIds.map(id => { const item = course.lessons.find(entry => entry.id === id); if (!item) return null; return <button className={`lesson-link ${item.id === lesson.id ? 'active' : item.status}`} onClick={() => openLesson(item.id)} key={item.id}><span className="lesson-node">{item.status === 'completed' ? <CheckCircle size={17} weight="fill" /> : item.id === lesson.id ? <PlayCircle size={17} weight="fill" /> : <Circle size={17} />}</span><span><b>{item.title}</b><small><Clock size={12} /> {item.minutes} min</small></span></button>; })}</nav></section>)}</div>
        <button className="outline-action" type="button" onClick={() => { setActiveTab('notes'); window.setTimeout(() => document.getElementById('main-note')?.focus(),0); }}><NotePencil size={16} /> Add a learner note</button>
      </aside>

      <article className="lesson-canvas" id="lesson">
        <LearningCanvas key={lesson.id} lesson={lesson} lessonNumber={currentIndex + 1} lessonCount={course.lessons.length} attemptCounts={attemptCounts} onQuizAttempt={(questionId,answer)=>learner({type:'quiz_attempt',questionId,answer})} onSaveInsight={async content => (await learner({type:'note',content})).ok} onComplete={async()=>(await tool('set_lesson_progress',{courseId:course.id,lessonId:lesson.id,status:'completed',courseProgress:completedProgress,evidence:state.attempts.filter(item=>item.lessonId===lesson.id).map(item=>item.id)})).ok}/>

        <div className="lesson-heading"><div><div className="lesson-meta"><span>Chapter {course.chapters.findIndex(chapter => chapter.lessonIds.includes(lesson.id)) + 1}</span><span>{lesson.status.replace('_',' ')}</span></div><h1>{lesson.title}</h1><p className="lesson-deck">{lesson.summary}</p></div>{nextLesson && <button className="next-lesson" type="button" onClick={() => openLesson(nextLesson.id)}>Next lesson <ArrowRight size={16} /></button>}</div>
        <nav className="lesson-tabs" aria-label="Lesson views">
          <button className={activeTab === 'canvas' ? 'active' : ''} onClick={() => {setActiveTab('canvas');document.querySelector('.learning-canvas')?.scrollIntoView({behavior:'smooth',block:'start'});}}><BookOpenText size={16} /> Canvas</button>
          <button className={activeTab === 'notes' ? 'active' : ''} onClick={() => setActiveTab('notes')}><NotePencil size={16} /> Quick notes <span>{notes.length}</span></button>
          <button className={activeTab === 'signals' ? 'active' : ''} onClick={() => setActiveTab('signals')}><ChatCircleDots size={16} /> Questions <span>{lessonRequests.filter(item => item.status === 'pending').length}</span></button>
        </nav>

        {activeTab !== 'canvas' && <div className="lesson-content">
          {activeTab === 'notes' && <section className="main-notes"><div className="section-heading"><span><NotePencil size={18} /></span><div><b>Notes from this lesson</b><p>These are shared learning signals your teaching agent can read next turn.</p></div></div>{notes.length ? notes.map(item => <article key={item.id}><p>{item.content}</p><small>{new Date(item.createdAt).toLocaleDateString()}</small></article>) : <div className="empty-inline">No notes yet. Capture the first idea below.</div>}<textarea id="main-note" value={note} onChange={event => setNote(event.target.value)} placeholder="Write what you want to remember…" aria-label="New learner note"/><button className="primary-button" disabled={!note.trim() || busy} onClick={saveNote}>Save note</button></section>}
          {activeTab === 'signals' && <section className="main-signals"><div className="section-heading"><span><ChatCircleDots size={18} /></span><div><b>Questions and requests</b><p>Lantern keeps these pending until your next conversation with an agent.</p></div></div>{lessonRequests.length ? lessonRequests.map(item => <article key={item.id}><span className={item.status}>{item.status}</span><b>{item.type.replace('_',' ')}</b><p>{item.content}</p>{item.answer && <blockquote>{item.answer}</blockquote>}</article>) : <div className="empty-inline">No questions saved for this lesson.</div>}</section>}
        </div>}
      </article>

      <aside className="learning-panel" aria-label="Agent workspace">
        <div className="panel-title"><span><Robot size={18} /> Agent workspace</span><span className="revision">revision {state.revision}</span></div>
        {proposed ? <section className="adaptation-card"><span className="eyebrow">Needs your review</span><h2>{proposed.summary}</h2><p>{proposed.reason}</p><div><button className="primary-button" onClick={() => tool('apply_learning_adaptation',{adaptationId:proposed.id})}>Apply adaptation</button><button className="ghost-button" onClick={() => tool('navigate_to_learning_item',{adaptationId:proposed.id})}>Review</button></div></section> : <section className="signal-card"><span className="signal-icon"><Sparkle size={18} weight="fill" /></span><div><b>Learning preference in use</b><p>{course.learningPreference}. Agent changes appear here for review before they are applied.</p></div></section>}
        {latestChange && <section className="change-card"><div><span>Just changed</span><p>{latestChange.summary}</p></div><button onClick={() => tool('undo_agent_change',{changeId:latestChange.id,reason:'Learner requested undo'})}>Undo</button></section>}
        <section className="question-card"><span className="eyebrow">Ask beside this lesson</span><h2>What feels unclear?</h2><textarea value={question} onChange={event => setQuestion(event.target.value)} aria-label="Question for the teaching agent" placeholder="Ask about this lesson…"/><div className="question-actions"><span>This saves the question. It won’t wake an idle agent.</span><button type="button" disabled={!question.trim() || busy} onClick={saveQuestion}>{busy ? 'Saving…' : 'Save question'}</button></div></section>
        <section className="preference-card"><span className="eyebrow">Teaching preference</span><p>Need a different explanation?</p><button className="ghost-button" onClick={() => learner({type:'teaching_preference',content:'Please make this lesson more visual and use another concrete example.'})}><Sparkle size={15} /> Make this more visual</button></section>
        <section className="note-card"><span className="eyebrow">Latest note</span>{notes.slice(0,1).map(item => <p key={item.id}>“{item.content}”</p>)}<button type="button" onClick={() => setActiveTab('notes')}><NotePencil size={15} /> Open quick notes</button></section>
        {lessonRequests.some(item => item.status === 'pending') && <section className="pending-card"><span>{lessonRequests.filter(item => item.status === 'pending').length}</span><div><b>Saved for next turn</b><p>Your agent can read these when you continue the conversation.</p></div></section>}
      </aside>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
