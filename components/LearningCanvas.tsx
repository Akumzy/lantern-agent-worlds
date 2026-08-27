'use client';
/* Canvas scenes are validated at the WebMCP boundary before rendering. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsIn, ArrowsOut, ChalkboardTeacher, CheckCircle, ClosedCaptioning, Eraser,
  Cube, FloppyDisk, ListChecks, Pause, PencilSimple, Play, SkipBack, SkipForward,
  SlidersHorizontal, Sparkle, Trash,
} from '@phosphor-icons/react';
import type { Lesson, QuizQuestion, ThreeExperienceSpec } from '../lib/lantern';
import ThreeLessonRuntime from './ThreeLessonRuntime';

type CanvasView = 'world' | 'present' | 'try' | 'transcript' | 'whiteboard' | 'check';
type Point = { x:number; y:number };
type Stroke = { color:string; points:Point[] };
type CanvasElement = { id:string; type:string; label?:string; body?:string; unit?:string; min?:number; max?:number; step?:number; value?:number|string; weight?:number; color?:string };
type Scene = {
  id:string;
  title:string;
  narration:string;
  focus?:string;
  durationSeconds:number;
  transition:'fade'|'slide'|'reveal'|'focus';
  elements:CanvasElement[];
};
type TranscriptCue = { id:string; sceneId:string; speaker?:string; text:string; timeLabel?:string };

type LearningCanvasProps = {
  lesson:Lesson;
  lessonNumber:number;
  lessonCount:number;
  onSaveInsight:(content:string)=>Promise<boolean>;
  attemptCounts:Record<string,number>;
  onQuizAttempt:(questionId:string,answer:string|number|string[])=>Promise<CanvasAttemptResult>;
  onComplete:()=>Promise<boolean>;
};
type CanvasAttemptResult = {ok:boolean; correct?:boolean; explanation?:string; hint?:string; attemptsUsed?:number; maxAttempts?:number};

const baseViewOptions:Array<{id:CanvasView; label:string; icon:typeof Play}> = [
  {id:'present',label:'Present',icon:Play},
  {id:'try',label:'Try it',icon:SlidersHorizontal},
  {id:'transcript',label:'Transcript',icon:ClosedCaptioning},
  {id:'whiteboard',label:'Whiteboard',icon:ChalkboardTeacher},
  {id:'check',label:'Check',icon:ListChecks},
];

function fallbackScenes(lesson:Lesson):Scene[] {
  const useful = lesson.blocks.filter(block => !['objective','learning_canvas'].includes(block.kind)).slice(0,4);
  const objective = lesson.blocks.find(block => block.kind === 'objective');
  const scenes:Scene[] = [
    {id:'canvas_observe',title:'Observe the system',narration:objective?.body || lesson.summary,focus:'Start with the learning goal.',durationSeconds:22,transition:'fade',elements:[]},
    ...useful.map((block,index) => ({id:`canvas_${block.id}`,title:block.title || `Idea ${index + 1}`,narration:block.body || block.data?.alt || block.data?.caption || 'Explore this part of the lesson.',focus:block.kind.replace('_',' '),durationSeconds:28,transition:(['slide','reveal','focus'] as const)[index % 3],elements:[]})),
  ];
  return scenes.length > 1 ? scenes : [...scenes,{id:'canvas_reflect',title:'Make it yours',narration:'Use the whiteboard to explain the idea in your own words.',focus:'Reflection',durationSeconds:20,transition:'reveal',elements:[]}];
}

function sceneData(lesson:Lesson) {
  const canvas = lesson.blocks.find(block => block.kind === 'learning_canvas');
  const spec = canvas?.data || {};
  const scenes:Scene[] = Array.isArray(spec.scenes) && spec.scenes.length ? spec.scenes as Scene[] : fallbackScenes(lesson);
  const cues:TranscriptCue[] = Array.isArray(spec.transcriptCues) && spec.transcriptCues.length
    ? spec.transcriptCues as TranscriptCue[]
    : scenes.map((scene,index) => ({id:`cue_${scene.id}`,sceneId:scene.id,speaker:'Lantern guide',text:scene.narration,timeLabel:`${String(Math.floor(index * 0.45)).padStart(2,'0')}:${index % 2 ? '27' : '00'}`}));
  return {
    title:canvas?.title || lesson.title,
    objective:spec.objective || lesson.summary,
    scenes,
    cues,
    whiteboardPrompts:Array.isArray(spec.whiteboardPrompts) ? spec.whiteboardPrompts : ['Trace one signal from input to prediction.','Explain the neuron using your own metaphor.'],
  };
}

function setupCanvas(canvas:HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1,Math.round(rect.width * scale));
  canvas.height = Math.max(1,Math.round(rect.height * scale));
  const context = canvas.getContext('2d');
  context?.setTransform(scale,0,0,scale,0,0);
  return {context,width:rect.width,height:rect.height};
}

function InteractiveLab({ scenes,onSaveInsight,active }:{ scenes:Scene[];onSaveInsight:(content:string)=>Promise<boolean>;active:boolean }) {
  const sliders = useMemo(() => {
    const authored = scenes.flatMap(scene => scene.elements || []).filter(element => element.type === 'slider');
    return authored.length ? authored.slice(0,4) : [
      {id:'sleep',label:'Sleep',unit:'hours',min:0,max:10,value:7,weight:.22,color:'#4f7cff'},
      {id:'study',label:'Study time',unit:'hours',min:0,max:8,value:4,weight:.42,color:'#ff6d63'},
      {id:'prior',label:'Prior score',unit:'%',min:0,max:100,value:82,weight:.036,color:'#7f9dff'},
    ];
  },[scenes]);
  const [values,setValues] = useState<Record<string,number>>(() => Object.fromEntries(sliders.map(item => [item.id,Number(item.value ?? item.min ?? 0)])));
  const [saving,setSaving] = useState(false), [saved,setSaved] = useState(false);
  const visualRef = useRef<HTMLCanvasElement>(null);
  const evidence = sliders.reduce((total,item) => total + ((values[item.id] - Number(item.min || 0)) / Math.max(1,Number(item.max || 1) - Number(item.min || 0))) * Number(item.weight || .3),0);
  const probability = Math.max(4,Math.min(96,Math.round(100 / (1 + Math.exp(-(evidence * 5 - 1.55))))));

  useEffect(() => {
    const canvas = visualRef.current;
    if (!canvas) return;
    const draw = () => {
      const {context:ctx,width,height} = setupCanvas(canvas);
      if (!ctx) return;
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle = '#091326';
      ctx.fillRect(0,0,width,height);
      const inputX = Math.max(48,width * .13), coreX = width * .57, outputX = width * .86;
      sliders.forEach((item,index) => {
        const y = height * (.2 + index * (.6 / Math.max(1,sliders.length - 1)));
        const ratio = (values[item.id] - Number(item.min || 0)) / Math.max(1,Number(item.max || 1) - Number(item.min || 0));
        ctx.strokeStyle = item.color || '#4f7cff';
        ctx.globalAlpha = .35 + ratio * .65;
        ctx.lineWidth = 1.5 + ratio * 4;
        ctx.beginPath(); ctx.moveTo(inputX + 20,y); ctx.quadraticCurveTo(width * .36,y,coreX - 38,height/2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = item.color || '#4f7cff';
        ctx.beginPath(); ctx.arc(inputX,y,13 + ratio * 6,0,Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#dbe5ff'; ctx.font = '600 11px sans-serif'; ctx.fillText(`${item.label} ${values[item.id]}${item.unit === '%' ? '%' : ''}`,inputX + 28,y + 4);
      });
      ctx.fillStyle = '#315eea'; ctx.beginPath(); ctx.arc(coreX,height/2,43,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#8da7ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(coreX,height/2,53,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('MIX',coreX,height/2 + 5);
      ctx.strokeStyle = '#84a2ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(coreX + 54,height/2); ctx.lineTo(outputX - 43,height/2); ctx.stroke();
      ctx.fillStyle = '#152440'; ctx.beginPath(); ctx.arc(outputX,height/2,43,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = probability > 66 ? '#42d392' : probability > 40 ? '#f3bc5b' : '#ff6d63'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(outputX,height/2,43,-Math.PI/2,-Math.PI/2 + Math.PI*2*(probability/100)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = '700 18px sans-serif'; ctx.fillText(`${probability}%`,outputX,height/2 + 3);
      ctx.fillStyle = '#9eabc3'; ctx.font = '600 9px sans-serif'; ctx.fillText('PREDICTION',outputX,height/2 + 20);
      ctx.textAlign = 'start';
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  },[probability,sliders,values]);

  return <div className={`canvas-lab ${active?'active':''}`} data-canvas-view="try" aria-hidden={!active}>
    <div className="lab-copy"><span className="canvas-kicker">Interactive model</span><h2>Turn the evidence knobs.</h2><p>Every change recomputes the prediction. Stronger signals draw brighter, thicker connections.</p>
      <div className="lab-controls">{sliders.map(item => <label key={item.id}><span><b>{item.label}</b><output>{values[item.id]} {item.unit}</output></span><input type="range" min={item.min} max={item.max} step={item.step || 1} value={values[item.id]} onChange={event => setValues(current => ({...current,[item.id]:Number(event.target.value)}))} /></label>)}</div>
      <button className="save-experiment" disabled={saving} onClick={async()=>{setSaving(true);const inputs=sliders.map(item=>`${item.label}: ${values[item.id]} ${item.unit||''}`.trim()).join(', ');setSaved(await onSaveInsight(`Experiment result — ${inputs}. Prediction: ${probability}%.`));setSaving(false);}}><FloppyDisk size={14}/>{saved?'Experiment saved':'Save experiment result'}</button>
    </div>
    <div className="lab-visual-wrap"><canvas ref={visualRef} className="lab-visual" aria-label={`Interactive neural network predicts ${probability} percent based on the selected inputs.`}/><div className="lab-result"><span>Live result</span><b>{probability}%</b><small>{probability > 66 ? 'Strong prediction' : probability > 40 ? 'Uncertain prediction' : 'Weak prediction'}</small></div></div>
  </div>;
}

function Whiteboard({ prompts,onSaveInsight,active }:{prompts:string[]; onSaveInsight:(content:string)=>Promise<boolean>;active:boolean}) {
  const canvasRef = useRef<HTMLCanvasElement>(null), drawing = useRef(false), activeStroke = useRef<Stroke|null>(null), strokes = useRef<Stroke[]>([]);
  const [color,setColor] = useState('#315eea'), [version,setVersion] = useState(0), [prompt,setPrompt] = useState(prompts[0] || 'Explain this idea in your own way.'), [saved,setSaved] = useState(false);

  function redraw() {
    const canvas = canvasRef.current; if (!canvas) return;
    const {context:ctx,width,height} = setupCanvas(canvas); if (!ctx) return;
    ctx.fillStyle='#fbfcff'; ctx.fillRect(0,0,width,height);
    ctx.strokeStyle='#e5eaf3'; ctx.lineWidth=1;
    for (let x=24;x<width;x+=24) for (let y=24;y<height;y+=24) { ctx.beginPath(); ctx.arc(x,y,1,0,Math.PI*2); ctx.fillStyle='#dce3ee'; ctx.fill(); }
    for (const stroke of strokes.current) {
      if (stroke.points.length < 2) continue;
      ctx.strokeStyle=stroke.color; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.beginPath();
      stroke.points.forEach((point,index) => { const x=point.x*width,y=point.y*height; if(index===0)ctx.moveTo(x,y);else ctx.lineTo(x,y); }); ctx.stroke();
    }
  }
  useEffect(() => { redraw(); const canvas=canvasRef.current; if(!canvas)return; const observer=new ResizeObserver(redraw); observer.observe(canvas); return()=>observer.disconnect(); },[version]);
  function point(event:React.PointerEvent<HTMLCanvasElement>) { const rect=event.currentTarget.getBoundingClientRect(); return{x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height}; }
  function start(event:React.PointerEvent<HTMLCanvasElement>) { event.currentTarget.setPointerCapture(event.pointerId); drawing.current=true; activeStroke.current={color,points:[point(event)]}; strokes.current.push(activeStroke.current); }
  function move(event:React.PointerEvent<HTMLCanvasElement>) { if(!drawing.current||!activeStroke.current)return; activeStroke.current.points.push(point(event)); redraw(); }
  function end() { drawing.current=false; activeStroke.current=null; setVersion(value=>value+1); }
  function clear() { strokes.current=[]; setVersion(value=>value+1); }
  function undo() { strokes.current.pop(); setVersion(value=>value+1); }
  async function save() { const ok=await onSaveInsight(`Whiteboard insight: ${prompt}`); setSaved(ok); }

  return <div className={`canvas-whiteboard ${active?'active':''}`} data-canvas-view="whiteboard" aria-hidden={!active}>
    <div className="whiteboard-toolbar"><div><PencilSimple size={16}/><b>Scratch layer</b><small>Marks stay local until you save an insight.</small></div><div className="ink-colors" aria-label="Ink color">{['#315eea','#ff6d63','#16223b'].map(value=><button key={value} className={color===value?'active':''} style={{backgroundColor:value}} onClick={()=>setColor(value)} aria-label={`Use ${value} ink`}/>)}</div><button onClick={undo} aria-label="Undo last stroke"><Eraser size={16}/></button><button onClick={clear} aria-label="Clear whiteboard"><Trash size={16}/></button></div>
    <div className="whiteboard-prompt"><Sparkle size={15} weight="fill"/><select value={prompt} onChange={event=>setPrompt(event.target.value)} aria-label="Whiteboard prompt">{prompts.map(item=><option key={item}>{item}</option>)}</select></div>
    <canvas ref={canvasRef} className="whiteboard-surface" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Drawable lesson whiteboard"/>
    <button className="save-insight" onClick={save}><FloppyDisk size={15}/>{saved?'Saved to learner notes':'Save prompt as an insight'}</button>
  </div>;
}

function CanvasCheckpoint({question,attempts,lessonStatus,onAttempt,onComplete}:{question?:QuizQuestion;attempts:number;lessonStatus:Lesson['status'];onAttempt:(answer:string|number|string[])=>Promise<CanvasAttemptResult>;onComplete:()=>Promise<boolean>}) {
  const [answer,setAnswer] = useState<string|number|string[]>(''), [feedback,setFeedback] = useState<CanvasAttemptResult|null>(null), [showHint,setShowHint] = useState(false), [busy,setBusy] = useState(false), [completed,setCompleted] = useState(lessonStatus==='completed');
  if(!question)return <div className="canvas-checkpoint empty-checkpoint"><ListChecks size={28}/><span className="canvas-kicker">Agent checkpoint</span><h2>This canvas is ready for a check.</h2><p>Your teaching agent can attach a validated question to finish the learning loop.</p></div>;
  const exhausted=attempts>=question.maxAttempts&&!feedback?.correct;
  async function submit(){if(answer===''||busy)return;setBusy(true);setFeedback(await onAttempt(answer));setBusy(false);}
  async function complete(){setBusy(true);setCompleted(await onComplete());setBusy(false);}
  return <div className="canvas-checkpoint">
    <div className="checkpoint-intro"><span><ListChecks size={19} weight="bold"/></span><div><span className="canvas-kicker">Final checkpoint</span><h2>Show what changed.</h2><p>Complete this check to finish the lesson and update course progress.</p></div><small>{Math.min(attempts+1,question.maxAttempts)} of {question.maxAttempts} attempts</small></div>
    <section className="checkpoint-question" aria-labelledby={`${question.id}-canvas-prompt`}><h3 id={`${question.id}-canvas-prompt`}>{question.prompt}</h3>
      {question.type==='single_choice'&&<div className="checkpoint-options">{question.options?.map(option=><label key={option} className={answer===option?'selected':''}><input type="radio" name={`${question.id}-canvas`} checked={answer===option} onChange={()=>setAnswer(option)} disabled={exhausted}/><span>{option}</span></label>)}</div>}
      {question.type==='numeric'&&<input className="checkpoint-number" type="number" value={typeof answer==='number'?answer:''} onChange={event=>setAnswer(Number(event.target.value))} disabled={exhausted}/>} 
      <div className="checkpoint-actions"><button className="canvas-secondary" onClick={()=>setShowHint(value=>!value)}>{showHint?'Hide hint':'Use a hint'}</button><button className="canvas-primary" onClick={submit} disabled={answer===''||busy||exhausted}>{busy?'Checking…':'Check answer'}</button></div>
      {showHint&&<p className="checkpoint-hint"><b>Hint</b>{question.hint}</p>}
      {feedback&&<div className={`checkpoint-feedback ${feedback.correct?'correct':'incorrect'}`} role="status"><CheckCircle size={19} weight={feedback.correct?'fill':'regular'}/><div><b>{feedback.correct?'You’ve got it.':'Try that once more.'}</b><p>{feedback.explanation}</p></div></div>}
      {(feedback?.correct||completed)&&<div className="checkpoint-complete"><div><b>{completed?'Lesson complete':'Ready to finish'}</b><p>{completed?'Your progress is saved. Continue when you’re ready.':'Save this checkpoint as evidence and update course progress.'}</p></div><button onClick={complete} disabled={completed||busy}>{completed?<><CheckCircle size={16} weight="fill"/> Completed</>:<>Complete lesson <CheckCircle size={16}/></>}</button></div>}
      {exhausted&&!feedback?.correct&&!completed&&<p className="checkpoint-hint">Attempts are used. Save a retry request from the Questions tab for your next agent turn.</p>}
    </section>
  </div>;
}

export default function LearningCanvas({lesson,lessonNumber,lessonCount,onSaveInsight,attemptCounts,onQuizAttempt,onComplete}:LearningCanvasProps) {
  const data = useMemo(()=>sceneData(lesson),[lesson]);
  const world = lesson.blocks.find(block=>block.kind==='interactive_experience')?.data as ThreeExperienceSpec|undefined;
  const viewOptions = useMemo(()=>world?[{id:'world' as CanvasView,label:'3D world',icon:Cube},...baseViewOptions]:baseViewOptions,[world]);
  const [view,setView] = useState<CanvasView>(world?'world':'present'), [sceneIndex,setSceneIndex] = useState(0), [playing,setPlaying] = useState(false), [focusMode,setFocusMode] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  const scene = data.scenes[Math.min(sceneIndex,data.scenes.length-1)];
  useEffect(()=>{if(!playing)return;const timer=window.setTimeout(()=>setSceneIndex(index=>{if(index>=data.scenes.length-1){setPlaying(false);return index;}return index+1;}),Math.max(1000,scene.durationSeconds*1000));return()=>window.clearTimeout(timer);},[playing,scene.durationSeconds,data.scenes.length]);
  useEffect(()=>{if(!focusMode)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[focusMode]);
  function go(index:number){setSceneIndex(Math.max(0,Math.min(data.scenes.length-1,index)));}
  const activeCue = data.cues.find(cue=>cue.sceneId===scene.id);

  return <section className={`learning-canvas ${focusMode?'focus-mode':''}`} ref={shellRef} aria-label="Interactive lesson canvas" tabIndex={0} onKeyDown={event=>{const target=event.target as HTMLElement;if(['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target.tagName))return;if(event.key==='Escape'&&focusMode)setFocusMode(false);if(event.key==='ArrowLeft')go(sceneIndex-1);if(event.key==='ArrowRight')go(sceneIndex+1);if(event.key===' '&&view==='present'){event.preventDefault();setPlaying(value=>!value);}}}>
    <header className="canvas-toolbar">
      <div className="canvas-identity"><span><Sparkle size={15} weight="fill"/></span><div><b>Agent-built canvas</b><small>{data.scenes.length} scenes · interactive lesson</small></div></div>
      <nav aria-label="Canvas views">{viewOptions.map(option=>{const Icon=option.icon;return <button key={option.id} className={view===option.id?'active':''} onClick={()=>setView(option.id)}><Icon size={14} weight={view===option.id?'fill':'regular'}/>{option.label}</button>;})}</nav>
      <button className="canvas-expand" onClick={()=>setFocusMode(value=>!value)} aria-label={focusMode?'Exit canvas focus mode':'Open canvas focus mode'}>{focusMode?<ArrowsIn size={16}/>:<ArrowsOut size={16}/>}</button>
    </header>

    <div className={`canvas-viewport view-${view}`}>
      {world&&<div className={`canvas-world ${view==='world'?'active':''}`} data-canvas-view="world" aria-hidden={view!=='world'}><ThreeLessonRuntime spec={world} active={view==='world'} onRecordEvidence={onSaveInsight}/></div>}
      <div className={`canvas-present ${view==='present'?'active':''}`} key={scene.id} data-canvas-view="present" aria-hidden={view!=='present'}>
        <img src="/lesson-neural-prediction.png" alt="A tactile neural network with evidence signals flowing into a prediction dial"/>
        <div className="present-shade"/>
        <div className={`scene-card transition-${scene.transition}`}><span className="canvas-kicker">Scene {sceneIndex+1} · {scene.focus || 'guided explanation'}</span><h2>{scene.title}</h2><p>{scene.narration}</p><div className="scene-elements">{scene.elements.filter(element=>['formula','callout'].includes(element.type)).slice(0,3).map(element=><span key={element.id} className={`element-${element.type}`}>{element.label || element.body}</span>)}</div>{sceneIndex===data.scenes.length-1&&lesson.quiz.length>0&&<button className="scene-check-action" onClick={()=>setView('check')}><ListChecks size={15}/>Open checkpoint</button>}</div>
        <div className="present-caption"><ClosedCaptioning size={15}/><span>{activeCue?.text || scene.narration}</span></div>
      </div>
      <InteractiveLab scenes={data.scenes} onSaveInsight={onSaveInsight} active={view==='try'}/>
      <div className={`canvas-transcript ${view==='transcript'?'active':''}`} data-canvas-view="transcript" aria-hidden={view!=='transcript'}><aside><span className="canvas-kicker">Scene transcript</span><h2>Follow every explanation.</h2><p>Each cue is linked to the scene that created it.</p></aside><div className="transcript-list">{data.cues.map((cue,index)=><button key={cue.id} className={cue.sceneId===scene.id?'active':''} onClick={()=>{const target=data.scenes.findIndex(item=>item.id===cue.sceneId);if(target>=0)go(target);}}><time>{cue.timeLabel || `0${index}:00`}</time><span><b>{cue.speaker || 'Lantern guide'}</b>{cue.text}</span>{cue.sceneId===scene.id&&<CheckCircle size={17} weight="fill"/>}</button>)}</div></div>
      <Whiteboard prompts={data.whiteboardPrompts} onSaveInsight={onSaveInsight} active={view==='whiteboard'}/>
      <div className={`canvas-checkpoint-shell ${view==='check'?'active':''}`} data-canvas-view="check" aria-hidden={view!=='check'}><CanvasCheckpoint question={lesson.quiz[0]} attempts={lesson.quiz[0]?attemptCounts[lesson.quiz[0].id]||0:0} lessonStatus={lesson.status} onAttempt={answer=>lesson.quiz[0]?onQuizAttempt(lesson.quiz[0].id,answer):Promise.resolve({ok:false})} onComplete={onComplete}/></div>
    </div>

    {view!=='world'&&<footer className="canvas-transport">
      <div className="transport-controls"><button onClick={()=>go(sceneIndex-1)} disabled={sceneIndex===0} aria-label="Previous scene"><SkipBack size={15} weight="fill"/></button><button className="transport-play" onClick={()=>setPlaying(value=>!value)} aria-label={playing?'Pause scenes':'Play scenes'}>{playing?<Pause size={15} weight="fill"/>:<Play size={15} weight="fill"/>}</button><button onClick={()=>go(sceneIndex+1)} disabled={sceneIndex===data.scenes.length-1} aria-label="Next scene"><SkipForward size={15} weight="fill"/></button></div>
      <div className="scene-timeline" aria-label="Lesson scene timeline">{data.scenes.map((item,index)=><button key={item.id} className={`${index===sceneIndex?'active':''} ${index<sceneIndex?'visited':''}`} onClick={()=>go(index)}><i/><span>{item.title}</span></button>)}</div>
      <span className="canvas-runtime">Lesson {lessonNumber} of {lessonCount}<b>{scene.durationSeconds}s</b></span>
    </footer>}
  </section>;
}
