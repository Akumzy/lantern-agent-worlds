'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BracketsCurly, Check, Copy, Cube, GameController, LightbulbFilament, MagicWand, ShieldCheck, Sparkle, Waveform } from '@phosphor-icons/react';
import { createNeuralGravityExperience } from '../lib/lantern';
import { toolDefinitions } from '../lib/tools';
import ThreeLessonRuntime from './ThreeLessonRuntime';

const creationPrompt='Teach me neural networks from first principles. Build a visual course with short lessons, an interactive 3D world, a shader-driven simulation, a transcript, and checkpoints that adapt to my mistakes.';

async function executeTool(name:string,input:Record<string,unknown>){
  const response=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'tool',name,args:input})});
  return await response.json();
}

export default function LanternLanding(){
  const [webMcp,setWebMcp]=useState<'checking'|'ready'|'unavailable'>('checking');
  const [copied,setCopied]=useState(false);
  const world=useMemo(()=>createNeuralGravityExperience(),[]);
  useEffect(()=>{
    const controller=new AbortController(),context=document.modelContext||navigator.modelContext;
    if(!context){const timer=window.setTimeout(()=>setWebMcp('unavailable'),0);return()=>{window.clearTimeout(timer);controller.abort();};}
    let live=true;
    Promise.all(toolDefinitions.map(tool=>Promise.resolve(context.registerTool({...tool,execute:(input:Record<string,unknown>)=>executeTool(tool.name,input)},{signal:controller.signal})))).then(()=>live&&setWebMcp('ready')).catch(()=>live&&setWebMcp('unavailable'));
    return()=>{live=false;controller.abort();};
  },[]);
  async function copyPrompt(){await navigator.clipboard.writeText(creationPrompt);setCopied(true);window.setTimeout(()=>setCopied(false),2200);}
  return <main className="landing-shell">
    <header className="landing-nav">
      <Link className="landing-brand" href="/" aria-label="Lantern home"><span><LightbulbFilament size={21} weight="fill"/></span><b>Lantern</b></Link>
      <div className="landing-links"><a href="#world-engine">World engine</a><a href="#agent-tools">Agent tools</a><Link className="open-workspace" href="/learn">Open live lesson <ArrowRight size={15}/></Link></div>
    </header>

    <section className="landing-hero">
      <div className="hero-copy">
        <div className="hero-status"><span className={webMcp}/><b>{webMcp==='ready'?'WebMCP tools live':'WebMCP-ready workspace'}</b><small>{toolDefinitions.length} semantic tools</small></div>
        <p className="landing-eyebrow">A learning world your agent can build</p>
        <h1>Don’t read the lesson. <em>Enter it.</em></h1>
        <p className="hero-deck">Lantern turns one learning goal into a living course: 3D worlds, shader-driven simulations, transcripts, whiteboards, missions, and assessments—all authored and adapted by your AI agent in the page you share.</p>
        <div className="agent-prompt-card">
          <div className="prompt-top"><span><Sparkle size={14} weight="fill"/> Start in your agent conversation</span><small>The site never pretends it can wake an idle agent.</small></div>
          <blockquote>{creationPrompt}</blockquote>
          <div className="prompt-actions"><button onClick={copyPrompt}>{copied?<Check size={16} weight="bold"/>:<Copy size={16}/>} {copied?'Prompt copied':'Copy starter prompt'}</button><Link href="/learn">Explore the result <ArrowRight size={16}/></Link></div>
        </div>
        <div className="hero-proof"><span><ShieldCheck size={17}/> Structured and reversible</span><span><BracketsCurly size={17}/> Agent-authored GLSL</span><span><GameController size={17}/> Evidence from play</span></div>
      </div>
      <div className="hero-world" id="world-engine">
        <ThreeLessonRuntime spec={world} compact/>
        <div className="world-caption"><span>LIVE / THREE.JS + GLSL</span><p>Drag to orbit. Your agent authored the scene graph, shader, mission, and learning controls through one semantic tool.</p></div>
      </div>
    </section>

    <section className="creation-loop" id="agent-tools">
      <div className="loop-heading"><span>How the collaboration works</span><h2>One goal becomes a world you can touch.</h2><p>The agent works through stable learning objects—not screenshots, selectors, or brittle clicks. Every mutation appears immediately and remains reviewable.</p></div>
      <div className="loop-rail">
        <article><span>01</span><div><MagicWand size={22}/><h3>Agent plans</h3><p>Creates a course, chapters, lessons, and learning goals at runtime.</p><code>set_course_outline</code></div></article>
        <article><span>02</span><div><Cube size={22}/><h3>Agent builds</h3><p>Composes cameras, objects, live variables, missions, and safe GLSL shaders.</p><code>set_lesson_3d_experience</code></div></article>
        <article><span>03</span><div><GameController size={22}/><h3>You explore</h3><p>Orbit, tune, experiment, draw, answer, and save evidence from the world.</p><code>save_learner_note</code></div></article>
        <article><span>04</span><div><Waveform size={22}/><h3>Course adapts</h3><p>Your next agent turn reads evidence and proposes a visible, reversible change.</p><code>propose_learning_adaptation</code></div></article>
      </div>
    </section>

    <section className="creative-contract">
      <div><span className="landing-eyebrow">The creative runtime</span><h2>Game-engine power.<br/>Learning-system guardrails.</h2></div>
      <div className="contract-grid"><article><b>Real-time 3D</b><p>Three.js scenes with camera orbit, lighting, fog, animated behaviors, linked nodes, and live controls.</p></article><article><b>GPU-native visuals</b><p>Bounded vertex and fragment shaders let agents turn concepts into motion, fields, forces, and light.</p></article><article><b>Playable evidence</b><p>Missions connect interaction to notes, assessments, progress, and the next agent adaptation.</p></article><article><b>Safe by design</b><p>No arbitrary HTML or page-level JavaScript. Scene graphs are validated; shaders are size- and capability-bounded.</p></article></div>
    </section>

    <footer className="landing-footer"><Link className="landing-brand" href="/"><span><LightbulbFilament size={18} weight="fill"/></span><b>Lantern</b></Link><p>The durable canvas where learners and teaching agents build understanding together.</p><Link href="/learn">Enter the demo <ArrowRight size={15}/></Link></footer>
  </main>;
}
