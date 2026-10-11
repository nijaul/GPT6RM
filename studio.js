/* RaceMarket Studio / 04
   UI and presentation adapter. Engine prices, orders and reservations remain
   authoritative. No network, account persistence, or external services. */
"use strict";

const studio = {
  page:"exchange", paused:false, watchlist:new Set(), watchOnly:false,
  compare:false, rowNodes:new Map(), chartPoint:null, previousQuotes:new Map(),
  token:null, toastTimer:null, lastQuoteTick:null
};
state.labelMode="smart";
state.studioPaused=false;
state.raceSetup={profileIndex:8, fieldSize:8, weather:"Golden Hour", condition:"Firm"};

money=function studioMoney(value){
  return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value)||0);
};
const $=id=>document.getElementById(id);
const safeText=(id,value)=>{const element=$(id);if(element)element.textContent=String(value);};
const signMoney=value=>`${value>0?"+":""}${money(value)}`;
const rankField=()=>[...state.horses].sort((a,b)=>{
  if(a.finished && b.finished)return a.finishPosition-b.finishPosition;
  if(a.finished)return -1;
  if(b.finished)return 1;
  return b.distanceTravelled-a.distanceTravelled;
});
const sparkline = history => {
  const values=history.slice(-26).map(p=>p.p);
  if(values.length<2)return "M 0 12 L 48 12";
  const min=Math.min(...values), max=Math.max(...values), span=Math.max(.02,max-min);
  return values.map((v,i)=>`${i?"L":"M"} ${(i/(values.length-1)*48).toFixed(1)} ${(14-(v-min)/span*12).toFixed(1)}`).join(" ");
};

function toast(text){
  const el=$("toast");
  el.textContent=text;
  el.classList.add("visible");
  clearTimeout(studio.toastTimer);
  studio.toastTimer=setTimeout(()=>el.classList.remove("visible"),3400);
}
function navigate(page){
  studio.page=page;
  for(const name of ["exchange","portfolio","activity"]){
    $(`${name}Page`).hidden=name!==page;
    document.querySelectorAll(`[data-page="${name}"]`).forEach(button=>{
      button.classList.toggle("active",page===name);
      if(page===name)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");
    });
  }
  if(page==="exchange")requestAnimationFrame(drawChart);
}
function silkGraphic(horse){
  const palette={silk:horse.postColor};
  // SVG is authored locally; colors are internal palette entries, not user input.
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m15 10-9 8 5 8 6-4v17h14V22l6 4 5-8-9-8-5 3h-8Z" fill="${palette.silk}" stroke="#e8ebd555"/><path d="m17 18 14 14v7H17Z" fill="#f2ead780"/><path d="m19 10 5 6 5-6" stroke="#102012" fill="none"/><path d="M18 39h12" stroke="#eff4e660"/></svg>`;
}

// The new field board keeps nodes stable while quotes update. It intentionally
// does not reorder the DOM every tick, so a pointer stays on the same contract.
renderHorses=function renderStudioField(){
  const container=$("horseList");
  if(!container)return;
  if(studio.token!==state.raceVisualToken){
    studio.token=state.raceVisualToken;
    studio.rowNodes.clear();
    studio.previousQuotes.clear();
    container.replaceChildren();
  }
  for(const horse of state.horses){
    let row=studio.rowNodes.get(horse.id);
    if(!row){
      row=document.createElement("div");
      row.className="runner-market-row";
      row.setAttribute("role","listitem");
      row.dataset.id=horse.id;
      row.innerHTML=`<span class="runner-rank"></span>
        <button class="runner-select"><span class="post-tile"></span><span class="runner-copy"><strong></strong><small></small></span></button>
        <div class="energy-cell"><strong></strong><div><i></i></div></div>
        <div class="quote-cell"><svg viewBox="0 0 49 17" aria-hidden="true"><path/></svg><strong></strong><small></small></div>
        <button class="buy-quote"></button><button class="watch-button" aria-pressed="false">☆</button>`;
      row.querySelector(".runner-select").addEventListener("click",()=>{
        selectBroadcastRunner(horse.id,false);
        if(window.innerWidth<940)$("ticketTitle").scrollIntoView({block:"center",behavior:"smooth"});
      });
      row.querySelector(".buy-quote").addEventListener("click",()=>{
        selectBroadcastRunner(horse.id,false);
        $("buyTab").click();
        setOrderType("market");
        $("qtyInput").focus({preventScroll:true});
        if(window.innerWidth<940)$("ticketTitle").scrollIntoView({block:"center",behavior:"smooth"});
      });
      row.querySelector(".watch-button").addEventListener("click",()=>{
        if(studio.watchlist.has(horse.id))studio.watchlist.delete(horse.id);else studio.watchlist.add(horse.id);
        renderHorses();
      });
      container.append(row);
      studio.rowNodes.set(horse.id,row);
    }
    const price=currentPrice(horse), book=tradingBookFor(horse);
    const past=(state.history[horse.id]||[]);
    const previous=past.length>1?past[past.length-2].p:horse.modelProbability;
    const change=Math.round((price-previous)*100);
    row.hidden=studio.watchOnly&&!studio.watchlist.has(horse.id);
    row.classList.toggle("selected",state.selected===horse.id);
    const rank=row.querySelector(".runner-rank");
    rank.textContent=state.phase==="countdown"?"—":String(horse.finishPosition||horse.position).padStart(2,"0");
    rank.classList.toggle("top",(horse.finishPosition||horse.position)===1&&state.phase!=="countdown");
    const post=row.querySelector(".post-tile");
    post.style.setProperty("--post",horse.postColor);
    post.textContent=horse.post;
    const pick=row.querySelector(".runner-select");
    pick.setAttribute("aria-label",`Select ${horse.name}, post ${horse.post}`);
    pick.setAttribute("aria-pressed",String(state.selected===horse.id));
    row.querySelector(".runner-copy strong").textContent=horse.name;
    const note=row.querySelector(".runner-copy small");
    note.textContent=horse.specialAbilityActive?"Flash Kick · active":`${horse.runningStyle} · ML ${horse.morningLine}`;
    note.classList.toggle("ability",horse.specialAbilityActive);
    row.querySelector(".energy-cell strong").textContent=`${Math.round(horse.energy)}%`;
    row.querySelector(".energy-cell i").style.width=`${clamp(horse.energy,0,100)}%`;
    row.querySelector(".quote-cell strong").textContent=cents(price);
    row.querySelector(".quote-cell path").setAttribute("d",sparkline(past));
    const delta=row.querySelector(".quote-cell small");
    delta.textContent=horse.finished?"FINISHED":change===0?"—":`${change>0?"+":""}${change}¢`;
    delta.className=change>0?"up":change<0?"down":"";
    const buy=row.querySelector(".buy-quote");
    buy.disabled=state.phase!=="live"||state.marketSuspended||state.studioPaused;
    buy.textContent=state.marketSuspended?"Closed":`${cents(book.askLevels[0]?.price??price)} ↗`;
    buy.setAttribute("aria-label",`Prepare YES buy on ${horse.name}`);
    const watch=row.querySelector(".watch-button"), watched=studio.watchlist.has(horse.id);
    watch.textContent=watched?"★":"☆";
    watch.classList.toggle("active",watched);
    watch.setAttribute("aria-pressed",String(watched));
    watch.setAttribute("aria-label",`${watched?"Unwatch":"Watch"} ${horse.name}`);
  }
  if(studio.watchOnly&&![...studio.rowNodes.values()].some(row=>!row.hidden)){
    if(!$("watchEmpty")){
      const message=document.createElement("p");
      message.id="watchEmpty"; message.className="empty";message.style.padding="24px";
      message.textContent="No watched runners in this race. Turn off Watchlist and star a runner to add one.";
      container.append(message);
    }
  }else $("watchEmpty")?.remove();
};

// Obsolete duplicate detail panels are intentionally replaced by the desk.
renderRaceCard=function(){};
renderProfile=function(){};
renderLiveRaceState=function(){};

function updateStudio(){
  const leader=rankField()[0];
  const second=rankField()[1];
  const horse=selectedTradingHorse();
  const isPre=state.phase==="countdown";
  const rendering=window.RaceMarket3D?.getStatus();
  const true3D=Boolean(rendering?.supported&&rendering.mode==="webgl"&&!rendering.contextLost);
  document.querySelectorAll('[data-camera-mode="free"],[data-camera-mode="topdown"]').forEach(button=>{
    button.disabled=!true3D;
    button.title=true3D?"":"Available in WebGL 3D mode";
  });
  const isClosed=state.marketSuspended;
  safeText("studioVenue",state.profile?.track||"RaceMarket");
  safeText("studioRace",`R${String(state.raceNumber).padStart(2,"0")}`);
  const meta=$("studioMeta");
  const signature=[state.profile?.track,state.profile?.distance,state.profile?.surface,state.trackCondition?.name,state.horses.length].join("|");
  if(meta.dataset.signature!==signature){
    meta.dataset.signature=signature;
    meta.replaceChildren();
    [state.profile.distance,state.profile.surface,state.trackCondition.name,`${state.horses.length} runners`].forEach((value,index)=>{
      if(index){meta.append(document.createElement("i"));}
      const span=document.createElement("span");span.textContent=value;
      if(index===1)span.className="surface-chip";
      meta.append(span);
    });
  }
  safeText("studioClockLabel",studio.paused?"SIMULATION PAUSED":isPre?"GATES OPEN IN":isClosed?"WINNING TIME":"RACE ELAPSED");
  safeText("studioClock",isPre?fmt(state.openCountdown):isClosed?fmt(state.horses.find(h=>h.id===state.winner)?.finishTime||state.raceT):fmt(state.raceT));
  safeText("airLabel",studio.paused?"PAUSED":isPre?"AT THE GATE":isClosed?"OFFICIAL":"LIVE");
  $("freeCameraHelp").hidden=state.cameraMode!=="free";
  safeText("visualTrackStatus",studio.paused?"PAUSED":isPre?"AT THE GATE":isClosed?"OFFICIAL":"LIVE RACE");
  safeText("fieldCount",`${state.horses.length} runners`);
  safeText("sceneWeather",state.weather?.name||"");
  safeText("sceneCondition",`${state.profile?.surface} · ${state.trackCondition?.name}`);
  safeText("timelineLabel",isPre?"AT THE GATE":isClosed?"AT THE WIRE":"RACE PROGRESS");
  const progress=isPre?0:clamp((leader?.distanceTravelled||0)/state.raceDistance,0,1)*100;
  $("timelineFill").style.width=`${progress}%`;
  safeText("timelineValue",`${Math.round(progress)}%`);
  $("startNowBtn").hidden=!isPre;
  $("pauseBtn").hidden=isPre||state.phase==="settled";
  safeText("pauseBtn",studio.paused?"Resume simulation":"Pause simulation");
  safeText("navPositions",Object.values(state.positions).filter(p=>p.qty>0).length);
  const top=rankField().slice(0,3);
  $("sceneLiveOrder").innerHTML=isPre?"":top.map((h,i)=>`<span>${i+1}<b>#${h.post}</b></span>`).join("");
  if(horse){
    safeText("selectedPost",`POST ${String(horse.post).padStart(2,"0")}`);
    safeText("selectedStyle",`${horse.coat?.name||"Thoroughbred"} · ${horse.runningStyle}`);
    safeText("ticketTitle",horse.name);
    safeText("deskPrice",cents(currentPrice(horse)));
    safeText("deskPosition",isPre?"—":ordinal(horse.finishPosition||horse.position));
    safeText("deskEnergy",`${Math.round(horse.energy)}%`);
    safeText("deskGap",isPre?"—":horse.id===leader?.id?"Leader":`${lengthsBehind(leader,horse).toFixed(1)} L`);
    if($("silkIcon").dataset.id!==String(horse.id)){
      $("silkIcon").dataset.id=horse.id;$("silkIcon").innerHTML=silkGraphic(horse);
    }
  }
  const margin=leader&&second?lengthsBehind(leader,second):0;
  safeText("paceLabel",state.pacePlan.replace(/([A-Z])/g," $1").toUpperCase());
  safeText("leadMargin",isPre?"—":`${margin.toFixed(1)} L`);
  const remaining=state.horses.filter(h=>!h.finished).length;
  safeText("storyTitle",isPre?"The next move is yours.":isClosed?`${state.horses.find(h=>h.id===state.winner)?.name||"The winner"} gets there.`:margin>2.5?"A break from the pack.":margin<.7?"There’s little between them.":"The race is taking shape.");
  safeText("storyText",isPre?`${state.profile.track}, ${state.profile.distance.toLowerCase()}. ${state.horses.length} runners, one winning contract. Choose your horse before the gates open.`:isClosed?remaining?`The winner market is closed. ${remaining} ${remaining===1?"runner is":"runners are"} still coming through the line.`:"All runners are home. Your winning contracts have been settled. Build the next race or review your session.":`${leader?.name} leads by ${margin.toFixed(1)} lengths. ${second?.name||"The field"} is closest. Watch energy and position as the market reprices.`);
  const count=openTradingOrders().length;
  safeText("resultsTitle",`Race ${state.raceNumber} · Official result`);
  if(isPre)safeText("marketPillText","OPENS AT THE START");
  const button=$("placeBtn");
  if(studio.paused){
    button.disabled=true;button.textContent="Simulation paused";
  }else if(isPre){button.textContent="Market opens at the start";}
  else if(isClosed){button.textContent="Winner market closed";}
  else {button.textContent=`${state.side==="buy"?"Buy":"Sell"} YES · ${state.orderType==="market"?"Market":"Limit"} order`;}
  document.body.classList.toggle("studio-paused",studio.paused);
}

// Use one chart with fixed probability axes instead of a context-free sparkline.
drawChart=function drawStudioChart(){
  const canvas=$("chart");
  if(!canvas || canvas.clientWidth===0)return;
  const ctx=canvas.getContext("2d"); if(!ctx)return;
  const width=canvas.clientWidth,height=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const left=29,right=10,top=12,bottom=21,w=width-left-right,h=height-top-bottom;
  ctx.font="9px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.lineWidth=1;
  for(const price of [0,.25,.5,.75,1]){
    const y=top+h*(1-price);
    ctx.strokeStyle="#2d402955";ctx.beginPath();ctx.moveTo(left,y+.5);ctx.lineTo(width-right,y+.5);ctx.stroke();
    ctx.fillStyle="#69825b";ctx.textAlign="right";ctx.fillText(`${Math.round(price*100)}`,left-8,y+3);
  }
  const points=state.history[state.selected]||[];
  const maxT=Math.max(10,state.raceT);
  const X=t=>left+(t/maxT)*w;
  const Y=p=>top+(1-clamp(p,0,1))*h;
  ctx.textAlign="center";ctx.fillStyle="#69825b";
  for(let i=0;i<=3;i++){const t=Math.round(i*maxT/3);ctx.fillText(fmt(t),X(t),height-4);}
  if(points.length<2){
    ctx.textAlign="center";ctx.fillStyle="#82966f";ctx.fillText("Price discovery begins at the start",left+w/2,top+h/2);
    return;
  }
  const drawSeries=(series,color,fill=false)=>{
    if(series.length<2)return;
    ctx.beginPath();
    series.forEach((p,i)=>{if(i)ctx.lineTo(X(p.t),Y(p.p));else ctx.moveTo(X(p.t),Y(p.p));});
    if(fill){
      ctx.save();ctx.lineTo(X(series.at(-1).t),top+h);ctx.lineTo(X(series[0].t),top+h);ctx.closePath();
      const gradient=ctx.createLinearGradient(0,top,0,top+h);gradient.addColorStop(0,"#bedf8c29");gradient.addColorStop(1,"#bedf8c00");
      ctx.fillStyle=gradient;ctx.fill();ctx.restore();
      ctx.beginPath();series.forEach((p,i)=>{if(i)ctx.lineTo(X(p.t),Y(p.p));else ctx.moveTo(X(p.t),Y(p.p));});
    }
    ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.lineJoin="round";ctx.stroke();
  };
  if(studio.compare){
    const lead=rankField()[0];if(lead&&lead.id!==state.selected)drawSeries(state.history[lead.id]||[],"#deb887");
  }
  drawSeries(points,"#c7e8a7",true);
  const last=points.at(-1);ctx.beginPath();ctx.arc(X(last.t),Y(last.p),3,0,Math.PI*2);ctx.fillStyle="#deefbf";ctx.fill();
  if(studio.chartPoint!==null){
    const pointerT=clamp((studio.chartPoint-left)/w,0,1)*maxT;
    const point=points.reduce((a,b)=>Math.abs(b.t-pointerT)<Math.abs(a.t-pointerT)?b:a);
    ctx.strokeStyle="#8daa7888";ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(X(point.t),top);ctx.lineTo(X(point.t),top+h);ctx.stroke();ctx.setLineDash([]);
    const tip=$("chartTooltip");tip.hidden=false;tip.textContent=`${fmt(point.t)} · ${cents(point.p)}`;tip.style.left=`${clamp(X(point.t)+8,0,width-95)}px`;
  }
};
const studioBaseRender=render;
render=function renderStudio(){studioBaseRender();updateStudio();};

// Freeze the simulation and gait together, without disabling camera input.
const studioBaseTick=tick;
tick=function studioTick(){if(!state.studioPaused)studioBaseTick();};
const studioBaseRestart=restartRace;
restartRace=function studioRestart(){
  studio.paused=false;state.studioPaused=false;
  studio.watchOnly=false;
  studioBaseRestart();$("watchFilter")?.classList.remove("active");
  $("watchFilter")?.setAttribute("aria-pressed","false");
  updateStudio();
};

// All existing calls to flash keep the ticket message and additionally surface
// feedback in the current workspace, even when the desk is below the viewport.
const studioBaseFlash=flash;
flash=function studioFlash(message){studioBaseFlash(message);toast(message);};


const studioPlaceOrder=placeOrder;
placeOrder=function guardedStudioOrder(){
  if(document.querySelector("dialog[open]"))return;
  return studioPlaceOrder();
};
const studioClosePosition=closePositionAtMarket;
closePositionAtMarket=function studioClose(id){
  if(state.studioPaused){toast("Resume the simulation to close a position.");return;}
  return studioClosePosition(id);
};
const studioCloseAll=closeAllPositionsAtMarket;
closeAllPositionsAtMarket=function studioClosePositions(){
  if(state.studioPaused){toast("Resume the simulation to close positions.");return;}
  return studioCloseAll();
};

function fillConditionOptions(){
  const index=Number($("courseSelect").value);
  const surface=RACE_PROFILES[index]?.surface||"Dirt";
  const select=$("conditionSelect");select.replaceChildren();
  for(const condition of TRACK_CONDITIONS[surface]){
    select.add(new Option(condition.name,condition.name));
  }
}
function openSetup(){
  $("courseSelect").value=String(state.raceSetup.profileIndex);
  $("weatherSelect").value=state.raceSetup.weather;
  $("fieldSelect").value=String(state.raceSetup.fieldSize);
  fillConditionOptions();
  $("conditionSelect").value=state.raceSetup.condition;
  $("setupDialog").showModal();
}
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelector(".wordmark").addEventListener("click",event=>{
    event.preventDefault();navigate("exchange");window.scrollTo({top:0,behavior:"smooth"});
  });
  document.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>navigate(button.dataset.page)));
  for(const id of ["helpBtn","footerGuide"])$(id).addEventListener("click",()=>$("helpDialog").showModal());
  document.querySelectorAll("[data-close-dialog]").forEach(button=>button.addEventListener("click",()=>button.closest("dialog").close()));
  $("setupBtn").addEventListener("click",openSetup);
  RACE_PROFILES.forEach((profile,index)=>$("courseSelect").add(new Option(`${profile.track} · ${profile.distance} · ${profile.surface}`,index)));
  $("courseSelect").addEventListener("change",fillConditionOptions);
  $("setupForm").addEventListener("submit",event=>{
    event.preventDefault();
    const index=Number($("courseSelect").value), size=Number($("fieldSelect").value);
    if(!Number.isInteger(index)||!RACE_PROFILES[index]||size<6||size>20)return;
    state.raceSetup={profileIndex:index,fieldSize:size,weather:$("weatherSelect").value,condition:$("conditionSelect").value};
    $("setupDialog").close();restartRace();navigate("exchange");
  });
  $("startNowBtn").addEventListener("click",()=>{if(state.phase==="countdown"){state.openCountdown=1;tick();}});
  $("pauseBtn").addEventListener("click",()=>{
    studio.paused=!studio.paused;state.studioPaused=studio.paused;render();
    toast(studio.paused?"Race and trading paused. Camera controls remain available.":"Race resumed.");
  });
  document.querySelectorAll("[data-camera-mode]").forEach(button=>button.addEventListener("click",updateStudio));
  $("followSelected").addEventListener("click",()=>setCameraMode("selected"));
  $("raceRenderControls").addEventListener("click",()=>{
    if(state.renderMode==="classic"&&["free","topdown"].includes(state.cameraMode))setCameraMode("wide");
    updateStudio();
  });
  $("labelMode").addEventListener("change",()=>{state.labelMode=$("labelMode").value;});
  $("theatreBtn").addEventListener("click",()=>{
    const active=document.body.classList.toggle("theatre");
    $("theatreBtn").setAttribute("aria-label",active?"Exit theatre view":"Expand broadcast");
    $("theatreBtn").setAttribute("aria-pressed",String(active));
  });
  $("watchFilter").addEventListener("click",()=>{
    studio.watchOnly=!studio.watchOnly;$("watchFilter").classList.toggle("active",studio.watchOnly);
    $("watchFilter").setAttribute("aria-pressed",String(studio.watchOnly));renderHorses();
  });
  $("compareBtn").addEventListener("click",()=>{
    studio.compare=!studio.compare;$("compareBtn").classList.toggle("active",studio.compare);
    $("compareBtn").setAttribute("aria-pressed",String(studio.compare));drawChart();
  });
  $("chart").addEventListener("pointermove",event=>{
    studio.chartPoint=event.clientX-$("chart").getBoundingClientRect().left;drawChart();
  });
  $("chart").addEventListener("pointerleave",()=>{studio.chartPoint=null;$("chartTooltip").hidden=true;drawChart();});
  if("ResizeObserver" in window)new ResizeObserver(()=>drawChart()).observe($("chart"));
  $("exportBtn").addEventListener("click",()=>{
    const data={application:"RaceMarket Studio 04",exportedAt:new Date().toISOString(),simulationOnly:true,account:tradingAccountMetrics(),race:{track:state.profile.track,phase:state.phase,winner:state.winner,finishOrder:state.finishOrder},positions:state.positions,orders:state.orders,activity:state.tradeHistory};
    const link=document.createElement("a");link.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    link.download="racemarket-session.json";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    toast("Session exported. This is a local paper-trading record.");
  });
  render();
});
