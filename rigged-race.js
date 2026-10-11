
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export async function attachRiggedRace({track,button,status,getSnapshot}){
  let active=false,renderer=null,scene=null,camera=null,canvas=null,template=null,clips=[],last=0,raf=0;
  const runners=new Map();
  let sun=null;
  const loader=new GLTFLoader();
  function cleanup(){
    cancelAnimationFrame(raf);
    for(const r of runners.values()){r.mixer.stopAllAction();r.mixer.uncacheRoot(r.model);}
    runners.clear();
    renderer?.dispose();canvas?.remove();
    renderer=scene=camera=canvas=null;
    active=false;track.classList.remove('rigged-active');button.textContent='USE ANIMATED GLB';button.setAttribute('aria-pressed','false');status.textContent='Original 3D renderer';
  }
  function makeRunner(h){
    const model=clone(template);
    const mixer=new THREE.AnimationMixer(model);
    const actions={};
    for(const name of ['Idle','Canter','Gallop','Finish']){
      const clip=clips.find(c=>c.name===name);
      if(!clip)throw Error('Missing '+name+' animation');
      const a=mixer.clipAction(clip);
      a.setLoop(name==='Finish'?THREE.LoopOnce:THREE.LoopRepeat,name==='Finish'?1:Infinity);
      a.clampWhenFinished=name==='Finish';actions[name]=a;
    }
    actions.Idle.play();
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;}});
    scene.add(model);
    const r={model,mixer,actions,gait:'Idle',distance:0};
    runners.set(h.id,r);return r;
  }
  function frame(t){
    if(!active)return;
    const dt=last?Math.min(.05,(t-last)/1000):1/60;last=t;
    const s=getSnapshot();
    if(s?.horses){
      const ids=new Set(s.horses.map(h=>h.id));
      for(const [id,r] of runners)if(!ids.has(id)){
        r.mixer.stopAllAction();r.mixer.uncacheRoot(r.model);scene.remove(r.model);runners.delete(id);
      }
      const distance=Math.max(1,s.raceDistance||100);
      for(const h of s.horses){
        const r=runners.get(h.id)||makeRunner(h);
        const speed=Number(h.currentSpeed)||0;
        const gait=h.finished?'Finish':s.phase==='countdown'?'Idle':speed<.72?'Canter':'Gallop';
        if(gait!==r.gait){
          const next=r.actions[gait];next.reset().setEffectiveWeight(1).play();
          next.crossFadeFrom(r.actions[r.gait],gait==='Finish'?.5:.3,true);r.gait=gait;
        }
        if(gait==='Gallop'){
          const duration=r.actions.Gallop.getClip().duration;
          r.actions.Gallop.timeScale=duration*clamp(1.25+speed*.55,1.3,2.4);
        }
        r.mixer.update(dt);
        const x=-43+clamp((h.distanceTravelled||0)/distance,0,1)*86;
        if(s.phase==='countdown'||!Number.isFinite(r.distance))r.distance=x;
        r.distance+=(x-r.distance)*(1-Math.exp(-11*dt));
        r.model.position.set(r.distance,0,((h.post||1)-(s.horses.length+1)/2)*2.0);
        r.model.rotation.y=0;
      }
      const w=Math.max(1,track.clientWidth),height=Math.max(1,track.clientHeight);
      renderer.setSize(w,height,false);camera.aspect=w/height;
      const shot=s.cameraShot||'wide';
      const leader=s.horses.find(h=>h.position===1)||s.horses[0];
      const lx=-43+clamp((leader?.distanceTravelled||0)/distance,0,1)*86;
      const focus=s.horses.find(h=>h.id===s.selected)||leader;
      const fx=-43+clamp((focus?.distanceTravelled||0)/distance,0,1)*86;
      if(shot==='top'||shot==='aerial')camera.position.set(0,96,.01);
      else if(shot==='leader')camera.position.set(lx-16,13,28);
      else if(shot==='selected')camera.position.set(fx-13,11,25);
      else if(shot==='finish')camera.position.set(35,14,35);
      else camera.position.set(-10,34,72);
      camera.lookAt(shot==='leader'?lx:shot==='selected'?fx:shot==='finish'?37:0,1.2,0);
      camera.updateProjectionMatrix();
      renderer.render(scene,camera);
    }
    raf=requestAnimationFrame(frame);
  }
  const activate=async()=>{
    if(active){cleanup();return;}
    button.disabled=true;button.textContent='LOADING GLB…';
    try{
      if(!template){
        const gltf=await loader.loadAsync('./assets/horses/thoroughbred-jockey.glb');
        template=gltf.scene;clips=gltf.animations;
        for(const name of ['Idle','Canter','Gallop','Finish'])
          if(!clips.some(c=>c.name===name))throw Error('Model missing '+name);
        template.traverse(o=>{
          if(o.isMesh){
            o.castShadow=true;
            for(const m of (Array.isArray(o.material)?o.material:[o.material])){
              if(m?.map)m.map.colorSpace=THREE.SRGBColorSpace;
            }
          }
        });
      }
      canvas=document.createElement('canvas');
      canvas.setAttribute('aria-label','Animated GLB thoroughbred race view');
      canvas.className='rigged-glb-canvas';
      track.appendChild(canvas);
      renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      scene=new THREE.Scene();scene.background=new THREE.Color(0x9aafa9);
      camera=new THREE.PerspectiveCamera(48,1,.1,400);
      scene.add(new THREE.HemisphereLight(0xe8f5ff,0x65513d,2));
      sun=new THREE.DirectionalLight(0xffedd2,2.5);
      sun.position.set(-15,34,12);sun.castShadow=true;
      sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-70;sun.shadow.camera.right=70;
      sun.shadow.camera.top=48;sun.shadow.camera.bottom=-48;
      scene.add(sun);
      const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,58),new THREE.MeshStandardMaterial({color:0x886c50,roughness:.95}));
      ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
      for(let i=-10;i<=10;i++){
        const stripe=new THREE.Mesh(new THREE.BoxGeometry(105,.01,.015),new THREE.MeshBasicMaterial({color:0xd8c3a0,transparent:true,opacity:.2}));
        stripe.position.set(0,.01,i*2);scene.add(stripe);
      }
      active=true;track.classList.add('rigged-active');last=0;button.textContent='USE ORIGINAL 3D';button.setAttribute('aria-pressed','true');status.textContent='Animated GLB active';
      raf=requestAnimationFrame(frame);
    }catch(e){
      console.error('GLB renderer:',e);cleanup();
      status.textContent='GLB unavailable: '+e.message+' — original 3D active';
    }finally{button.disabled=false;}
  };
  button.textContent='USE ANIMATED GLB';
  button.addEventListener('click',activate);
  await activate();
}
