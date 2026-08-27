'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowCounterClockwise, CheckCircle, Cube, FloppyDisk, Pause, Play, Target } from '@phosphor-icons/react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { ThreeExperienceSpec, ThreeSceneNode } from '../lib/lantern';

type RuntimeProps = {
  spec: ThreeExperienceSpec;
  active?: boolean;
  compact?: boolean;
  onRecordEvidence?: (content:string)=>Promise<boolean>;
};

const fallbackVertex = `
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fallbackFragment = `
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  float edge = pow(1.0 - abs(vNormal.z), 2.0);
  float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + vPosition.y * 3.0);
  gl_FragColor = vec4(uColor * (pulse * uIntensity) + edge * 0.22, 0.96);
}`;

function geometryFor(node:ThreeSceneNode) {
  switch (node.kind) {
    case 'box': return new THREE.BoxGeometry(1,1,1,4,4,4);
    case 'torus': return new THREE.TorusGeometry(.75,.2,24,64);
    case 'cylinder': return new THREE.CylinderGeometry(.55,.55,1.2,48);
    case 'cone': return new THREE.ConeGeometry(.65,1.2,48);
    case 'plane': return new THREE.PlaneGeometry(12,12,32,32);
    case 'icosahedron': return new THREE.IcosahedronGeometry(.85,5);
    default: return new THREE.SphereGeometry(.6,48,32);
  }
}

function materialFor(node:ThreeSceneNode) {
  if (node.shader) {
    const uniforms:Record<string,THREE.IUniform> = {
      uTime:{value:0},
      uColor:{value:new THREE.Color(node.color || '#5f7dff')},
      uIntensity:{value:node.shader.intensity ?? 1},
    };
    for (const uniform of node.shader.uniforms || []) {
      uniforms[uniform.name] = {value:uniform.color ? new THREE.Color(uniform.color) : uniform.value ?? 0};
    }
    return new THREE.ShaderMaterial({
      vertexShader:node.shader.vertex || fallbackVertex,
      fragmentShader:node.shader.fragment || fallbackFragment,
      uniforms,
      transparent:true,
      depthWrite:true,
    });
  }
  return new THREE.MeshStandardMaterial({
    color:new THREE.Color(node.color || '#5f7dff'),
    emissive:new THREE.Color(node.emissive || '#000000'),
    emissiveIntensity:node.emissive ? .8 : .08,
    roughness:node.roughness ?? .32,
    metalness:node.metalness ?? .45,
    transparent:(node.opacity ?? 1) < 1,
    opacity:node.opacity ?? 1,
    wireframe:node.material === 'wireframe',
  });
}

export default function ThreeLessonRuntime({spec,active=true,compact=false,onRecordEvidence}:RuntimeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const objectsRef = useRef<Map<string,THREE.Mesh>>(new Map());
  const resetCameraRef = useRef<()=>void>(()=>{});
  const [selectedId,setSelectedId] = useState(spec.nodes.find(node=>node.interaction && node.interaction !== 'none')?.id || spec.nodes[0]?.id || '');
  const [playing,setPlaying] = useState(true);
  const [saved,setSaved] = useState(false);
  const initialValues = useMemo(()=>Object.fromEntries(spec.nodes.filter(node=>typeof node.value === 'number').map(node=>[node.id,node.value as number])),[spec.nodes]);
  const [values,setValues] = useState<Record<string,number>>(initialValues);
  const interactiveNodes = spec.nodes.filter(node=>typeof node.value === 'number');
  const selected = spec.nodes.find(node=>node.id===selectedId);
  const score = interactiveNodes.reduce((sum,node)=>sum + (values[node.id] ?? Number(node.value || 0)) * Number(node.weight ?? .1),0);
  const probability = Math.round(100/(1+Math.exp(-score)));
  const target = spec.mission?.targetRange || [68,82];
  const missionComplete = probability >= target[0] && probability <= target[1];

  useEffect(()=>{
    const mount=mountRef.current;
    if(!mount||!active)return;
    mount.replaceChildren();
    const scene=new THREE.Scene();
    scene.background=new THREE.Color(spec.environment.background || '#071225');
    if(spec.environment.fogColor)scene.fog=new THREE.FogExp2(spec.environment.fogColor,spec.environment.fogDensity || .035);
    const camera=new THREE.PerspectiveCamera(spec.camera.fov || 42,1,.1,100);
    const cameraPosition=new THREE.Vector3(...spec.camera.position);
    const cameraTarget=new THREE.Vector3(...spec.camera.target);
    camera.position.copy(cameraPosition);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.08;
    renderer.shadowMap.enabled=!compact;
    renderer.domElement.setAttribute('aria-label',spec.alt);
    renderer.domElement.setAttribute('role','img');
    mount.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);
    controls.target.copy(cameraTarget);controls.enableDamping=true;controls.dampingFactor=.055;controls.enablePan=false;controls.minDistance=3;controls.maxDistance=18;controls.autoRotate=compact;controls.autoRotateSpeed=.55;controls.update();
    resetCameraRef.current=()=>{camera.position.copy(cameraPosition);controls.target.copy(cameraTarget);controls.update();};
    scene.add(new THREE.HemisphereLight('#b9caff','#07101e',spec.environment.ambientIntensity ?? 1.4));
    const key=new THREE.DirectionalLight('#fff4e8',2.6);key.position.set(5,7,4);key.castShadow=true;scene.add(key);
    const rim=new THREE.PointLight('#416dff',22,14);rim.position.set(-4,1,2);scene.add(rim);
    const group=new THREE.Group();scene.add(group);
    const meshes=new Map<string,THREE.Mesh>();objectsRef.current=meshes;
    for(const node of spec.nodes){
      const mesh=new THREE.Mesh(geometryFor(node),materialFor(node));
      mesh.name=node.id;mesh.userData={node,basePosition:[...node.position],baseScale:node.scale ? [...node.scale] : [1,1,1]};
      mesh.position.set(...node.position);mesh.scale.set(...(node.scale || [1,1,1]));mesh.rotation.set(...(node.rotation || [0,0,0]));
      mesh.castShadow=node.kind!=='plane';mesh.receiveShadow=true;group.add(mesh);meshes.set(node.id,mesh);
    }
    const connectionMaterials:THREE.LineBasicMaterial[]=[];
    for(const connection of spec.connections || []){
      const from=meshes.get(connection.from),to=meshes.get(connection.to);if(!from||!to)continue;
      const curve=new THREE.QuadraticBezierCurve3(from.position.clone(),from.position.clone().lerp(to.position,.5).add(new THREE.Vector3(0,.28,0)),to.position.clone());
      const geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
      const material=new THREE.LineBasicMaterial({color:connection.color || '#6f8cff',transparent:true,opacity:.35});
      const line=new THREE.Line(geometry,material);line.userData={connection};group.add(line);connectionMaterials.push(material);
    }
    const starGeometry=new THREE.BufferGeometry();const starCount=compact?180:420;const starPositions=new Float32Array(starCount*3);
    for(let i=0;i<starCount;i++){starPositions[i*3]=(Math.random()-.5)*22;starPositions[i*3+1]=(Math.random()-.5)*14;starPositions[i*3+2]=(Math.random()-.5)*18;}
    starGeometry.setAttribute('position',new THREE.BufferAttribute(starPositions,3));
    const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#87a3ff',size:.025,transparent:true,opacity:.55}));scene.add(stars);
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    function choose(event:PointerEvent){const rect=renderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...meshes.values()],false)[0];if(hit?.object?.name)setSelectedId(hit.object.name);}
    renderer.domElement.addEventListener('pointerdown',choose);
    const timer=new THREE.Timer();timer.connect(document);let frame=0;
    function resize(){const width=mount.clientWidth,height=mount.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();}
    const observer=new ResizeObserver(resize);observer.observe(mount);resize();
    function animate(timestamp:number){frame=requestAnimationFrame(animate);timer.update(timestamp);const elapsed=timer.getElapsed();
      if(playing){stars.rotation.y=elapsed*.018;
        for(const node of spec.nodes){const mesh=meshes.get(node.id);if(!mesh)continue;const base=mesh.userData.basePosition as number[];const scaleBase=mesh.userData.baseScale as number[];const speed=node.speed || 1;
          if(node.behavior==='spin'){mesh.rotation.y=elapsed*.45*speed;mesh.rotation.x=elapsed*.12*speed;}
          if(node.behavior==='orbit'){const radius=node.orbitRadius || Math.max(.5,Math.hypot(base[0],base[2]));const angle=elapsed*.22*speed + Number(node.phase || 0);mesh.position.x=Math.cos(angle)*radius;mesh.position.z=Math.sin(angle)*radius;}
          if(node.behavior==='float')mesh.position.y=base[1]+Math.sin(elapsed*speed+Number(node.phase||0))*.18;
          if(node.behavior==='pulse'){const pulse=1+Math.sin(elapsed*2*speed+Number(node.phase||0))*.075;mesh.scale.set(scaleBase[0]*pulse,scaleBase[1]*pulse,scaleBase[2]*pulse);}
          const material=mesh.material;if(material instanceof THREE.ShaderMaterial){if(material.uniforms.uTime)material.uniforms.uTime.value=elapsed;if(material.uniforms.uIntensity)material.uniforms.uIntensity.value=.72+probability/180;}
        }
        connectionMaterials.forEach((material,index)=>{material.opacity=.22+.38*(.5+.5*Math.sin(elapsed*2.1+index*.8));});
      }
      const output=meshes.get(spec.outputNodeId || 'output');if(output&&output.material instanceof THREE.MeshStandardMaterial){output.material.emissive.set(missionComplete?'#28d694':'#315eea');output.material.emissiveIntensity=missionComplete?2.1:.75;}
      controls.update();renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);timer.dispose();observer.disconnect();renderer.domElement.removeEventListener('pointerdown',choose);controls.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material?.dispose());}});renderer.dispose();mount.replaceChildren();};
  },[active,compact,missionComplete,playing,probability,spec]);

  function updateValue(node:ThreeSceneNode,value:number){
    setSaved(false);setValues(current=>({...current,[node.id]:value}));
    const mesh=objectsRef.current.get(node.id);if(mesh){const normalized=(value-Number(node.min||0))/Math.max(1,Number(node.max||1)-Number(node.min||0));mesh.scale.setScalar(.78+normalized*.55);if(mesh.material instanceof THREE.MeshStandardMaterial)mesh.material.emissiveIntensity=.35+normalized*1.6;}
  }
  async function saveEvidence(){if(!onRecordEvidence)return;const controls=interactiveNodes.map(node=>`${node.label || node.id} ${values[node.id]}`).join(', ');setSaved(await onRecordEvidence(`3D mission ${missionComplete?'cleared':'attempted'} — ${controls}. Live result: ${probability}%.`));}

  return <section className={`three-runtime ${compact?'compact':''}`} aria-label={spec.title}>
    <div className="three-stage" ref={mountRef}/>
    <div className="three-hud">
      <div className="runtime-brand"><span><Cube size={16} weight="fill"/></span><div><small>Agent-authored world</small><b>{spec.title}</b></div></div>
      {!compact&&<div className="runtime-actions"><button onClick={()=>setPlaying(value=>!value)} aria-label={playing?'Pause world':'Play world'}>{playing?<Pause size={14}/>:<Play size={14}/>}</button><button onClick={()=>resetCameraRef.current()} aria-label="Reset camera"><ArrowCounterClockwise size={14}/></button></div>}
    </div>
    <div className="mission-panel">
      <span className={missionComplete?'complete':''}><Target size={15} weight="fill"/> {missionComplete?'Mission cleared':'Live mission'}</span>
      <b>{compact?'Shape a stable prediction':spec.mission?.prompt || 'Tune the system into the target range.'}</b>
      <div className="mission-meter"><i style={{width:`${probability}%`}}/><mark style={{left:`${target[0]}%`,width:`${target[1]-target[0]}%`}}/></div>
      <div className="mission-score"><strong>{probability}%</strong><small>Target {target[0]}–{target[1]}%</small></div>
    </div>
    {!compact&&<aside className="world-inspector">
      <span className="canvas-kicker">Explore the variables</span><h3>{selected?.label || 'Select an object'}</h3><p>{selected?.description || spec.instructions}</p>
      <div className="world-controls">{interactiveNodes.map(node=><label key={node.id} className={selectedId===node.id?'selected':''} onClick={()=>setSelectedId(node.id)}><span><b>{node.label}</b><output>{values[node.id]}{node.unit || ''}</output></span><input type="range" min={node.min} max={node.max} step={node.step || 1} value={values[node.id]} onInput={event=>updateValue(node,Number(event.currentTarget.value))}/></label>)}</div>
      <button className="record-world" disabled={!onRecordEvidence} onClick={saveEvidence}>{saved?<CheckCircle size={15} weight="fill"/>:<FloppyDisk size={15}/>} {saved?'Evidence saved':'Record this attempt'}</button>
    </aside>}
    <p className="three-a11y">{spec.alt}</p>
  </section>;
}
