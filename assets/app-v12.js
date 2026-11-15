/* J.A.R.V.I.S. dashboard - no build step, no external deps. */
(function(){
"use strict";
const C = Object.assign({VOICE_DIRS:["assets/voice/final_Paul_Bettany_AI","assets/voice/clean_Paul_Bettany_AI"],WEBHOOK_URL:"",RESPONSES_URL:"",RESPONSES_POLL_SECONDS:15,RESPONSES_TOPIC:"",SOURCE:"phone",
  DATA_URL:"data.json",DATA_REFRESH_SECONDS:60,WEATHER:null,
  TIMEZONE:"",WAKE_WORD_ON_MOBILE:false,USE_24H:true,WAKE_WORD:"jarvis",WAKE_WORD_ENABLED:true,TTS_PITCH:.9,TTS_RATE:.95,
  TTS_VOICE_PREFERENCE:["Microsoft Ryan","Google UK English Male","en-GB"],PLAY_STARTUP_GREETING:true,WEBHOOK_HEADERS:{}}, window.JARVIS_CONFIG||{});
const $ = s => document.querySelector(s);
try{ C.TIMEZONE = C.TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; new Intl.DateTimeFormat("en-GB",{timeZone:C.TIMEZONE}); }catch(e){ C.TIMEZONE="UTC"; }
const MOBILE = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || matchMedia("(pointer:coarse)").matches;
if (MOBILE && !C.WAKE_WORD_ON_MOBILE) C.WAKE_WORD_ENABLED = false;
const phoneMQ = matchMedia("(max-width: 899px) and (orientation: portrait)");
const qs = new URLSearchParams(location.search);
const STATIC = qs.has("static");
if (qs.has("noboot")) document.body.classList.add("noboot");

/* ---------- scale the 1920x1080 stage to any window ---------- */
const stage=$("#stage");
function fit(){ document.body.classList.toggle("phone",phoneMQ.matches);
  if(phoneMQ.matches){ stage.style.transform="none"; return; }
  const W=document.documentElement.clientWidth||innerWidth, H=document.documentElement.clientHeight||innerHeight;  // mobile: innerWidth grows with overflow
  const s=Math.min(W/1920,H/1080);
  stage.style.transform=`translate(${(W-1920*s)/2}px,${(H-1080*s)/2}px) scale(${s})`; }
addEventListener("resize",fit); phoneMQ.addEventListener&&phoneMQ.addEventListener("change",fit); fit();

/* ---------- starfield ---------- */
(function(){ const cv=$("#stars"),x=cv.getContext("2d"); let seed=7; const r=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let i=0;i<260;i++){ const px=r()*1920,py=r()*1080,s=r()*1.3+.2; x.fillStyle=`rgba(${120+r()*80|0},${190+r()*60|0},255,${.15+r()*.5})`; x.beginPath(); x.arc(px,py,s,0,7); x.fill(); } })();

/* ---------- activity log ---------- */
function log(msg){ const p=new Intl.DateTimeFormat("en-GB",{timeZone:C.TIMEZONE,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date());
  const ul=$("#log"); const li=document.createElement("li"); li.innerHTML=`<b>${p}</b><span></span>`; li.lastChild.innerHTML=linkify(msg); ul.prepend(li);
  while(ul.children.length>8) ul.lastChild.remove(); }

/* ---------- v12.10 conversation history (CHAT): stored only on this device, JARVIS conversations only ---------- */
function escHtml(s){ return String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
const URL_RE=/\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
function linkify(text){
  const t=String(text==null?"":text); let out="", last=0; URL_RE.lastIndex=0; let m;
  while((m=URL_RE.exec(t))){
    let u=m[0]; const trail=(u.match(/[.,;:!?)\]}>'"]+$/)||[""])[0]; if(trail){ u=u.slice(0,u.length-trail.length); }
    if(u.length<5){ continue; }
    const href=/^www\./i.test(u)?"https://"+u:u;
    out+=escHtml(t.slice(last,m.index))+`<a href="${escHtml(href)}" target="_blank" rel="noopener noreferrer">${escHtml(u)}</a>`;
    last=m.index+u.length;
  }
  return out+escHtml(t.slice(last));
}
const LS_HIST="jarvis_history_v1", HIST_MAX=600;
let chatHist=(()=>{ try{ const a=JSON.parse(localStorage.getItem(LS_HIST)||"[]"); return Array.isArray(a)?a.filter(x=>x&&x.t&&x.r):[]; }catch(e){ return []; } })();
function histSave(){ try{ while(chatHist.length>HIST_MAX) chatHist.shift(); let j=JSON.stringify(chatHist);
    while(j.length>900000 && chatHist.length>20){ chatHist.splice(0,50); j=JSON.stringify(chatHist); } localStorage.setItem(LS_HIST,j); }catch(e){} }
function histAdd(who,text,id){
  text=String(text||"").trim(); if(!text || (typeof isEmailJson==="function" && isEmailJson(text))) return false;
  const r=who==="you"?"you":"jarvis", now=Date.now();
  for(let i=chatHist.length-1;i>=0 && i>=chatHist.length-12;i--){ const h=chatHist[i];
    if((id && h.id===String(id)) || (h.r===r && h.t===text && now-h.ts<120000)) return false; }
  const e={r,t:text,ts:now}; if(id) e.id=String(id);
  chatHist.push(e); histSave();
  const p=document.getElementById("chat-panel");
  if(p && !p.hidden) chatRender(true);
  else if(r==="jarvis"){ const d=document.getElementById("chat-new"); if(d) d.hidden=false;
    if(URL_RE.test(text) || /\b(in|on) (our|the|this) chat\b/i.test(text)){ try{ toast("LINK IN CHAT · TAP CHAT",3500); }catch(_){} } URL_RE.lastIndex=0; }
  return true;
}
function chatDay(ts){ try{ return new Intl.DateTimeFormat("en-GB",{timeZone:C.TIMEZONE,weekday:"short",day:"2-digit",month:"short"}).format(new Date(ts)).toUpperCase(); }catch(e){ return ""; } }
function chatTime(ts){ try{ return new Intl.DateTimeFormat("en-GB",{timeZone:C.TIMEZONE,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(ts)); }catch(e){ return ""; } }
function chatRender(stick){
  const ol=document.getElementById("chat-list")||document.getElementById("ch-list"); if(!ol) return;
  const atBottom=ol.scrollHeight-ol.scrollTop-ol.clientHeight<40;
  if(!chatHist.length){ ol.innerHTML=`<li class="ch-empty">NO CONVERSATIONS YET<br>WHAT YOU ASK AND WHAT JARVIS ANSWERS APPEARS HERE</li>`; return; }
  let html="", day="";
  for(const h of chatHist){ const d=chatDay(h.ts); if(d!==day){ day=d; html+=`<li class="ch-day">${escHtml(d)}</li>`; }
    html+=`<li class="ch-msg ch-${h.r==="you"?"you":"jarvis"}">${linkify(h.t)}<time>${h.r==="you"?"YOU":"JARVIS"} · ${chatTime(h.ts)}</time></li>`; }
  ol.innerHTML=html;
  if(stick===true || atBottom || stick==="open") ol.scrollTop=ol.scrollHeight;
}
let chatHideT=0;
function openChat(){
  const p=document.getElementById("chat-panel"); if(!p) return false;
  try{ closeTodo(); }catch(e){} try{ const ep=document.getElementById("email-panel"); if(ep&&!ep.hidden) closeInbox(); }catch(e){}
  clearTimeout(chatHideT); p.classList.remove("ch-closing"); document.body.classList.add("chat-open");
  if(p.hidden){ p.hidden=false; void p.offsetWidth; }
  chatRender("open"); p.classList.add("ch-open");
  const d=document.getElementById("chat-new"); if(d) d.hidden=true;
  vlog({ev:"chat-open",n:chatHist.length}); return true;
}
function closeChat(){
  const p=document.getElementById("chat-panel"); if(!p||p.hidden){ document.body.classList.remove("chat-open"); return; }
  p.classList.remove("ch-open"); p.classList.add("ch-closing");
  clearTimeout(chatHideT); chatHideT=setTimeout(()=>{ if(!p.classList.contains("ch-closing")) return; p.hidden=true; p.classList.remove("ch-closing"); document.body.classList.remove("chat-open"); },
    (window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)?140:640);
}
function toggleChat(){ const p=document.getElementById("chat-panel"); if(p && !p.hidden && p.classList.contains("ch-open")) closeChat(); else openChat(); }
(function bindChat(){
  const go=()=>{ const b=document.getElementById("chat-btn"); if(b) b.addEventListener("click",e=>{ e.preventDefault(); toggleChat(); });
    const c=document.getElementById("ch-close"); if(c) c.addEventListener("click",e=>{ e.preventDefault(); closeChat(); });
    document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ const p=document.getElementById("chat-panel"); if(p&&!p.hidden) closeChat(); } }); };
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",go); else go(); })();

/* ---------- voice cues (fixed JARVIS clips, Paul Bettany AI pack) ---------- */
// The clips are Waze navigation prompts; only lines that make sense outside a car are used.
const CUES={
  boot:"StartDrive2",   // "Welcome back, sir. System booted successfully. All systems are now online and fully operational."
  ready:"StartDrive7",  // "Sir, I am fully operational and standing by, ready whenever you are."
  ack:"StartDrive6",    // "Initiating now, sir."
  done:"StartDrive9",   // "Sir, we all are set and ready to go."
  online:"StartDrive5", // "Very good sir, all systems are optimal, awaiting your command."
  error:"TickerPoints"  // "Apologies sir. The data has been compromised..."
};
let voiceDir=null, muted=false, speaking=false;
function probe(src){ if(location.protocol==="file:") return new Promise(res=>{ const a=new Audio(); a.preload="auto"; a.oncanplaythrough=()=>res(true); a.onerror=()=>res(false); a.src=src; setTimeout(()=>res(false),4000); });
  return fetch(src).then(r=>r.ok).catch(()=>false); }
async function resolveVoiceDir(){ for(const d of C.VOICE_DIRS){ if(await probe(`${d}/${CUES.ready}.mp3`)){ voiceDir=d; break; } }
  $("#gi-pack").textContent = voiceDir? (voiceDir.includes("final")?"BETTANY · FINAL":"BETTANY · CLEAN") : "NO CLIPS";
  if(voiceDir){ const files=Object.values(CUES).concat(typeof LINE_CLIP_FILES!=="undefined"?LINE_CLIP_FILES:[]); files.forEach(c=>{ if(!c) return; const src=`${voiceDir}/${c}.mp3`; if(!audioCache[src]){ const a=new Audio(); a.preload="auto"; a.src=src; audioCache[src]=a; } }); }
  return voiceDir; }
const audioCache={};
const voiceReady = resolveVoiceDir();

/* ---------- voice analyser: sphere flares with real loudness ---------- */
let voiceCtx=null, analyser=null, freqData=null, timeData=null;
const hookedMedia=new WeakSet();
function audioCtx(){
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return null;
  if(!voiceCtx) voiceCtx=new AC();
  if(voiceCtx.state==="suspended" && voiceCtx.resume) voiceCtx.resume();
  return voiceCtx;
}
function ensureAnalyser(){
  const ctx=audioCtx(); if(!ctx) return null;
  if(analyser) return analyser;
  analyser=ctx.createAnalyser();
  analyser.fftSize=512;
  analyser.smoothingTimeConstant=0.72;
  freqData=new Uint8Array(analyser.frequencyBinCount);
  timeData=new Uint8Array(analyser.fftSize);
  try{ analyser.connect(ctx.destination); }catch(e){}
  return analyser;
}
function hookMedia(el){
  if(!el || hookedMedia.has(el)) return;
  const ctx=audioCtx(), an=ensureAnalyser();
  if(!ctx||!an) return;
  try{
    if(!el.crossOrigin) el.crossOrigin="anonymous";
    const src=ctx.createMediaElementSource(el);
    src.connect(an);
    hookedMedia.add(el);
  }catch(e){}
}
function liveRms(){
  if(!analyser||!timeData) return 0;
  analyser.getByteTimeDomainData(timeData);
  let s=0; for(let i=0;i<timeData.length;i++){ const v=(timeData[i]-128)/128; s+=v*v; }
  return Math.min(1, Math.sqrt(s/timeData.length)*3.6);
}
function speechEnvelope(t){
  const word=Math.max(0,Math.sin(t*5.2));
  const syll=Math.pow(Math.max(0,Math.sin(t*17)*Math.sin(t*13.3+1.2)),1.4);
  const gap=(Math.sin(t*1.7)+1)/2;
  return Math.min(1,(0.28+0.72*syll*word)*(gap>0.18?1:0.08));
}
window.JARVIS_AUDIO={
  level(t){
    const now=(typeof t==="number"&&isFinite(t))?t:(performance.now()/1000);
    if(qs.has("amp") && !qs.has("demo")){
      const base=Math.min(1,Math.max(0,parseFloat(qs.get("amp"))||0.85));
      return Math.min(1, base*(0.9+0.1*Math.abs(Math.sin(now*9))));
    }
    const live=liveRms();
    if(speaking && live>0.02) return Math.max(live,0.22);
    if(live>0.045) return live;
    if((qs.has("speak")||qs.has("demo")) && !speaking) return speechEnvelope(now);
    if(speaking) return Math.max(live, speechEnvelope(now)*0.85);
    return 0.16+0.05*Math.sin(now*0.8);
  },
  frequencies(){ if(!analyser||!freqData) return null; analyser.getByteFrequencyData(freqData); return freqData; },
  speaking(){ return !!speaking; }
};

/* ---------- single speaker: one queue, one instance, exclusive output ---------- */
const AUDIO_WAIT_MS=(()=>{ const n=parseInt(qs.get("audiowait")||"",10); return Number.isFinite(n)&&n>=0?Math.min(60000,n):20000; })();
const AUDIO_RETAIN_MS=60000;
const voiceLog=[];
function vlog(e){ try{ voiceLog.push(Object.assign({t:Math.round(performance.now())},e)); if(voiceLog.length>300) voiceLog.shift(); }catch(_){ } }
window.JARVIS_VOICE_LOG=voiceLog;

const instId="j"+Math.random().toString(36).slice(2)+Date.now().toString(36);
const INST_KEY="jarvis_voice_instance";
let leaderId=instId, leaderTs=Date.now(), voiceChan=null;
function isVoiceLeader(){ return leaderId===instId; }
function onRemoteClaim(rec){
  if(!rec||!rec.id||rec.id===instId) return;
  const ts=+rec.ts||0;
  if(ts>leaderTs || (ts===leaderTs && String(rec.id)>instId)){
    const was=isVoiceLeader();
    leaderId=rec.id; leaderTs=ts;
    if(was) invalidateVoice();
  } else if(isVoiceLeader()){
    try{ voiceChan&&voiceChan.postMessage({type:"claim",id:instId,ts:leaderTs}); }catch(_){}
  }
}
function claimVoice(){
  leaderId=instId; leaderTs=Date.now();
  const rec={id:instId,ts:leaderTs};
  try{ localStorage.setItem(INST_KEY,JSON.stringify(rec)); }catch(_){}
  try{ voiceChan&&voiceChan.postMessage({type:"claim",id:instId,ts:leaderTs}); }catch(_){}
}
try{
  voiceChan=new BroadcastChannel("jarvis-voice");
  voiceChan.onmessage=ev=>{ const d=ev&&ev.data; if(d&&d.type==="claim") onRemoteClaim(d); };
}catch(_){ voiceChan=null; }
addEventListener("storage",ev=>{
  if(ev.key!==INST_KEY||!ev.newValue) return;
  try{ onRemoteClaim(JSON.parse(ev.newValue)); }catch(_){}
});
addEventListener("focus",claimVoice);
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) claimVoice(); });
["pointerdown","touchend","keydown"].forEach(ev=>addEventListener(ev,claimVoice,{capture:true,passive:true}));
if(!document.hidden) claimVoice();

function canSpeak(){ return !muted && isVoiceLeader(); }

let voiceSeq=0, voiceJobDepth=0, speakChain=Promise.resolve();
let activeMedia=null, ttsUtter=null, ttsForText="";
const spokenTts=new Set();
function noteTts(text){ if(!text) return; spokenTts.add(text); if(spokenTts.size>40){ spokenTts.delete(spokenTts.values().next().value); } }
function ttsAlready(text){ return !!(text&&(spokenTts.has(text)||ttsForText===text)); }

function silenceAll(){
  const a=activeMedia; activeMedia=null;
  if(a){
    try{ if(typeof a._jarvisFin==="function") a._jarvisFin(false); }catch(_){}
    try{ a.pause(); a.onended=a.onerror=a.onplaying=null; if(!a._jarvisCue){ a.removeAttribute("src"); a.load(); } else { try{ a.currentTime=0; }catch(_){ } } }catch(_){}
  }
  const u=ttsUtter;
  ttsUtter=null; ttsForText="";
  try{ if(u && typeof u._jarvisFin==="function") u._jarvisFin(false); }catch(_){}
  try{ if("speechSynthesis" in window) speechSynthesis.cancel(); }catch(_){}
  speaking=false; try{ setBusy(); }catch(_){}
}
function invalidateVoice(){ voiceSeq++; silenceAll(); }
function stopReplyAudio(){ invalidateVoice(); }

function enqueueVoice(fn){
  speakChain=speakChain.then(job,job);
  async function job(){
    voiceJobDepth++;
    try{ await fn(voiceSeq); }
    catch(e){ vlog({ev:"job-error",err:String(e&&e.message||e)}); }
    finally{ voiceJobDepth--; }
  }
  return speakChain;
}

async function playExclusiveCue(name, token){
  if(token!==voiceSeq || !canSpeak()) return false;
  await voiceReady;
  if(token!==voiceSeq || !canSpeak() || !voiceDir || !CUES[name]) return false;
  silenceAll();
  if(token!==voiceSeq) return false;
  const src=`${voiceDir}/${CUES[name]}.mp3`;
  const a=audioCache[src]||(audioCache[src]=new Audio(src));
  a._jarvisCue=true;
  hookMedia(a);
  activeMedia=a;
  try{ a.currentTime=0; }catch(_){}
  speaking=true; setBusy();
  vlog({ev:"start",kind:"cue",name});
  const ok=await new Promise(res=>{
    let done=false;
    const fin=good=>{ if(done) return; done=true; clearTimeout(guard); a._jarvisFin=null; if(activeMedia===a) activeMedia=null; speaking=false; setBusy(); res(!!good); };
    const guard=setTimeout(()=>fin(true),20000);
    a._jarvisFin=fin;
    a.onended=()=>fin(true); a.onerror=()=>fin(false);
    const p=a.play(); if(p&&p.catch) p.catch(()=>fin(false));
  });
  vlog({ev:"end",kind:"cue",name,ok});
  return ok;
}

async function playExclusiveFile(file, token){
  if(token==null) token=voiceSeq;
  if(token!==voiceSeq || !canSpeak() || !file) return false;
  await voiceReady;
  if(token!==voiceSeq || !canSpeak() || !voiceDir) return false;
  silenceAll();
  if(token!==voiceSeq) return false;
  const src=`${voiceDir}/${file}.mp3`;
  const a=audioCache[src]||(audioCache[src]=new Audio(src));
  a._jarvisCue=true;
  hookMedia(a);
  activeMedia=a;
  try{ a.currentTime=0; }catch(_){}
  speaking=true; setBusy();
  vlog({ev:"start",kind:"cue",name:file});
  const ok=await new Promise(res=>{
    let done=false;
    const fin=good=>{ if(done) return; done=true; clearTimeout(guard); a._jarvisFin=null; if(activeMedia===a) activeMedia=null; speaking=false; setBusy(); res(!!good); };
    const guard=setTimeout(()=>fin(true),20000);
    a._jarvisFin=fin;
    a.onended=()=>fin(true); a.onerror=()=>fin(false);
    const p=a.play(); if(p&&p.catch) p.catch(()=>fin(false));
  });
  vlog({ev:"end",kind:"cue",name:file,ok});
  return ok;
}

async function playExclusiveUrl(url, token){
  if(token!==voiceSeq || !canSpeak() || !url) return false;
  silenceAll();
  if(token!==voiceSeq) return false;
  const a=new Audio(); a.preload="auto"; a.crossOrigin="anonymous";
  hookMedia(a);
  activeMedia=a;
  speaking=true; setBusy();
  vlog({ev:"start",kind:"mp3",src:String(url).split("?")[0].slice(-40)});
  const ok=await new Promise(res=>{
    let done=false;
    const fin=good=>{ if(done) return; done=true; clearTimeout(guard); a._jarvisFin=null; if(activeMedia===a) activeMedia=null; speaking=false; setBusy(); res(!!good); };
    const guard=setTimeout(()=>fin(false),20000);
    a._jarvisFin=fin;
    a.onended=()=>fin(true); a.onerror=()=>fin(false); a.onplaying=()=>{speaking=true;setBusy();};
    a.src=url; const p=a.play(); if(p&&p.catch) p.catch(()=>fin(false));
  });
  vlog({ev:"end",kind:"mp3",ok});
  return ok;
}
async function playExclusiveTts(text, token){
  if(token!==voiceSeq || !canSpeak() || !text || !("speechSynthesis" in window) || !ttsVoice) return false;
  silenceAll();
  if(token!==voiceSeq) return false;
  noteTts(text);
  ttsForText=text;
  vlog({ev:"start",kind:"tts",text});
  const ok=await new Promise(res=>{
    const u=new SpeechSynthesisUtterance(text); ttsUtter=u;
    if(ttsVoice) u.voice=ttsVoice; u.pitch=C.TTS_PITCH; u.rate=C.TTS_RATE;
    u.lang=(ttsVoice&&ttsVoice.lang)||"en-GB";
    let done=false;
    const fin=good=>{ if(done) return; done=true; clearTimeout(guard); u._jarvisFin=null; if(ttsUtter===u){ ttsUtter=null; if(ttsForText===text) ttsForText=""; } speaking=false; setBusy(); res(!!good); };
    const guard=setTimeout(()=>fin(true), 4000+String(text).length*120);
    u._jarvisFin=fin;
    u.onstart=()=>{speaking=true;setBusy();}; u.onend=()=>fin(true); u.onerror=()=>fin(false);
    try{ speechSynthesis.speak(u); }catch(e){ fin(false); }
  });
  vlog({ev:"end",kind:"tts",ok});
  return ok;
}

async function cue(name){
  if(voiceJobDepth>0) return playExclusiveCue(name, voiceSeq);
  return enqueueVoice(token=>playExclusiveCue(name, token));
}
function say(text){
  if(!text) return Promise.resolve();
  if(voiceJobDepth>0) return playExclusiveTts(text, voiceSeq);
  return enqueueVoice(token=>playExclusiveTts(text, token));
}
function playUrl(url){
  if(voiceJobDepth>0) return playExclusiveUrl(url, voiceSeq);
  return enqueueVoice(token=>playExclusiveUrl(url, token));
}

function dayPart(){
  let h;
  try{
    const opt={hour:"2-digit",hour12:false};
    if(C.TIMEZONE) opt.timeZone=C.TIMEZONE;
    const o={}; new Intl.DateTimeFormat("en-GB",opt).formatToParts(new Date()).forEach(p=>o[p.type]=p.value);
    h=+o.hour;
  }catch(e){ h=new Date().getHours(); }
  if(h<5) return "evening";
  if(h<12) return "morning";
  if(h<18) return "afternoon";
  return "evening";
}
const lastVariant={};
function pickVariant(key, bank){
  const items=bank.map(it=>({id:it.id, cue:it.cue||"", text:typeof it.text==="function"?it.text():it.text}));
  const prev=lastVariant[key];
  const pool=items.length>1?items.filter(it=>it.id!==prev):items;
  const choice=pool[Math.floor(Math.random()*pool.length)]||items[0];
  lastVariant[key]=choice.id;
  return choice;
}
const LINES={
  boot:[
    {id:"clip", cue:"boot", text:"Welcome back, sir. System booted successfully. All systems are now online and fully operational."},
    {id:"tod-welcome", clip:()=>"var_boot_tod_welcome_"+dayPart(), text:()=>"Good "+dayPart()+", sir. Welcome back. All systems are online and fully operational."},
    {id:"tod-standby", clip:()=>"var_boot_tod_standby_"+dayPart(), text:()=>"Good "+dayPart()+", sir. I've completed the boot sequence and I'm standing by."},
    {id:"tod-pleasure", clip:()=>"var_boot_tod_pleasure_"+dayPart(), text:()=>"Good "+dayPart()+", sir. A pleasure to see you. Every system is nominal."},
    {id:"order", clip:"var_boot_order", text:"Welcome back, sir. Everything is in order. I'm ready when you are."},
    {id:"hello", clip:"var_boot_hello", text:"Hello, sir. Boot sequence complete. I'm at your disposal."}
  ],
  ready:[
    {id:"clip", cue:"ready", text:"Sir, I am fully operational and standing by, ready whenever you are."},
    {id:"service", clip:"var_ready_service", text:"At your service, sir."},
    {id:"here", clip:"var_ready_here", text:"Yes, sir. I'm here."},
    {id:"listening", clip:"var_ready_listening", text:"I'm listening, sir."},
    {id:"whenever", clip:"var_ready_whenever", text:"Ready when you are, sir."},
    {id:"tod", clip:()=>"var_ready_tod_"+dayPart(), text:()=>"Good "+dayPart()+", sir. Standing by."}
  ],
  error:[
    {id:"clip", cue:"error", text:"Apologies, sir. I'm afraid something has gone wrong."},
    {id:"uplink", clip:"var_error_uplink", text:"Apologies, sir. I couldn't reach the uplink."},
    {id:"through", clip:"var_error_through", text:"I'm sorry, sir. That didn't go through."},
    {id:"afraid", clip:"var_error_afraid", text:"I'm afraid that failed, sir."},
    {id:"transmission", clip:"var_error_transmission", text:"Something went wrong with the transmission, sir."},
    {id:"complete", clip:"var_error_complete", text:"Apologies, sir. I wasn't able to complete that."}
  ]
};
const LINE_CLIP_FILES=["var_boot_tod_welcome_morning","var_boot_tod_welcome_afternoon","var_boot_tod_welcome_evening","var_boot_tod_standby_morning","var_boot_tod_standby_afternoon","var_boot_tod_standby_evening","var_boot_tod_pleasure_morning","var_boot_tod_pleasure_afternoon","var_boot_tod_pleasure_evening","var_boot_order","var_boot_hello","var_ready_service","var_ready_here","var_ready_listening","var_ready_whenever","var_ready_tod_morning","var_ready_tod_afternoon","var_ready_tod_evening","var_error_uplink","var_error_through","var_error_afraid","var_error_transmission","var_error_complete"];
function resolveClip(it){
  if(!it) return "";
  if(typeof it.clip==="function") return it.clip()||"";
  if(it.clip) return it.clip;
  if(it.cue && CUES[it.cue]) return CUES[it.cue];
  return "";
}
function cueAvailable(name){
  if(!voiceDir||!CUES[name]) return false;
  return !!audioCache[`${voiceDir}/${CUES[name]}.mp3`];
}
function clipAvailable(file){
  if(!voiceDir||!file) return false;
  return !!audioCache[`${voiceDir}/${file}.mp3`];
}
function availableLines(key){
  const bank=LINES[key]; if(!bank) return [];
  return bank.map(it=>{
    const text=typeof it.text==="function"?it.text():it.text;
    const clip=resolveClip(it);
    return {id:it.id, text, clip, cue:it.cue||""};
  }).filter(it=>clipAvailable(it.clip));
}
async function speakLine(key){
  const bank=LINES[key];
  if(!bank) return cue(key);
  await voiceReady;
  const pool=availableLines(key);
  if(!pool.length){ vlog({ev:"line-skip",key,reason:"no-clip"}); return; }
  const prev=lastVariant[key];
  const choices=pool.length>1?pool.filter(it=>it.id!==prev):pool;
  const v=choices[Math.floor(Math.random()*choices.length)]||pool[0];
  lastVariant[key]=v.id;
  vlog({ev:"line",key,id:v.id,clip:v.clip});
  const src=`${voiceDir}/${v.clip}.mp3`;
  const a=audioCache[src]||(audioCache[src]=new Audio(src));
  if(voiceJobDepth>0) return playExclusiveFile(v.clip, voiceSeq);
  return enqueueVoice(token=>playExclusiveFile(v.clip, token));
}

const audioWaiters=new Map();
const recentAudio=[];
const ACK_WAIT_MS=3000;
const ACK_LINES=[
  "I'll get that for you in a moment, sir.",
  "Let me look into that, sir.",
  "One moment, sir, I'm checking now.",
  "Give me just a second, sir.",
  "Looking into it now, sir.",
  "Let me find out for you, sir.",
  "Right away, sir.",
  "Of course, sir. I'm on it.",
  "Consider it done, sir. Give me a moment.",
  "Very good, sir. Working on it now.",
  "Certainly, sir. One moment.",
  "As you wish, sir.",
  "On it, sir."
];
const ACK_SET=new Set(ACK_LINES);
function isAckText(t){ return ACK_SET.has(String(t||"").trim()); }
let requestGen=0, lastRequestAt=0, ackPlayedGen=0, realReplyGen=0, pendingAck=null;
function noteSentRequest(){
  requestGen++;
  lastRequestAt=Date.now();
  ackPlayedGen=0;
  realReplyGen=0;
  if(pendingAck && !pendingAck.started){ pendingAck.cancelled=true; vlog({ev:"drop-ack",reason:"new-request"}); }
  pendingAck=null;
}
function ackStillWanted(job){
  return !!(job && !job.cancelled && job.gen===requestGen && realReplyGen!==job.gen && ackPlayedGen!==job.gen);
}

function takeRecentAudio(text){
  const now=Date.now();
  for(let i=0;i<recentAudio.length;i++){
    if(now-recentAudio[i].ts>AUDIO_RETAIN_MS){ recentAudio.splice(i,1); i--; continue; }
    if(recentAudio[i].text===text){ return recentAudio.splice(i,1)[0].url; }
  }
  return "";
}
function waitForAudio(text, ms){
  const ready=takeRecentAudio(text); if(ready) return Promise.resolve(ready);
  const windowMs=(typeof ms==="number"?ms:AUDIO_WAIT_MS);
  return new Promise(resolve=>{
    const rec={};
    rec.timer=setTimeout(()=>rec.finish(""), Math.max(0,windowMs));
    rec.finish=url=>{ if(rec.done) return; rec.done=true; clearTimeout(rec.timer); const arr=audioWaiters.get(text)||[]; const i=arr.indexOf(rec); if(i>=0) arr.splice(i,1); if(!arr.length) audioWaiters.delete(text); resolve(url||""); };
    const arr=audioWaiters.get(text)||[]; arr.push(rec); audioWaiters.set(text,arr);
  });
}
/* v12.3.1 streamed reply audio: the relay publishes part 1 as soon as it is rendered, later parts while it plays,
   then the full MP3 for older clients. Parts play in order; the full copy is ignored once parts started. */
const PART_WAIT_MS=20000, PART_RETAIN_MS=300000;
const audioParts=new Map();
function partRec(text,create){
  const now=Date.now();
  for(const [k,r] of audioParts){ if(now-r.ts>PART_RETAIN_MS) audioParts.delete(k); }
  let r=audioParts.get(text);
  if(!r&&create){ r={n:0,urls:{},started:false,ts:now,waiters:{}}; audioParts.set(text,r); }
  return r||null;
}
function offerPart(msg){
  const r=partRec(msg.text,true); r.ts=Date.now();
  if(msg.part===1||!r.n||msg.parts<r.n) r.n=msg.parts;
  r.urls[msg.part]=msg.url;
  vlog({ev:"mp3-part",k:msg.part,n:msg.parts,text:msg.text});
  const fire=(k,u)=>{ const w=r.waiters[k]; if(w){ delete r.waiters[k]; w.forEach(f=>f(u)); } };
  fire(msg.part,msg.url);
  Object.keys(r.waiters).forEach(k=>{ if(+k>r.n) fire(+k,""); });
}
function waitPart(r,k,ms){
  if(r.urls[k]) return Promise.resolve(r.urls[k]);
  if(r.n&&k>r.n) return Promise.resolve("");
  return new Promise(res=>{ let done=false; const f=u=>{ if(done) return; done=true; clearTimeout(t); res(u||""); };
    const t=setTimeout(()=>f(""),ms); (r.waiters[k]=r.waiters[k]||[]).push(f); });
}
async function playWithParts(text,url,token){
  const r=partRec(text,false), isP1=!!(r&&r.urls[1]===url);
  if(isP1) r.started=true;
  const ok=await playExclusiveUrl(url, token);
  if(!ok||!isP1) return ok;
  for(let k=2;k<=r.n;k++){
    if(token!==voiceSeq||!canSpeak()) return true;
    const u=await waitPart(r,k,PART_WAIT_MS);
    if(!u){ vlog({ev:"part-missing",k,n:r.n,text}); return true; }
    if(token!==voiceSeq||!canSpeak()) return true;
    await playExclusiveUrl(u, token);
  }
  return true;
}
function offerAudio(msg){
  if(!msg||!msg.url) return;
  if(ttsAlready(msg.text)){ vlog({ev:"drop-mp3",reason:"tts-already",text:msg.text}); return; }
  if(msg.part){ offerPart(msg); if(msg.part!==1) return; }
  else { const pr=partRec(msg.text,false); if(pr&&(pr.started||pr.urls[1])){ vlog({ev:"drop-mp3",reason:"full-after-parts",text:msg.text}); return; } }
  if(isAckText(msg.text)){
    vlog({ev:"drop-ack",reason:"unused-mp3",text:msg.text});
    return;
  }
  const arr=audioWaiters.get(msg.text);
  if(arr&&arr.length){ arr[0].finish(msg.url); return; }
  recentAudio.push({text:msg.text,url:msg.url,ts:Date.now()}); if(recentAudio.length>20) recentAudio.shift();
}


/* ---------- v12 holographic inbox ---------- */
const EMAIL_PREFIX="JARVIS_EMAIL_JSON:";
let EMAIL_WAIT_MS=45000;   // v12.2: real routine replies take ~15-25 s; was 18 s
const EMAIL_SLIDE_MS=400;   // v12.2: slide in/out over the sphere
let emailHideTimer=null;
let emailTimer=null, emailGen=0, emailCache={list:null, open:Object.create(null)};
/* v12.7.1 warm inbox: the last list is kept on the phone and shown the moment INBOX opens; a sync runs in the
   background (one at a time). Lists that arrive while the panel is closed are cached silently. */
const LS_INBOX="jarvis_inbox_v1", INBOX_CAP="inbox-cache", INBOX_APPV=String(self.JARVIS_BUILD||"");  // real app version from assets/build.js (was a frozen "12.7.1" capability label)
const INBOX_STALE_MS=10*60*1000;      // background sync on open/launch only when the saved list is older than this
const INBOX_FRESH_MS=60*1000;         // opening within a minute of a sync just shows the saved list
let emailPending=0, emailUserWait=false, emailView="", inboxPrefetchAt=0;
/* v12.10 several inboxes: swipe left/right on the panel or tap the tabs. Each account has its own saved list (localStorage) and its own
   relay snapshot; requests carry "account". The globals inboxSaved / emailCache.list / emailPending always describe the account on screen. */
const INBOX_ACCOUNTS=[{id:"default",label:"MAIN"},{id:"dspy",label:"DSPY"},{id:"godpack",label:"GODPACK",addr:"ceo@godpackgames.com"},{id:"cartamagica",label:"CARTA MAGICA",addr:"alex@cartamagica.com"}];
const LS_INBOX_ACCT="jarvis_inbox_acct";
function acctId(a){ a=String(a||"default").toLowerCase(); return INBOX_ACCOUNTS.some(x=>x.id===a)?a:"default"; }
function lsInboxKey(a){ return a==="default"?LS_INBOX:LS_INBOX+"_"+a; }
let inboxAcct=(()=>{ try{ return acctId(localStorage.getItem(LS_INBOX_ACCT)); }catch(e){ return "default"; } })();
const inboxState={};   // account -> {saved, pending}
function loadInboxCache(a){ a=a||inboxAcct; try{ const o=JSON.parse(localStorage.getItem(lsInboxKey(a))||"null"); if(o&&o.data&&Array.isArray(o.data.emails)) return o; }catch(e){} return null; }
let inboxSaved=loadInboxCache(); if(inboxSaved) emailCache.list=inboxSaved.data;
function saveInboxCache(data,a){
  a=a||inboxAcct;
  const as_of=Number(data&&data.as_of)||Math.floor(Date.now()/1000);
  const keep=Object.assign({},data); delete keep.cached; delete keep.refreshing; delete keep.unchanged;
  const saved={as_of,data:keep};
  if(a===inboxAcct){ inboxSaved=saved; emailCache.list=keep; } else { (inboxState[a]=inboxState[a]||{}).saved=saved; }
  try{ localStorage.setItem(lsInboxKey(a),JSON.stringify(saved)); }catch(e){}
  try{ paintInboxTabs(); }catch(e){}
}
function inboxAcctInfo(a){ return INBOX_ACCOUNTS.find(x=>x.id===(a||inboxAcct))||INBOX_ACCOUNTS[0]; }
function paintInboxTabs(){
  const bar=$("#ep-accts"); if(!bar) return;
  bar.querySelectorAll("[data-acct]").forEach(b=>{ const on=b.dataset.acct===inboxAcct; b.classList.toggle("on",on); b.setAttribute("aria-selected",on?"true":"false"); b.tabIndex=on?0:-1; });
  // v12.10 unread badge per inbox (from that inbox's saved list)
  bar.querySelectorAll("[data-acct]").forEach(b=>{ const a=b.dataset.acct; const sv=a===inboxAcct?inboxSaved:((inboxState[a]&&inboxState[a].saved)||loadInboxCache(a));
    const n=sv&&sv.data&&Array.isArray(sv.data.emails)?sv.data.emails.filter(m=>m&&m.unread).length:0;
    let bd=b.querySelector("b"); if(n){ if(!bd){ bd=document.createElement("b"); b.appendChild(bd); } bd.textContent=n>99?"99+":String(n); b.setAttribute("aria-label",b.firstChild.textContent+", "+n+" unread"); }
    else { if(bd) bd.remove(); b.removeAttribute("aria-label"); } });
  const dots=$("#ep-dots"); if(dots) dots.innerHTML=INBOX_ACCOUNTS.map(x=>`<i class="${x.id===inboxAcct?"on":""}"></i>`).join("");
  const k=$("#email-panel .ep-kicker"); if(k){ const i=inboxAcctInfo(); k.textContent=i.addr?i.addr.toUpperCase():"SECURE UPLINK"; }
  const on=bar.querySelector(".on"); if(on&&on.scrollIntoView) try{ on.scrollIntoView({block:"nearest",inline:"nearest"}); }catch(e){}
}
function switchInbox(a,dir){
  a=acctId(a); if(a===inboxAcct){ paintInboxTabs(); return; }
  inboxState[inboxAcct]={saved:inboxSaved,pending:emailPending};
  inboxAcct=a; try{ localStorage.setItem(LS_INBOX_ACCT,a); }catch(e){}
  const st=inboxState[a]||{};
  inboxSaved=st.saved||loadInboxCache(a); emailPending=st.pending||0;
  emailCache.list=inboxSaved?inboxSaved.data:null;
  emailGen++; clearTimeout(emailTimer); emailTimer=null; emailUserWait=false;
  paintInboxTabs();
  const p=$("#email-panel"); if(p){ p.classList.remove("ep-swipe-l","ep-swipe-r"); void p.offsetWidth; if(dir) p.classList.add(dir>0?"ep-swipe-l":"ep-swipe-r"); }
  vlog({ev:"inbox-switch",acct:a});
  if(emailPanelVisible()) openInbox();
}
function stepInbox(d){ const i=INBOX_ACCOUNTS.findIndex(x=>x.id===inboxAcct); const n=(i+d+INBOX_ACCOUNTS.length)%INBOX_ACCOUNTS.length; switchInbox(INBOX_ACCOUNTS[n].id,d); }
function inboxAgeMs(){ return inboxSaved? Math.max(0,Date.now()-inboxSaved.as_of*1000) : Infinity; }
function inboxAgo(){ const m=Math.round(inboxAgeMs()/60000); return m<1?"JUST NOW":m<60?m+" MIN AGO":Math.round(m/60)+" H AGO"; }
function emailPanelVisible(){ const p=$("#email-panel"); return !!p && !p.hidden && !p.classList.contains("ep-closing"); }
function inboxStatus(syncing){ if(emailView==="list" && emailCache.list) setEmailMode("ready","UPDATED "+inboxAgo()+(syncing?" · SYNCING…":"")); }

function isEmailJson(text){ return String(text||"").trim().startsWith(EMAIL_PREFIX); }
function parseEmailJson(text){
  const s=String(text||"").trim();
  if(!s.startsWith(EMAIL_PREFIX)) return null;
  try{
    const d=JSON.parse(s.slice(EMAIL_PREFIX.length).trim());
    return d && typeof d==="object" ? d : null;
  }catch(e){ return null; }
}
function looksLikeInboxCommand(t){
  const s=String(t||"").toLowerCase().replace(/[.!?]+$/g,"").trim();
  return /^(please\s+)?((check|read|show|open|get|list|fetch|display|bring up)\s+)?((my|the)\s+)?(e-?mails?|inbox|g-?mail|mail)$/.test(s)
    || /^(what's|what is|whats)\s+(in\s+)?((my|the)\s+)?(inbox|e-?mails?|mail)$/.test(s)
    || /^(any|new)\s+(e-?mails?|mail|messages)$/.test(s);
}
function escEmail(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function fmtWhen(s){
  if(!s) return "";
  const d=new Date(s);
  if(!isFinite(d.getTime())) return String(s);
  try{ return d.toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }
  catch(e){ return d.toISOString(); }
}
function emailReducedMotion(){ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }
function showEmailPanel(){
  const p=$("#email-panel"); if(!p) return;
  clearTimeout(emailHideTimer); emailHideTimer=null;
  p.classList.remove("ep-closing");
  document.body.classList.add("email-open");
  if(p.hidden){
    p.hidden=false;
    void p.offsetWidth;                       // commit the off-screen start state so the slide runs
    try{ p.scrollIntoView({block:"nearest"}); }catch(e){}
  }
  p.classList.add("ep-open");
}
function closeInbox(){
  emailGen++;
  clearTimeout(emailTimer); emailTimer=null;
  const p=$("#email-panel"); if(!p) return;
  if(p.hidden){ document.body.classList.remove("email-open"); return; }
  p.classList.remove("ep-open"); p.classList.add("ep-closing");
  const done=()=>{ clearTimeout(emailHideTimer); emailHideTimer=null;
    if(!p.classList.contains("ep-closing")) return;          // reopened meanwhile
    p.hidden=true; p.classList.remove("ep-closing"); document.body.classList.remove("email-open"); };
  if(!p._epEnd){ p._epEnd=e=>{ if(e.target===p && e.propertyName==="transform" && p._epDone) p._epDone(); }; p.addEventListener("transitionend",p._epEnd); }
  p._epDone=done;
  clearTimeout(emailHideTimer);
  emailHideTimer=setTimeout(done, emailReducedMotion()?140:EMAIL_SLIDE_MS+250);   // fallback if transitionend never fires
}
function setEmailMode(mode, status){
  const p=$("#email-panel"); if(!p) return;
  p.classList.remove("loading","ready","error","timeout");
  if(mode) p.classList.add(mode);
  const st=$("#ep-status");
  if(st){ st.textContent=status||""; st.hidden=!status; }
}
function setEmailLoading(msg){
  showEmailPanel(); emailView="loading";
  setEmailMode("loading", msg||"ESTABLISHING UPLINK…");
  const list=$("#ep-list"), det=$("#ep-detail"), back=$("#ep-back");
  if(list) list.hidden=true;
  if(det) det.hidden=true;
  if(back) back.hidden=true;
  const title=$("#ep-title"); if(title) title.textContent=inboxAcct==="default"?"INBOX":inboxAcctInfo().label;
}
function setEmailError(msg){
  emailGen++;
  clearTimeout(emailTimer); emailTimer=null;
  showEmailPanel();
  setEmailMode("error", (msg||"Uplink failed.").toUpperCase());
  const list=$("#ep-list"), det=$("#ep-detail");
  if(list) list.hidden=true;
  if(det) det.hidden=true;
}
function setEmailTimeout(){
  emailPending=0; emailUserWait=false;
  if(emailView==="list" && emailCache.list){ setEmailMode("ready","SHOWING SAVED INBOX · "+inboxAgo()+" · LIVE SYNC TIMED OUT"); return; }
  showEmailPanel();
  setEmailMode("timeout", "NO REPLY FROM THE UPLINK. TRY AGAIN, SIR.");
  const list=$("#ep-list"), det=$("#ep-detail");
  if(list) list.hidden=true;
  if(det) det.hidden=true;
}
function armEmailWait(){
  const gen=++emailGen;
  clearTimeout(emailTimer);
  emailTimer=setTimeout(()=>{ if(gen===emailGen) setEmailTimeout(); }, EMAIL_WAIT_MS);
}
async function postEmailRequest(payload,opt){
  const req=requestsTopic();
  const quiet=!!(opt&&opt.quiet);
  if(quiet){
    if(!req) return false;
    try{ const r=await fetch("https://ntfy.sh/"+encodeURIComponent(req),{method:"POST",body:JSON.stringify(payload)}); if(!r.ok) throw new Error("HTTP "+r.status); vlog({ev:"inbox-prefetch"}); return true; }
    catch(e){ emailPending=0; return false; }
  }
  if(!req){ toast("TAP SETUP TO CONNECT"); holdStatus("TAP SETUP TO CONNECT",true,5000); setEmailError("TAP SETUP TO CONNECT"); return false; }
  noteSentRequest();
  // v12.6.1: no chime before replies (owner request)
  holdStatus("UPLINK TO INBOX",false,3000);
  try{
    const r=await fetch("https://ntfy.sh/"+encodeURIComponent(req),{method:"POST",body:JSON.stringify(payload)});
    if(!r.ok) throw new Error("HTTP "+r.status);
    log("Inbox request sent");
    return true;
  }catch(e){
    if(payload&&payload.type==="email_list") emailPending=0;
    if(payload&&payload.type==="email_list" && emailView==="list" && emailCache.list){ setEmailMode("ready","SHOWING SAVED INBOX · "+inboxAgo()+" · UPLINK ERROR"); return false; }
    toast("UPLINK ERROR"); holdStatus("UPLINK ERROR",true,5000); speakLine("error");
    setEmailError("Uplink error.");
    return false;
  }
}
function openInbox(force){
  if(typeof closeTodo==="function") closeTodo();
  try{ closeChat(); }catch(e){}
  force=force===true;
  if(emailCache.list){
    showEmailPanel(); renderEmailList(emailCache.list);
    if(!force && inboxAgeMs()<INBOX_FRESH_MS){ inboxStatus(false); return Promise.resolve(true); }
    inboxStatus(true);
  } else { setEmailLoading(); emailView="loading"; }
  return requestInboxList({user:true, force});
}
function requestInboxList(o){
  o=o||{};
  if(o.user){ emailUserWait=true; armEmailWait(); }
  if(emailPending && Date.now()-emailPending<EMAIL_WAIT_MS){ vlog({ev:"inbox-dedupe"}); return Promise.resolve(true); }   // one in flight at a time
  emailPending=Date.now();
  const p={type:"email_list",account:inboxAcct,limit:15,cap:INBOX_CAP,v:INBOX_APPV};
  if(o.force) p.refresh=1;
  if(inboxSaved&&inboxSaved.as_of&&emailCache.list) p.have=inboxSaved.as_of;
  return postEmailRequest(p,{quiet:!o.user});
}
function prefetchInbox(){
  if(document.visibilityState==="hidden" || !requestsTopic()) return;
  if(Date.now()-inboxPrefetchAt<5*60*1000) return;
  // Quiet sync of every inbox (not just MAIN) so a tab swipe can show a saved list at once.
  // Does not touch emailPending, so it cannot block a user-opened inbox.
  let n=0;
  INBOX_ACCOUNTS.forEach((x,i)=>{
    const sv=x.id===inboxAcct?inboxSaved:((inboxState[x.id]&&inboxState[x.id].saved)||loadInboxCache(x.id));
    const age=sv&&sv.as_of?(Date.now()-Number(sv.as_of)*1000):Infinity;
    if(sv && age<INBOX_STALE_MS) return;
    setTimeout(()=>{
      if(x.id===inboxAcct){ requestInboxList({}); return; }  // sets emailPending so a tap during prefetch is not a second request
      const p={type:"email_list",account:x.id,limit:15,cap:INBOX_CAP,v:INBOX_APPV};
      if(sv&&sv.as_of) p.have=sv.as_of;
      postEmailRequest(p,{quiet:true});
    }, i*150);
    n++;
  });
  if(n) inboxPrefetchAt=Date.now();
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") setTimeout(prefetchInbox,1500); });
setTimeout(prefetchInbox,4000);
function openEmail(id){
  if(!id) return;
  if(emailCache.open[id]){ renderEmailDetail(emailCache.open[id]); return; }
  setEmailLoading("RETRIEVING MESSAGE…");
  armEmailWait();
  return postEmailRequest({type:"email_open",id:String(id),account:inboxAcct});
}
function handleEmailList(data){
  const acct=acctId(data&&data.account);
  if(acct!==inboxAcct){   // a list for another inbox (background or after a swipe): cache it for that account only
    const st=inboxState[acct]=inboxState[acct]||{saved:loadInboxCache(acct)};
    if(data.ok!==false && !(data.cached&&data.refreshing)) st.pending=0;
    if(data.ok!==false && !data.unchanged && Array.isArray(data.emails) && !(data.cached && st.saved && Number(data.as_of)<st.saved.as_of)) saveInboxCache(data,acct);
    vlog({ev:"inbox-other",acct}); return;
  }
  const wanted=emailUserWait, visible=emailPanelVisible();
  const done=()=>{ emailGen++; clearTimeout(emailTimer); emailTimer=null; emailUserWait=false; };
  if(data.ok===false){
    emailPending=0;
    if(!wanted) return;
    done();
    if(emailCache.list){ showEmailPanel(); renderEmailList(emailCache.list); setEmailMode("ready","SHOWING SAVED INBOX · "+inboxAgo()+" · LIVE SYNC FAILED"); return; }
    setEmailError(data.error||"The uplink could not retrieve that, sir."); return;
  }
  const refreshing=!!(data.cached && data.refreshing);
  if(!refreshing) emailPending=0;
  if(data.unchanged){
    if(inboxSaved && Number(data.as_of)>inboxSaved.as_of){ inboxSaved.as_of=Number(data.as_of); try{ localStorage.setItem(lsInboxKey(inboxAcct),JSON.stringify(inboxSaved)); }catch(e){} }
  } else {
    if(data.cached && inboxSaved && Number(data.as_of)<inboxSaved.as_of) {}           // older than what we hold
    else saveInboxCache(data);
  }
  if(!wanted && !(visible && emailView==="list")) return;                             // background sync: cache only
  if(!refreshing) done();
  if(emailView==="detail" && !wanted) return;
  showEmailPanel(); renderEmailList(emailCache.list||data); inboxStatus(refreshing);
}
function handleEmailPayload(data){
  if(data && data.type==="email_list" && !data.email) return handleEmailList(data);
  emailGen++;
  clearTimeout(emailTimer); emailTimer=null;
  showEmailPanel();
  if(!data || data.ok===false){
    setEmailError((data&&data.error)||"The uplink could not retrieve that, sir.");
    return;
  }
  if(data.type==="email_open" || data.email){
    const mail=data.email||data;
    if(mail&&mail.id) emailCache.open[mail.id]=mail;
    renderEmailDetail(mail);
    return;
  }
  if(data.type==="email_list" || Array.isArray(data.emails)){
    emailCache.list=data;
    renderEmailList(data);
    return;
  }
  setEmailError("Unrecognized inbox reply.");
}
function renderEmailList(data){
  const emails=Array.isArray(data&&data.emails)?data.emails:[];
  const list=$("#ep-list"), det=$("#ep-detail"), back=$("#ep-back"), title=$("#ep-title");
  emailView="list";
  setEmailMode("ready", emails.length?"":"INBOX EMPTY");
  if(title) title.textContent=(inboxAcct==="default"?"INBOX":inboxAcctInfo().label)+(emails.length?"  ·  "+emails.length:"");
  if(back) back.hidden=true;
  if(det) det.hidden=true;
  if(!list) return;
  list.hidden=false;
  list.innerHTML=emails.map(m=>{
    const unread=m&&m.unread? " unread":" read";
    return `<li class="${unread.trim()}" data-id="${escEmail(m.id||"")}">`
      +`<span class="dot"${m&&m.unread?' title="Unread"':""}></span>`
      +`<span class="from">${escEmail(m.from||m.from_email||"Unknown")}</span>`
      +`<span class="when">${escEmail(fmtWhen(m.date||m.time||""))}</span>`
      +`<span class="subj">${escEmail(m.subject||"(no subject)")}</span>`
      +`<span class="snip">${escEmail(m.snippet||m.preview||"")}</span>`
      +`</li>`;
  }).join("");
}
function showEmailList(){
  if(emailCache.list) renderEmailList(emailCache.list);
  else openInbox();
}
function renderEmailDetail(mail){
  if(!mail) return;
  showEmailPanel();
  emailView="detail";
  setEmailMode("ready","");
  const list=$("#ep-list"), det=$("#ep-detail"), back=$("#ep-back"), title=$("#ep-title");
  if(list) list.hidden=true;
  if(back) back.hidden=false;
  if(title) title.textContent="MESSAGE";
  if(!det) return;
  det.hidden=false;
  const who=mail.from||mail.from_email||"Unknown";
  const addr=mail.from_email && mail.from && mail.from_email!==mail.from ? "  ·  "+mail.from_email : "";
  const to=mail.to? "To "+mail.to : "";
  det.innerHTML=`<div class="d-from">${escEmail(who)}${escEmail(addr)}</div>`
    +`<div class="d-meta">${escEmail([to, fmtWhen(mail.date||mail.time||"")].filter(Boolean).join("  ·  "))}</div>`
    +`<div class="d-subj">${escEmail(mail.subject||"(no subject)")}</div>`
    +`<div class="d-body">${escEmail(mail.body||mail.body_text||mail.snippet||"")}</div>`;
}

async function onReply(text,id,knownUrl){
  lastReply={text,id,ts:Date.now()};
  if(isEmailJson(text)){
    const data=parseEmailJson(text);
    vlog({ev:"email-json",type:data&&data.type,ok:data&&data.ok});
    log(data&&data.type==="email_list" ? ("Inbox: "+((data.emails||[]).length)+" messages") :
        data&&data.type==="email_open" ? "Opened message" : "Inbox update");
    if(data) handleEmailPayload(data);
    else { showEmailPanel(); setEmailError("Malformed inbox reply."); }
    return;
  }

  // v12.6: canned relay acks are no longer used. The app already played thinkingChime()
  // when the request was sent; ignore any leftover ack text/audio if one still arrives.
  if(isAckText(text)){
    vlog({ev:"drop-ack",reason:"unused",text});
    return;
  }
  log("JARVIS: "+text);
  histAdd("jarvis",text,id);
  holdStatus("NEW REPLY",false,8000);
  realReplyGen=requestGen;
  if(pendingAck && !pendingAck.started){ pendingAck.cancelled=true; vlog({ev:"drop-ack",reason:"real-reply"}); pendingAck=null; }
  ackReq.replied=true;
  if(openerPlayed.has(text)){ openerPlayed.delete(text); return enqueueVoice(token=>playAfterOpener(text, token)); }
  const arrived=Date.now();
  const primed=knownUrl||takeRecentAudio(text);
  const urlP=primed?Promise.resolve(primed):waitForAudio(text, AUDIO_WAIT_MS);
  return enqueueVoice(async token=>{
    if(token!==voiceSeq || !canSpeak() || !text) return;
    let url=await urlP;
    if(!url) url=takeRecentAudio(text);
    if(token!==voiceSeq || !canSpeak()) return;
    if(ttsAlready(text)){ vlog({ev:"drop-mp3",reason:"tts-already-before-play",text}); return; }
    if(url){ if(await playWithParts(text, url, token)) return; }
    if(token!==voiceSeq || !canSpeak()) return;
    url=takeRecentAudio(text);
    if(url){ if(await playWithParts(text, url, token)) return; }
    const left=AUDIO_WAIT_MS-(Date.now()-arrived);
    if(left>50){
      url=await waitForAudio(text, left);
      if(token!==voiceSeq || !canSpeak()) return;
      if(url && !ttsAlready(text)){ if(await playWithParts(text, url, token)) return; }
    }
    if(token!==voiceSeq || !canSpeak() || ttsAlready(text)) return;
    // v12.6: no phone speechSynthesis fallback (generic device voice). The reply is already on screen.
    vlog({ev:"reply-silent",reason:"no-mp3",text});
    holdStatus("REPLY ON SCREEN",false,6000);
  });
}



/* ---------- unlock audio + speech on the first tap (Android/iOS autoplay rules) ---------- */
let unlocked=false;
function unlockAudio(){ if(unlocked) return; unlocked=true;
  try{ const ac=audioCtx(); if(ac){ const b=ac.createBuffer(1,1,22050), s=ac.createBufferSource(); s.buffer=b; s.connect(ac.destination); s.start(0); } }catch(e){}
  try{ Object.values(audioCache).forEach(a=>{ hookMedia(a); a.muted=true; const p=a.play(); if(p) p.then(()=>{a.pause(); a.currentTime=0; a.muted=false;}).catch(()=>{a.muted=false;}); else a.muted=false; }); }catch(e){}
  try{ if("speechSynthesis" in window){ speechSynthesis.resume(); const u=new SpeechSynthesisUtterance(" "); u.volume=0; speechSynthesis.speak(u); } }catch(e){}
  const vu=$("#voice-unlock"); if(vu) vu.hidden=true; }

function showVoiceUnlock(){
  const vu=$("#voice-unlock"); if(!vu) return;
  const need=matchMedia("(pointer:coarse)").matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  vu.hidden=!(need&&!unlocked);
}

["pointerdown","touchend","keydown"].forEach(ev=>addEventListener(ev,()=>{ unlockAudio(); acquireWakeLock(); },{capture:true,passive:true}));
const vuBtn=$("#voice-unlock"); if(vuBtn) vuBtn.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();unlockAudio(); acquireWakeLock();});
showVoiceUnlock();

/* ---------- TTS voice ---------- */
let ttsVoice=null;
function voiceName(v){ return String(v&&v.name||""); }
function voiceLang(v){ return String(v&&v.lang||"").toLowerCase().replace("_","-"); }
function isFemaleVoice(v){ return /female|woman|zira|samantha|karen|moira|tessa|fiona|veena|susan|hazel|kate|serena|salli|ivy|joanna|kendra|kimberly|amy|emma|linda|heather|mary|zira/i.test(voiceName(v)); }
function isMaleVoice(v){
  if(!v || isFemaleVoice(v)) return false;
  return /male|daniel|george|arthur|oliver|david|ryan|rishi|james|thomas|fred|gordon|mark|steve|brian|guy|matthew|justin|joey|geraint|wayne/i.test(voiceName(v));
}
function pickVoice(){
  const vs=speechSynthesis.getVoices(); if(!vs.length) return;
  const prefer=[].concat(C.TTS_VOICE_PREFERENCE||[],["Google UK English Male","Microsoft George","Microsoft Arthur","Microsoft Ryan","Daniel","George","Arthur","Oliver","David","James","Thomas"]);
  let found=null;
  for(const pref of prefer){
    const p=String(pref).toLowerCase();
    const hit=vs.find(v=>voiceName(v).toLowerCase().includes(p) && !isFemaleVoice(v));
    if(hit){ found=hit; break; }
  }
  if(!found) found=vs.find(v=>isMaleVoice(v) && /^en-gb/i.test(voiceLang(v)));
  if(!found) found=vs.find(v=>isMaleVoice(v) && /^en/i.test(voiceLang(v)));
  if(!found) found=vs.find(v=>isMaleVoice(v));
  if(!found) found=vs.find(v=>/^en/i.test(voiceLang(v)) && !isFemaleVoice(v));
  if(found && isFemaleVoice(found)) found=null;
  ttsVoice=found||null;
  const g=$("#gi-tts");
  if(g) g.textContent = ttsVoice?("TTS: "+ttsVoice.name.replace(/Microsoft |Google | Online.*|\(.*\)/g,"")).slice(0,16).toUpperCase():"NO MALE TTS";
}
if("speechSynthesis" in window){ pickVoice(); speechSynthesis.onvoiceschanged=pickVoice; } else { const g=$("#gi-tts"); if(g) g.textContent="NO TTS"; }

/* ---------- state helpers ---------- */
let busyReq=false, listening=false, mode="idle";
/* v12.9 conversation mode + Android native listening (see "conversation mode" block below) */
let convo=false, nativeLis=false, convoMuted=false;
function setBusy(){ try{ if(convo&&speaking&&!helmVoiceLoop.raf) helmVoiceLoop.raf=requestAnimationFrame(helmVoiceLoop); }catch(e){} const lis=(listening&&mode==="command")||mode==="handoff"||nativeLis; document.body.classList.toggle("convo",convo); document.body.classList.toggle("convo-muted",convo&&convoMuted); const b=speaking||busyReq||lis; document.body.classList.toggle("busy",b); document.body.classList.toggle("listening",lis);
  $("#core-sub").textContent = lis?"LISTENING": speaking?"SPEAKING": busyReq?"PROCESSING": convo?(convoMuted?"MIC MUTED":"CONVERSATION"):"STANDING BY"; }
function toast(t,ms=3200){ const el=$("#toast"); el.textContent=t; el.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove("show"),ms); }
function setStatus(t,warn){ $("#status-txt").textContent=t; $(".status-pill").classList.toggle("warn",!!warn); }
/* uplink status set after bindSetup */

/* ---------- clock / date / calendar ---------- */
const MONTHS=["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
function parts(d){ const o={}; new Intl.DateTimeFormat("en-GB",{timeZone:C.TIMEZONE,year:"numeric",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,weekday:"long"}).formatToParts(d).forEach(p=>o[p.type]=p.value); return o; }
let lastDay=null; const t0=Date.now();
function tick(){ const p=parts(new Date()); let h=+p.hour%24, suf="";
  if(!C.USE_24H){ suf=h>=12?" PM":" AM"; h=h%12||12; }
  $("#clock-main").textContent=String(h).padStart(2,"0")+":"+p.minute+":"+p.second+suf;
  const up=Math.floor((Date.now()-t0)/1000); $("#gi-up").textContent=[up/3600|0,(up/60|0)%60,up%60].map(n=>String(n).padStart(2,"0")).join(":");
  const key=p.year+"-"+p.month+"-"+p.day; if(key!==lastDay){ lastDay=key; drawDate(+p.year,+p.month,+p.day,p.weekday); } }
function drawDate(y,m,d,wd){
  $("#d-num").textContent=d; $("#d-dow").textContent=wd.toUpperCase(); $("#d-mon").textContent=MONTHS[m-1].slice(0,3); $("#d-yr").textContent=y;
  $("#clock-date").textContent=`${wd.toUpperCase()}, ${d} ${MONTHS[m-1].slice(0,3)} ${y}`;
  $("#mc-head").textContent=MONTHS[m-1]+" "+y;
  const first=(new Date(Date.UTC(y,m-1,1)).getUTCDay()+6)%7, dim=new Date(Date.UTC(y,m,0)).getUTCDate(), prev=new Date(Date.UTC(y,m-1,0)).getUTCDate();
  let h=["M","T","W","T","F","S","S"].map(x=>`<div class="dh">${x}</div>`).join("");
  for(let i=0;i<42;i++){ const n=i-first+1; let c="d",t; if(n<1){t=prev+n;c+=" o";} else if(n>dim){t=n-dim;c+=" o";} else {t=n; if(n===d)c+=" t"; else if(i%7>=5)c+=" we";}
    h+=`<div class="${c}">${t}</div>`; if(i%7===6 && n>=dim) break; }
  $("#mc-grid").innerHTML=h; }
tick(); setInterval(tick,1000);

/* ---------- system stats (illustrative + what the browser can see) ---------- */
const stats=[["CPU",45],["RAM",62],["GPU",38],["NET",78],["DISK",54],["PWR",91]];
function drawStats(){
  if(!STATIC) stats.forEach(s=>{ s[1]=Math.max(8,Math.min(98,s[1]+(Math.random()*10-5)|0)); });
  if(navigator.getBattery && !drawStats.b){ drawStats.b=1; navigator.getBattery().then(b=>drawStats.bat=b).catch(()=>{}); }
  if(drawStats.bat) stats[5][1]=Math.round(drawStats.bat.level*100);
  if(!navigator.onLine) stats[3][1]=0;
  $("#stats").innerHTML=stats.map(([k,v])=>`<li><span>${k}</span><div class="bar"><i style="width:${v}%"></i></div><b>${v}%</b></li>`).join("");
  const cpu=stats[0][1]; $("#g-cpu-v").setAttribute("stroke-dashoffset",(377*(1-cpu/100)).toFixed(1)); $("#g-cpu-t").textContent=cpu+"%";
  $("#gi-net").textContent=navigator.onLine?"ONLINE":"OFFLINE"; $("#wifi-t").textContent=navigator.onLine?"ONLINE":"OFFLINE"; }
drawStats(); if(!STATIC) setInterval(drawStats,3000);

/* ---------- ring decorations (outer HUD ticks only; core is the gold sphere) ---------- */
const NS="http://www.w3.org/2000/svg";
(function(){ const dots=$("#dots"); if(!dots) return;
  [[-60,322],[-5,298],[38,322],[178,285],[-118,262]].forEach(([deg,r])=>{ const a=deg*Math.PI/180;
    const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",350+r*Math.cos(a)); c.setAttribute("cy",350+r*Math.sin(a)); c.setAttribute("r",9); c.setAttribute("fill","#9ae9ff"); dots.appendChild(c); }); })();

/* ---------- animation loop ---------- */
let level=0, micLevel=0;
function bars(cv,n,amp,t){ const x=cv.getContext("2d"),W=cv.width,H=cv.height; x.clearRect(0,0,W,H); x.fillStyle="#35c8ff"; x.shadowColor="#35c8ff"; x.shadowBlur=6;
  const bw=W/n; for(let i=0;i<n;i++){ const e=Math.sin(Math.PI*(i+.5)/n); const v=(.2+.8*Math.abs(Math.sin(i*.7+t*3.1)*Math.cos(i*.23-t*1.7)))*e*amp;
    const h=Math.max(1.5,v*H); x.globalAlpha=.4+.6*e; x.fillRect(i*bw+.5,(H-h)/2,bw-1.5,h); } x.globalAlpha=1; }
function topwave(cv,amp,t){ const x=cv.getContext("2d"),W=cv.width,H=cv.height; x.clearRect(0,0,W,H);
  const g=x.createLinearGradient(0,0,W,0); g.addColorStop(0,"rgba(53,200,255,0)"); g.addColorStop(.5,"#9ff0ff"); g.addColorStop(1,"rgba(53,200,255,0)");
  x.fillStyle=g; x.shadowColor="#35c8ff"; x.shadowBlur=10; const n=90,bw=W/n;
  for(let i=0;i<n;i++){ const c=1-Math.abs(i-n/2)/(n/2); const v=(.08+.92*Math.pow(c,2.2))*(.35+.65*Math.abs(Math.sin(i*.9+t*4)*Math.cos(i*.31-t*2.3)))*amp;
    const h=Math.max(1.5,v*H); x.fillRect(i*bw,(H-h)/2,bw-1.2,h); }
  x.fillRect(0,H/2-.5,W,1); }
function frame(ts){ const t=STATIC?1.3:ts/1000; const target=(speaking||busyReq||(listening&&mode==="command")||mode==="handoff")?1:.4; level+=(target-level)*.05;
  const act=Math.max(level,micLevel);
  const tw=$("#topwave"), mw=$("#micwave");
  if(tw) topwave(tw,.5+.5*act,t); if(mw) bars(mw,40,.4+.6*act,t);
  if(!STATIC) requestAnimationFrame(frame); }
requestAnimationFrame(frame);

/* ---------- weather (Open-Meteo, no key) ---------- */
const WCODE={0:["CLEAR","sun"],1:["MAINLY CLEAR","sun"],2:["PARTLY CLOUDY","pcloud"],3:["OVERCAST","cloud"],45:["FOG","fog"],48:["FOG","fog"],51:["DRIZZLE","rain"],53:["DRIZZLE","rain"],55:["DRIZZLE","rain"],61:["LIGHT RAIN","rain"],63:["RAIN","rain"],65:["HEAVY RAIN","rain"],71:["SNOW","snow"],73:["SNOW","snow"],75:["SNOW","snow"],80:["SHOWERS","rain"],81:["SHOWERS","rain"],82:["STORMY SHOWERS","rain"],95:["THUNDERSTORM","storm"],96:["THUNDERSTORM","storm"],99:["THUNDERSTORM","storm"]};
const ICONS={sun:'<circle cx="32" cy="24" r="9"/><path d="M32 7v5M32 36v5M15 24h5M44 24h5M20 12l3 3M41 33l3 3M20 36l3-3M41 15l3-3"/>',
 pcloud:'<circle cx="24" cy="16" r="7"/><path d="M20 40h28a8 8 0 0 0 0-16 11 11 0 0 0-21-2 8 8 0 0 0-7 18z"/>',
 cloud:'<path d="M14 38h34a9 9 0 0 0 0-18 13 13 0 0 0-25-3 10 10 0 0 0-9 21z"/>',
 rain:'<path d="M14 30h34a9 9 0 0 0 0-18 13 13 0 0 0-25-3 10 10 0 0 0-9 21z"/><path d="M22 36l-3 6M32 36l-3 6M42 36l-3 6"/>',
 snow:'<path d="M14 30h34a9 9 0 0 0 0-18 13 13 0 0 0-25-3 10 10 0 0 0-9 21z"/><path d="M22 38h.1M32 42h.1M42 38h.1"/>',
 fog:'<path d="M10 18h44M14 26h36M10 34h44M18 42h28"/>',
 storm:'<path d="M14 30h34a9 9 0 0 0 0-18 13 13 0 0 0-25-3 10 10 0 0 0-9 21z"/><path d="M33 30l-6 9h7l-5 8"/>'};
function art(kind,night){ // big illustrated weather art, like the cloud+moon in the reference
  const orb = night? '<circle class="mn" cx="128" cy="38" r="24"/><circle cx="140" cy="30" r="20" fill="#06182f" opacity=".55"/>' : '<circle class="sn" cx="128" cy="38" r="22"/>';
  const cloud='<g filter="url(#wb)"><ellipse class="cl2" cx="150" cy="78" rx="44" ry="22"/><ellipse class="cl" cx="100" cy="76" rx="52" ry="26"/><ellipse class="cl" cx="128" cy="62" rx="30" ry="24"/><ellipse class="cl" cx="72" cy="84" rx="30" ry="16"/></g>';
  const rain=(kind==="rain"||kind==="storm")?'<path class="rn" d="M80 104l-5 12M100 104l-5 12M120 104l-5 12M140 104l-5 12"/>':"";
  const defs='<defs><filter id="wb"><feGaussianBlur stdDeviation="1.6"/></filter><filter id="wg"><feGaussianBlur stdDeviation="5"/></filter></defs>';
  const halo=`<circle cx="128" cy="38" r="30" fill="${night?"#bfe3ff":"#ffd36a"}" opacity=".35" filter="url(#wg)"/>`;
  return defs+halo+orb+(kind==="sun"?"":cloud)+rain; }
const LOC_KEY="jarvis_loc";
// v12.6: never prompt for location. Default weather/time place is Athens if nothing is cached.
const DEFAULT_LOC={lat:37.984,lon:23.728,tz:"Europe/Athens",name:"ATHENS, GR",auto:true,fallback:true};
function savedLoc(){ try{ return JSON.parse(localStorage.getItem(LOC_KEY)||"null"); }catch(e){ return null; } }
function saveLoc(l){ localStorage.setItem(LOC_KEY,JSON.stringify(l)); }
async function placeName(lat,lon){ try{ const j=await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)).json();
    const city=j.city||j.locality||j.principalSubdivision||""; return (city+(j.countryCode?", "+j.countryCode:"")).toUpperCase()||"MY LOCATION"; }catch(e){ return "MY LOCATION"; } }
async function geoAllowed(){ try{ const st=await navigator.permissions.query({name:"geolocation"}); return st&&st.state==="granted"; }catch(e){ return false; } }
function gps(){ return new Promise(res=>{ if(!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(p=>res({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3)}),()=>res(null),{timeout:10000,maximumAge:3600000}); }); }
async function locate(){
  let l=savedLoc(); if(l&&l.lat!=null&&!l.auto) return l;   // a city the user typed in SETUP
  if(C.WEATHER&&C.WEATHER.lat!=null) return C.WEATHER;
  // Only call the geolocation API when the permission is already "granted". Never prompt on boot, SETUP, or anywhere else.
  if(await geoAllowed()){ const g=await gps(); if(g){ l={...g,name:await placeName(g.lat,g.lon),auto:true}; saveLoc(l); return l; } }
  if(l&&l.lat!=null) return l;   // last known cached position
  return DEFAULT_LOC;
}
async function weather(){ const W=await locate();
  if(!W){ $("#w-loc").textContent="NO LOCATION"; $("#w-d").textContent="TAP SETUP TO SET A CITY"; $("#w-art").innerHTML=art("cloud",true); return; }
  $("#w-loc").textContent=W.name||"LOCAL";
  try{ const u=`https://api.open-meteo.com/v1/forecast?latitude=${W.lat}&longitude=${W.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(W.tz||"auto")}&forecast_days=6`;
    const j=await (await fetch(u)).json(); const c=j.current,d=j.daily; const [desc,ic]=WCODE[c.weather_code]||["--","cloud"];
    $("#w-t").textContent=Math.round(c.temperature_2m); $("#w-d").textContent=desc; $("#w-art").innerHTML=art(ic,!c.is_day);
    $("#w-hl").textContent=`H ${Math.round(d.temperature_2m_max[0])}° / L ${Math.round(d.temperature_2m_min[0])}°`;
    $("#w-wind").textContent=Math.round(c.wind_speed_10m)+" KM/H"; $("#w-hum").textContent=c.relative_humidity_2m+"%"; $("#w-feel").textContent=Math.round(c.apparent_temperature)+"°C";
    $("#w-fc").innerHTML=d.time.slice(1,6).map((t,i)=>{ const k=(WCODE[d.weather_code[i+1]]||["","cloud"])[1]; const dn=new Date(t+"T12:00:00Z").toLocaleDateString("en-GB",{weekday:"short",timeZone:"UTC"}).toUpperCase();
      return `<div>${dn}<svg viewBox="0 0 64 48">${ICONS[k]}</svg><b>${Math.round(d.temperature_2m_max[i+1])}°</b></div>`; }).join("");
  }catch(e){ $("#w-d").textContent="WEATHER OFFLINE"; $("#w-art").innerHTML=art("cloud",true); } }
async function setupLocationFromField(city){
  city=(city||"").trim();
  if(!city){ localStorage.removeItem(LOC_KEY); toast("USING SAVED OR ATHENS DEFAULT"); return weather(); }
  try{ const j=await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(city)}`)).json();
    const r=j.results&&j.results[0]; if(!r){ toast("CITY NOT FOUND"); return; }
    saveLoc({name:(r.name+(r.country_code?", "+r.country_code:"")).toUpperCase(),lat:r.latitude,lon:r.longitude,tz:r.timezone}); toast("WEATHER: "+r.name.toUpperCase()); weather();
  }catch(e){ toast("WEATHER OFFLINE"); } }
async function setupLocation(){ openSetup(); }
weather(); setInterval(()=>weather(),15*60*1000);

/* ---------- v12.3 to-do pop-up: tap a "Waiting on you" / "Fleet today" item ---------- */
let todoData={wait:[],fleet:[],example:false,updated:""}, todoCur=null, todoHideTimer=null, todoAskLock=0;
const TODO_SLIDE_MS=400;
function todoField(i,keys){ for(const k of keys){ const v=i&&i[k]; if(v!=null && String(v).trim()) return String(v).trim(); } return ""; }
function todoWhen(s){ if(!s) return ""; const d=new Date(s); return isFinite(d.getTime())?fmtWhen(s):String(s); }
function todoSafeUrl(u){ if(!String(u||"").trim()) return ""; try{ const x=new URL(String(u||""),location.href); return /^https?:$/.test(x.protocol)?x.href:""; }catch(e){ return ""; } }
function renderTodo(kind,item){
  const ex=!!todoData.example, fleet=kind==="fleet";
  const title=fleet?todoField(item,["bot"]):todoField(item,["title"]);
  const text=fleet?todoField(item,["summary","detail","details","text","body","note"]):todoField(item,["detail","details","text","body","summary","note","description"]);
  const pri=fleet?"":todoField(item,["priority"]), tag=todoField(item,["tag"]), status=fleet?todoField(item,["status"]):"";
  const source=todoField(item,["source","from","bot","owner"]), when=todoWhen(todoField(item,["date","due","when","ts","created","updated"]));
  const url=todoSafeUrl(todoField(item,["url","link"]));
  const chips=[pri?`<span class="tp-chip ${escEmail(pri.toLowerCase())}">${escEmail(pri.toUpperCase())} PRIORITY</span>`:"",
               tag?`<span class="tp-chip">${escEmail(tag.toUpperCase())}</span>`:"",
               status?`<span class="tp-chip">${escEmail(status.toUpperCase())}</span>`:"",
               ex?`<span class="tp-chip ex">EXAMPLE DATA</span>`:""].join("");
  const meta=[[fleet?"":"SOURCE",fleet?"":source],["DATE",when],["BOARD UPDATED",todoData.updated?todoWhen(todoData.updated):""]]
    .filter(r=>r[0]&&r[1]).map(r=>`<dt>${r[0]}</dt><dd>${escEmail(r[1])}</dd>`).join("");
  $("#tp-kicker").textContent=fleet?"FLEET REPORT":"ACTION ITEM";
  $("#tp-title").textContent=fleet?"FLEET TODAY":"WAITING ON YOU";
  $("#tp-body").innerHTML=(chips?`<div class="tp-chips">${chips}</div>`:"")
    +`<div class="tp-title">${escEmail(title||"(untitled)")}</div>`
    +(text?`<div class="tp-text">${escEmail(text)}</div>`:"")
    +(meta?`<dl class="tp-meta">${meta}</dl>`:"")
    +(url?`<div class="tp-note"><a href="${escEmail(url)}" target="_blank" rel="noopener" style="color:inherit">OPEN SOURCE LINK</a></div>`:"")
    +(ex?`<div class="tp-note">This is placeholder data on the board, so there is nothing real to ask JARVIS about yet.</div>`:"");
  const ask=$("#tp-ask"); if(ask){ ask.disabled=ex||!title; ask.textContent="ASK JARVIS ABOUT THIS"; }
  const st=$("#tp-status"); if(st) st.textContent="";
}
function todoAskText(kind,item){
  if(kind==="fleet"){
    const bot=todoField(item,["bot"]), sum=todoField(item,["summary","detail","text"]);
    return `Give me the latest from ${bot||"that bot"} on this: ${sum}`.trim();
  }
  const title=todoField(item,["title"]), text=todoField(item,["detail","details","text","body","summary","note","description"]), tag=todoField(item,["tag"]);
  return (`Tell me about this item waiting on me${tag?` (${tag})`:""}: ${title}`+(text&&text!==title?`. ${text}`:"")).trim();
}
function todoReducedMotion(){ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } }
function openTodo(kind,idx){
  const list=kind==="fleet"?todoData.fleet:todoData.wait, item=list[idx]; if(!item) return false;
  const p=$("#todo-panel"); if(!p) return false;
  if(typeof closeInbox==="function"){ const ep=$("#email-panel"); if(ep&&!ep.hidden) closeInbox(); }
  try{ closeChat(); }catch(e){}
  todoCur={kind,idx,item};
  document.querySelectorAll("#wait-list li.tp-active,#fleet-list li.tp-active").forEach(li=>li.classList.remove("tp-active"));
  const li=document.querySelector(`#${kind==="fleet"?"fleet":"wait"}-list li[data-i="${idx}"]`); if(li) li.classList.add("tp-active");
  renderTodo(kind,item);
  clearTimeout(todoHideTimer); todoHideTimer=null;
  p.classList.remove("tp-closing"); document.body.classList.add("todo-open");
  const st=$("#stage"); if(st&&st.scrollTop>0){ try{ st.scrollTo({top:0,behavior:todoReducedMotion()?"auto":"smooth"}); }catch(e){ st.scrollTop=0; } }   // keep the sphere in view
  if(p.hidden){ p.hidden=false; void p.offsetWidth; }
  p.classList.add("tp-open");
  setTimeout(()=>{ const c=$("#tp-close"); if(c&&!p.hidden) try{ c.focus({preventScroll:true}); }catch(e){} }, 60);
  vlog({ev:"todo-open",kind,idx});
  return true;
}
function closeTodo(){
  const p=$("#todo-panel"); if(!p) return;
  document.querySelectorAll("#wait-list li.tp-active,#fleet-list li.tp-active").forEach(li=>li.classList.remove("tp-active"));
  if(p.hidden){ document.body.classList.remove("todo-open"); return; }
  p.classList.remove("tp-open"); p.classList.add("tp-closing");
  const done=()=>{ clearTimeout(todoHideTimer); todoHideTimer=null;
    if(!p.classList.contains("tp-closing")) return;
    p.hidden=true; p.classList.remove("tp-closing"); document.body.classList.remove("todo-open"); todoCur=null; };
  if(!p._tpEnd){ p._tpEnd=e=>{ if(e.target===p && e.propertyName==="transform" && p._tpDone) p._tpDone(); }; p.addEventListener("transitionend",p._tpEnd); }
  p._tpDone=done; clearTimeout(todoHideTimer);
  todoHideTimer=setTimeout(done, todoReducedMotion()?140:TODO_SLIDE_MS+250);
}
async function askTodo(){
  if(!todoCur || todoData.example) return;
  if(Date.now()-todoAskLock<4000) return; todoAskLock=Date.now();
  const ask=$("#tp-ask"), st=$("#tp-status"); if(ask) ask.disabled=true;
  if(st) st.textContent="TRANSMITTING…";
  const text=todoAskText(todoCur.kind,todoCur.item);
  await sendRequest(text);                       // same path as a typed/spoken request: ack + spoken reply
  if(st) st.textContent=requestsTopic()?"SENT — JARVIS WILL ANSWER ALOUD":"NOT SENT — OPEN SETUP";
  setTimeout(()=>{ if(ask&&todoCur&&!todoData.example){ ask.disabled=false; } }, 4000);
}
function bindTodo(){
  ["#wait-list","#fleet-list"].forEach(sel=>{ const ul=$(sel); if(!ul) return;
    ul.addEventListener("click",e=>{ const li=e.target.closest("li[data-i]"); if(li){ e.preventDefault(); openTodo(li.getAttribute("data-k"),+li.getAttribute("data-i")); } });
    ul.addEventListener("keydown",e=>{ if(e.key!=="Enter"&&e.key!==" ") return; const li=e.target.closest("li[data-i]"); if(li){ e.preventDefault(); openTodo(li.getAttribute("data-k"),+li.getAttribute("data-i")); } });
  });
  ["#tp-close","#tp-close2"].forEach(sel=>{ const b=$(sel); if(b) b.addEventListener("click",e=>{ e.preventDefault(); closeTodo(); }); });
  const ask=$("#tp-ask"); if(ask) ask.addEventListener("click",e=>{ e.preventDefault(); askTodo(); });
  addEventListener("keydown",e=>{ if(e.key==="Escape"){ const p=$("#todo-panel"); if(p&&!p.hidden) closeTodo(); } });
}

/* ---------- panels from data.json (served) / data.js (file://) ---------- */
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function renderData(d){ if(!d) return; const ex=/example/i.test(d._note||"")||d.updated==="EXAMPLE"; const w=d.waiting_on_you||[], f=d.fleet_today||[];
  const tag=ex?'<span class="example">EXAMPLE DATA</span>':"";
  $("#wait-n").innerHTML=w.length+tag; $("#fleet-n").innerHTML=f.length+tag;
  todoData={wait:w.slice(0,5), fleet:f.slice(0,4), example:ex, updated:ex?"":String(d.updated||"")};   // v12.3: kept for the to-do pop-up
  $("#wait-list").innerHTML=todoData.wait.map((i,n)=>`<li class="${esc(i.priority)}" data-k="wait" data-i="${n}" tabindex="0" role="button" aria-haspopup="dialog"><span class="ck"></span><span class="tx">${esc(i.title)}</span>${i.tag?`<span class="tg">${esc(i.tag)}</span>`:""}</li>`).join("");
  $("#fleet-list").innerHTML=todoData.fleet.map((i,n)=>`<li data-k="fleet" data-i="${n}" tabindex="0" role="button" aria-haspopup="dialog"><span class="st ${esc(i.status)}"></span><span class="bn">${esc(i.bot)}</span><span class="tx">${esc(i.summary)}</span></li>`).join(""); }
async function loadData(){ if(location.protocol!=="file:"){ try{ const r=await fetch(C.DATA_URL+"?t="+Date.now(),{cache:"no-store"}); if(r.ok){ renderData(await r.json()); return; } }catch(e){} }
  renderData(window.JARVIS_DATA); }
loadData(); setInterval(loadData,C.DATA_REFRESH_SECONDS*1000);


/* ---------- uplink (ntfy requests topic -> relay -> Chief of Staff) + replies (ntfy SSE) ---------- */
const LS_URL="jarvis_webhook_url", LS_KEY="jarvis_webhook_key", LS_TOPIC="jarvis_replies_topic", LS_REQ="jarvis_requests_topic", LS_SEEN="jarvis_ntfy_seen";
// v12.3.1 fix: these two were lost when v11 was split out of v10, so every live ntfy message threw a ReferenceError in ingestNtfy.
const ntfySeen=new Set((()=>{ try{ return JSON.parse(localStorage.getItem(LS_SEEN)||"[]"); }catch(e){ return []; } })());
function rememberNtfy(id){ ntfySeen.add(id); lastSeenId=String(id); try{ localStorage.setItem(LS_SEEN,JSON.stringify([...ntfySeen].slice(-400))); }catch(e){} }
const SOURCE=(qs.get("source")==="desktop")?"desktop":C.SOURCE||((/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))?"phone":"desktop");
function consumeTopicFragment(){
  const raw=location.hash||"";
  if(!raw||raw.length<2) return;
  const p=new URLSearchParams(raw[0]==="#"?raw.slice(1):raw);
  const pick=k=>{ let v=""; try{ v=(p.get(k)||"").trim(); }catch(e){} if(!v){ const m=raw.match(new RegExp("(?:^#|&)"+k+"=([^&]+)")); if(m) try{ v=decodeURIComponent(m[1].replace(/\+/g," ")).trim(); }catch(e){} } return v; };
  const t=pick("topic"), q=pick("req");
  try{ if(t) localStorage.setItem(LS_TOPIC,t); if(q) localStorage.setItem(LS_REQ,q); }catch(e){}
  if(t||q||/(^#|&)setup\b/.test(raw)) try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){}
}
consumeTopicFragment();
function requestsTopic(){ try{ const t=(localStorage.getItem(LS_REQ)||"").trim(); if(t) return t; }catch(e){} return (C.REQUESTS_TOPIC||"").trim(); }
function repliesTopic(){ try{ const t=(localStorage.getItem(LS_TOPIC)||"").trim(); if(t) return t; }catch(e){} return (C.RESPONSES_TOPIC||"").trim(); }
let sse=null, sseOpen=false, lastReply=null, statusHold=false;
function hookReady(){ return !!requestsTopic(); }
function updateLink(){
  const okHook=hookReady(), topic=!!repliesTopic(), okSse=sseOpen&&topic;
  const link=$("#gi-link"); if(link) link.textContent=(okHook&&okSse)?"CONNECTED": okHook?"UPLINK ONLY":"NOT CONNECTED";
  if(statusHold) return;
  if(okHook&&okSse) setStatus("CONNECTED",false);
  else if(!okHook) setStatus("TAP SETUP TO CONNECT",true);
  else setStatus("REPLIES OFFLINE",true);
}
function holdStatus(t,warn,ms){ statusHold=true; setStatus(t,warn); clearTimeout(holdStatus._t); holdStatus._t=setTimeout(()=>{statusHold=false;updateLink();},ms||4000); }
function ntfyPayload(ev){
  if(!ev||!ev.data) return null;
  let data=ev.data;
  try{ data=JSON.parse(ev.data); }catch(e){ const s=String(ev.data).trim(); return s?{id:s,text:s,isAudio:false,url:""}:null; }
  if(!data||data.event==="open"||data.event==="keepalive") return null;
  let text=String(data.message||data.body||data.text||"").trim();
  const tags=[].concat(data.tags||[]).map(t=>String(t).toLowerCase());
  const att=data.attachment||null;
  const url=String((att&&(att.url||att.full_url))||data.attachment_url||"").trim();
  const isAudio=tags.includes("jarvis-audio")||String(data.title||"").toLowerCase()==="jarvis-audio"||/\.mp3(\?|$)/i.test(url);
  if(!text&&!url) return null;
  let part=0, parts=0;   // v12.3.1: streamed reply audio, "[[part k/n]] <full reply text>"
  if(isAudio){ const m=/^\[\[part (\d+)\/(\d+)\]\]\s*([\s\S]*)$/.exec(text); if(m){ part=+m[1]; parts=+m[2]; text=m[3].trim(); } }
  // v12.10: ntfy turns messages over 4,096 bytes into a text file ("You received a file: attachment.txt"); fetch it instead
  const fileText=!isAudio && !!url && !!att && (/^text\//i.test(String(att.type||"")) || /\.(txt|json)$/i.test(String(att.name||"")) || /^You received a file/i.test(text));
  return {id:String(data.id||data.time||text||url), text, isAudio, url, part, parts, fileText, size:+(att&&att.size)||0};
}
async function fetchTextAttachment(msg){
  if(msg.size>2000000) { vlog({ev:"att-too-big",size:msg.size}); return null; }
  for(let i=0;i<3;i++){
    try{ const r=await fetch(msg.url,{cache:"no-store"}); if(!r.ok) throw new Error("HTTP "+r.status);
      const t=(await r.text()).trim(); vlog({ev:"att-text",bytes:t.length,email:isEmailJson(t)});
      return Object.assign({},msg,{text:t,url:"",fileText:false,viaFile:true}); }
    catch(e){ vlog({ev:"att-error",err:String(e&&e.message||e)}); await new Promise(r=>setTimeout(r,800*(i+1))); }
  }
  if(isEmailJson(msg.text)) return null;
  try{ if(emailPending){ showEmailPanel(); setEmailError("Inbox reply could not be downloaded - tap refresh."); } }catch(e){}
  return null;
}
/* v12.10 + APK 1.3.0: while the app is hidden the APK speaks replies itself; the page stays quiet then, and skips replies the
   app already spoke when it comes back (no double playback). Inbox JSON is never spoken natively, so it always passes. */
function nativeSpeaks(msg){
  if(!IN_APK || !msg || !msg.text || isEmailJson(msg.text)) return false;
  try{ if(document.hidden && typeof JarvisNative.bgSpeakOn==="function" && JarvisNative.bgSpeakOn()) return true;
       if(typeof JarvisNative.spokeText==="function" && JarvisNative.spokeText(msg.text)) return true; }catch(e){}
  return false; }
function ingestNtfy(msg){
  if(!msg||ntfySeen.has(msg.id)) return null;
  rememberNtfy(msg.id);
  if(msg.fileText){   // long reply / long inbox JSON delivered as a file: deliver it once it is downloaded
    fetchTextAttachment(msg).then(m=>{ if(!m) return; const p=ingestAfterFile(m); if(p) onReply(p.text,p.id,p.url); });
    return null; }
  return ingestAfterFile(msg);
}
function ingestAfterFile(msg){
  if(nativeSpeaks(msg)){ if(!msg.isAudio && !isAckText(msg.text)){ log("JARVIS: "+msg.text); histAdd("jarvis",msg.text,msg.id); try{ ackReq.replied=true; }catch(e){} } vlog({ev:"native-spoke",audio:!!msg.isAudio}); return null; }
  if(msg.isAudio){ offerAudio(msg); return null; }
  return msg;
}
function stopReplies(){ if(sse){ try{ sse.close(); }catch(e){} sse=null; } sseOpen=false; try{ stopAckStream(); }catch(e){} }
function startReplies(){
  stopReplies();
  const topic=repliesTopic();
  if(!topic||typeof EventSource==="undefined"){ updateLink(); return; }
  try{
    const sinceTok=typeof catchUpSince==="function"?catchUpSince():lastSeenId;
    const since=sinceTok?("?since="+encodeURIComponent(sinceTok)):"";
    sse=new EventSource("https://ntfy.sh/"+encodeURIComponent(topic)+"/sse"+since);
    sse.onopen=()=>{ sseOpen=true; updateLink(); };
    sse.onerror=()=>{ sseOpen=false; updateLink(); };
    sse.onmessage=ev=>{
      const plain=ingestNtfy(ntfyPayload(ev));
      if(plain) onReply(plain.text,plain.id,plain.url);
    };
  }catch(e){ sseOpen=false; }
  try{ startAckStream(); }catch(e){}
  updateLink();
}


/* ---------- keep screen awake + catch up replies when returning ---------- */
const LS_AWAKE="jarvis_keep_awake";
const WAKE_VIDEO_SRC="data:video/mp4;base64,AAAAJGZ0eXBpc29tAAACAGlzb21pc282aXNvMmF2YzFtcDQxAAAC7G1vb3YAAABsbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAAAAAEAAAEAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAHvdHJhawAAAFx0a2hkAAAAAwAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAQAAAAAAQAAAAEAAAAAABi21kaWEAAAAgbWRoZAAAAAAAAAAAAAAAAAAAMgAAAAAAVcQAAAAAAC1oZGxyAAAAAAAAAAB2aWRlAAAAAAAAAAAAAAAAVmlkZW9IYW5kbGVyAAAAATZtaW5mAAAAFHZtaGQAAAABAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAD2c3RibAAAAKpzdHNkAAAAAAAAAAEAAACaYXZjMQAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAQABAASAAAAEgAAAAAAAAAARVMYXZjNjEuMTkuMTAxIGxpYngyNjQAAAAAAAAAAAAAABj//wAAADRhdmNDAWQACv/hABdnZAAKrNlewEQAAAMABAAAAwDIPEiWWAEABmjr48siwP34+AAAAAAQcGFzcAAAAAEAAAABAAAAEHN0dHMAAAAAAAAAAAAAABBzdHNjAAAAAAAAAAAAAAAUc3RzegAAAAAAAAAAAAAAAAAAABBzdGNvAAAAAAAAAAAAAAAobXZleAAAACB0cmV4AAAAAAAAAAEAAAABAAAAAAAAAAAAAAAAAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2MS43LjEwMwAAAgBtb29mAAAAEG1maGQAAAAAAAAAAQAAAeh0cmFmAAAAJHRmaGQAAAA5AAAAAQAAAAAAAAMQAAACAAAAAsUBAQAAAAAAFHRmZHQBAAAAAAAAAAAAAAAAAAGodHJ1bgAACgUAAAAyAAACCAIAAAAAAALFAAAEAAAAAAwAAAoAAAAADAAABAAAAAAMAAAAAAAAAAwAAAIAAAAAEgAACgAAAAAOAAAEAAAAAAwAAAAAAAAADAAAAgAAAAASAAAKAAAAAA4AAAQAAAAADAAAAAAAAAAMAAACAAAAABIAAAoAAAAADgAABAAAAAAMAAAAAAAAAAwAAAIAAAAAEgAACgAAAAAOAAAEAAAAAAwAAAAAAAAADAAAAgAAAAASAAAKAAAAAA4AAAQAAAAADAAAAAAAAAAMAAACAAAAABIAAAoAAAAADgAABAAAAAAMAAAAAAAAAAwAAAIAAAAAEgAACgAAAAAOAAAEAAAAAAwAAAAAAAAADAAAAgAAAAASAAAKAAAAAA4AAAQAAAAADAAAAAAAAAAMAAACAAAAABIAAAoAAAAADgAABAAAAAAMAAAAAAAAAAwAAAIAAAAAEgAACgAAAAAOAAAEAAAAAAwAAAAAAAAADAAAAgAAAAASAAAKAAAAAA4AAAQAAAAADAAAAAAAAAAMAAACAAAAABIAAAQAAAAFd21kYXQAAAKuBgX//6rcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA4IDMxZTE5ZjkgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MjUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAPZYiEADv//vdOvwKbVMJhAAAACEGaJGxDv/7gAAAACEGeQniF/8GBAAAACAGeYXRCv8SAAAAACAGeY2pCv8SBAAAADkGaaEmoQWiZTAh3//7hAAAACkGehkURLC//wYEAAAAIAZ6ldEK/xIEAAAAIAZ6nakK/xIAAAAAOQZqsSahBbJlMCHf//uAAAAAKQZ7KRRUsL//BgQAAAAgBnul0Qr/EgAAAAAgBnutqQr/EgAAAAA5BmvBJqEFsmUwId//+4QAAAApBnw5FFSwv/8GBAAAACAGfLXRCv8SBAAAACAGfL2pCv8SAAAAADkGbNEmoQWyZTAh3//7gAAAACkGfUkUVLC//wYEAAAAIAZ9xdEK/xIAAAAAIAZ9zakK/xIAAAAAOQZt4SahBbJlMCHf//uEAAAAKQZ+WRRUsL//BgAAAAAgBn7V0Qr/EgQAAAAgBn7dqQr/EgQAAAA5Bm7xJqEFsmUwId//+4AAAAApBn9pFFSwv/8GBAAAACAGf+XRCv8SAAAAACAGf+2pCv8SBAAAADkGb4EmoQWyZTAh3//7hAAAACkGeHkUVLC//wYAAAAAIAZ49dEK/xIAAAAAIAZ4/akK/xIEAAAAOQZokSahBbJlMCHf//uAAAAAKQZ5CRRUsL//BgQAAAAgBnmF0Qr/EgAAAAAgBnmNqQr/EgQAAAA5BmmhJqEFsmUwIb//+4QAAAApBnoZFFSwv/8GBAAAACAGepXRCv8SBAAAACAGep2pCv8SAAAAADkGarEmoQWyZTAhv//7gAAAACkGeykUVLC//wYEAAAAIAZ7pdEK/xIAAAAAIAZ7rakK/xIAAAAAOQZrwSahBbJlMCF///uEAAAAKQZ8ORRUsL//BgQAAAAgBny10Qr/EgQAAAAgBny9qQr/EgAAAAA5BmzFJqEFsmUwIV//+wAAAAENtZnJhAAAAK3RmcmEBAAAAAAAAAQAAAAAAAAABAAAAAAAABAAAAAAAAAADEAEBAQAAABBtZnJvAAAAAAAAAEM=";
let lastSeenId=(()=>{ try{ const a=JSON.parse(localStorage.getItem(LS_SEEN)||"[]"); return a.length?String(a[a.length-1]):""; }catch(e){ return ""; } })();
let listenSince=Math.floor(Date.now()/1000), hiddenAt=0;
function catchUpSince(){ return lastSeenId || (hiddenAt?String(hiddenAt):"") || String(listenSince); }
function keepAwakeOn(){ try{ const v=localStorage.getItem(LS_AWAKE); if(v===null||v==="") return true; return v!=="0"; }catch(e){ return true; } }
function setKeepAwakePref(on){ try{ localStorage.setItem(LS_AWAKE,on?"1":"0"); }catch(e){} }
let wakeLock=null, wakeFallback=null, wakeLogged=false, catchingUp=false, wakeBusy=false;
function repliesOpen(){ return !!(sse && typeof EventSource!=="undefined" && sse.readyState===EventSource.OPEN); }
function updateAwakeUI(active){
  const on=keepAwakeOn();
  const label=active?"AWAKE":(on?"STANDBY":"SLEEP OK");
  const gi=$("#gi-awake"); if(gi){ gi.textContent=label; const row=gi.closest(".kv"); if(row){ row.classList.toggle("ok",!!active); row.classList.toggle("off",!active&&!on); } }
  const badge=$("#awake-badge");
  if(badge){ badge.textContent=label; badge.classList.toggle("on",!!active); badge.hidden=false; }
}
function startWakeFallback(){
  if(wakeFallback) return;
  const v=document.createElement("video");
  v.setAttribute("playsinline",""); v.setAttribute("webkit-playsinline",""); v.setAttribute("muted","");
  v.muted=true; v.defaultMuted=true; v.loop=true; v.playsInline=true; v.setAttribute("aria-hidden","true");
  v.style.cssText="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;bottom:0;left:0;";
  v.src=WAKE_VIDEO_SRC;
  document.body.appendChild(v);
  const p=v.play(); if(p&&p.catch) p.catch(()=>{});
  wakeFallback=v;
}
function stopWakeFallback(){
  if(!wakeFallback) return;
  try{ wakeFallback.pause(); wakeFallback.removeAttribute("src"); wakeFallback.load(); wakeFallback.remove(); }catch(e){}
  wakeFallback=null;
}
async function acquireWakeLock(){
  if(!keepAwakeOn() || document.visibilityState!=="visible"){ updateAwakeUI(!!(wakeLock||wakeFallback)); return; }
  if(wakeLock || wakeBusy){ updateAwakeUI(true); return; }
  if(navigator.wakeLock && navigator.wakeLock.request){
    wakeBusy=true;
    try{
      const lock=await navigator.wakeLock.request("screen");
      wakeLock=lock;
      lock.addEventListener("release",()=>{
        if(wakeLock===lock) wakeLock=null;
        updateAwakeUI(!!wakeFallback);
        if(keepAwakeOn() && document.visibilityState==="visible") acquireWakeLock();
      });
      stopWakeFallback();
      updateAwakeUI(true);
      if(!wakeLogged){ wakeLogged=true; log("Screen lock disabled while JARVIS is open"); }
      wakeBusy=false;
      return;
    }catch(e){ wakeBusy=false; }
  }
  startWakeFallback();
  const held=!!wakeFallback;
  updateAwakeUI(held);
  if(held && !wakeLogged){ wakeLogged=true; log("Screen lock disabled while JARVIS is open"); }
}
function releaseWakeLock(){
  const held=wakeLock; wakeLock=null;
  if(held) try{ held.release(); }catch(e){}
  stopWakeFallback();
  updateAwakeUI(false);
}
function applyKeepAwake(on){
  setKeepAwakePref(on);
  if(on) acquireWakeLock();
  else releaseWakeLock();
}
async function catchUpReplies(){
  const topic=repliesTopic();
  const since=catchUpSince();
  if(!topic || !since || catchingUp) return;
  catchingUp=true;
  try{
    const r=await fetch("https://ntfy.sh/"+encodeURIComponent(topic)+"/json?poll=1&since="+encodeURIComponent(since));
    if(!r.ok) return;
    const pending=[], leftoverAudio=[];
    for(const line of (await r.text()).split("\n")){
      if(!line.trim()) continue;
      const msg=ntfyPayload({data:line});
      if(!msg || ntfySeen.has(msg.id)) continue;
      rememberNtfy(msg.id);
      if(msg.isAudio) leftoverAudio.push(msg);
      else pending.push(msg);
    }
    leftoverAudio.filter(a=>a.part&&a.url).forEach(offerPart);          // v12.3.1: streamed parts go to the part store
    const fullAudio=leftoverAudio.filter(a=>!a.part);
    for(let msg of pending){
      if(msg.fileText){ msg=await fetchTextAttachment(msg); if(!msg) continue; }   // v12.10: long reply / inbox JSON sent as a file
      let url="";
      const i=fullAudio.findIndex(a=>a.text===msg.text&&a.url);
      if(i>=0) url=fullAudio.splice(i,1)[0].url;
      else { const pr=partRec(msg.text,false); if(pr&&pr.urls[1]) url=pr.urls[1]; }
      await onReply(msg.text, msg.id, url);
    }
    for(const a of fullAudio) offerAudio(a);
  }catch(e){}
  finally{ catchingUp=false; }
}
function onPageVisible(){
  if(document.visibilityState==="hidden"){ hiddenAt=Math.floor(Date.now()/1000); return; }
  if(document.visibilityState!=="visible") return;
  try{ if("speechSynthesis" in window) speechSynthesis.resume(); }catch(e){}
  acquireWakeLock();
  if(!repliesOpen()) startReplies();
  catchUpReplies();
}
document.addEventListener("visibilitychange", onPageVisible);
updateAwakeUI(false);


/* ---------- v12.8 instant acknowledgments + fast-reply openers ----------
   Clips are rendered by the relay in the same local film voice as replies, sent once as a JSON bundle (ntfy attachment on
   the "<replies>-acks" side topic) and kept in this device's Cache API. Nothing is in the repo.
   - Requests that obviously need his accounts/tools get a matching ack the moment they are sent (no network).
   - Anything else: the relay's fast brain either answers in ~1-2 s (no ack, maybe a cached opener signal) or tells us it
     escalated (jarvis_ack) and we play an ack then. Never the same clip twice in a row. */
const ACKBANK_V=1, ACKBANK_CACHE="jarvis-ackbank", ACKBANK_KEY="/jarvis-ackbank-v"+ACKBANK_V+".json";
let ackBank=null, ackBankBusy=false, ackSse=null, lastAckText="";
let ackReq={ts:0,sentAt:0,acked:false,replied:false};
const openerPlayed=new Set();
const TASK_RE=/\b(e-?mails?|inbox|mail|gmail|calendar|meetings?|schedule|appointments?|remind(er|ers)?|to-?dos?|tasks?|drive|files?|documents?|docs?|spreadsheet|messages?|texts?|sms|whatsapp|slack|telegram|call|phone|ring|orders?|buy|purchase|book(ing)?|reserv\w*|flights?|hotel|uber|news|headlines|stocks?|prices?|invoice|pay(ment)?|bank|balance|crystal|carta|godpack|learn2spiel|matthew|send|draft|reply|respond|forward|note|notes|lists?|open|play|music|spotify|lights?|turn (on|off)|github|repo|deploy|website|site|update|change|cancel|delete|save|add|create|set|alarm|timer|summar\w*|brief(ing)?|contacts?|address|package|delivery|track|weekend plans|agenda|my|remind me|text me|call me|send me|email me|i have|do i|did i|am i|shall we|let'?s)\b/i;
const CHAT_SAFE_RE=/^(how are you|tell me (a|another) joke|what'?s up|hello|hi|hey|good (morning|afternoon|evening|night))/i;
const WEATHER_WORD_RE=/\b(weather|temperature|rain|raining|sunny|forecast|cold|hot|warm|wind|windy|snow|umbrella|jacket|degrees|humid)\b/i;
function stripWake(t){ return String(t||"").replace(/^\s*((hey|ok|okay|a)\s+)?jarvis[,.!\s]*/i,"").trim(); }
function looksLikeTask(text){
  const t=stripWake(text);
  if(t.split(/\s+/).length>28) return true;
  const hard=/\b(e-?mail|calendar|remind|message|text|send|order)\b/i.test(t);
  if((CHAT_SAFE_RE.test(t)||WEATHER_WORD_RE.test(t)) && !hard) return false;
  return TASK_RE.test(t);
}
function ackKind(text){
  const t=stripWake(text);
  if(/\b(check|look up|lookup|find|search|any new|what'?s on|do i have|read|show|pull up|status|how many)\b/i.test(t)) return "lookup";
  if(/^\s*(what|when|where|who|why|how|which|is|are|do|does|did|can|could|will|would|should|any|tell me)\b/i.test(t)||/\?\s*$/.test(t)) return "question";
  return "command";
}
function ackTopic(){ const t=repliesTopic(); return t?t+"-acks":""; }
function b64Url(b64){ const bin=atob(b64), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); return URL.createObjectURL(new Blob([u8],{type:"audio/mpeg"})); }
function installAckBank(d){
  if(!d||d.v!==ACKBANK_V||!d.clips) return false;
  const bank={}; let n=0;
  for(const k of Object.keys(d.clips)){ bank[k]=(d.clips[k]||[]).filter(c=>c&&c.text&&c.mp3).map(c=>({text:c.text,url:b64Url(c.mp3)})); n+=bank[k].length; }
  if(n<3) return false;
  ackBank=bank; vlog({ev:"ackbank",n}); return true;
}
async function fetchAckBank(url){
  const r=await fetch(url); if(!r.ok) return false;
  const txt=await r.text(); let d=null; try{ d=JSON.parse(txt); }catch(e){ return false; }
  if(!installAckBank(d)) return false;
  try{ const c=await caches.open(ACKBANK_CACHE); await c.put(ACKBANK_KEY,new Response(txt,{headers:{"Content-Type":"application/json"}})); }catch(e){}
  return true;
}
async function pollAckBank(){
  const topic=ackTopic(); if(!topic) return false;
  const r=await fetch("https://ntfy.sh/"+encodeURIComponent(topic)+"/json?poll=1&since=3h"); if(!r.ok) return false;
  const msgs=(await r.text()).split("\n").map(l=>{ try{ return JSON.parse(l); }catch(e){ return null; } }).filter(Boolean);
  for(let i=msgs.length-1;i>=0;i--){
    const m=msgs[i], a=m.attachment;
    if(m.title==="jarvis-ack-bank" && a && a.url && (!a.expires || a.expires*1000>Date.now()+5000) && /-v(\d+)\.json$/.test(a.name||"") && +RegExp.$1===ACKBANK_V)
      return await fetchAckBank(a.url);
  }
  return false;
}
async function ensureAckBank(){
  if(ackBank||ackBankBusy||!ackTopic()) return;
  ackBankBusy=true;
  try{
    try{ const c=await caches.open(ACKBANK_CACHE); const r=await c.match(ACKBANK_KEY); if(r && installAckBank(await r.json())) return; }catch(e){}
    if(await pollAckBank()) return;
    const req=requestsTopic(); if(!req) return;
    let last=0; try{ last=+localStorage.getItem("jarvis_ackbank_ask")||0; }catch(e){}
    if(Date.now()-last<120000) return;
    try{ localStorage.setItem("jarvis_ackbank_ask",String(Date.now())); }catch(e){}
    await fetch("https://ntfy.sh/"+encodeURIComponent(req),{method:"POST",body:JSON.stringify({type:"ack_bank",v:ACKBANK_V,source:SOURCE,ts:Date.now()})});
    for(let i=0;i<12&&!ackBank;i++){ await new Promise(r=>setTimeout(r,2500)); if(await pollAckBank()) return; }
  }catch(e){ vlog({ev:"ackbank-error",err:String(e&&e.message||e)}); }
  finally{ ackBankBusy=false; }
}
function pickAck(kind){
  const bank=ackBank&&ackBank[kind]; if(!bank||!bank.length) return null;
  const pool=bank.length>1?bank.filter(c=>c.text!==lastAckText):bank;
  const c=pool[Math.floor(Math.random()*pool.length)]; lastAckText=c.text; return c;
}
function newAckRequest(ts){ ackReq={ts,sentAt:Date.now(),acked:false,replied:false}; }
function playAck(kind, why){
  if(!ackBank||ackReq.acked||ackReq.replied||!canSpeak()) return false;
  if(speaking){ vlog({ev:"ack-skip",reason:"speaking",kind,why}); return false; }   // JARVIS is already talking
  const c=pickAck(kind); if(!c) return false;
  ackReq.acked=true; const gen=requestGen, req=ackReq;
  vlog({ev:"ack",kind,why,text:c.text,ms:Date.now()-req.sentAt});
  if(voiceJobDepth>0){ playExclusiveUrl(c.url, voiceSeq); return true; }   // an older reply is still waiting for its audio: don't queue behind it
  enqueueVoice(async token=>{ if(gen!==requestGen||req.replied) return; await playExclusiveUrl(c.url, token); });
  return true;
}
function playOpener(text, full){
  const c=ackBank&&(ackBank.opener||[]).find(o=>o.text===text); if(!c||ackReq.acked||ackReq.replied||!canSpeak()) return false;
  if(speaking||voiceJobDepth>0){ vlog({ev:"opener-skip",reason:"busy",text}); return false; }   // part 1 then plays from the reply as usual
  ackReq.acked=true; openerPlayed.add(full); const gen=requestGen;
  vlog({ev:"opener",text,ms:Date.now()-ackReq.sentAt});
  enqueueVoice(async token=>{ if(gen!==requestGen) return; await playExclusiveUrl(c.url, token); });
  return true;
}
function onAckSignal(data){
  let m=null; try{ m=JSON.parse(data.message||""); }catch(e){}
  if(data.title==="jarvis-ack-bank" && data.attachment && data.attachment.url){ if(!ackBank) fetchAckBank(data.attachment.url).catch(()=>{}); return; }
  if(!m||m.ts==null||+m.ts!==+ackReq.ts) return;
  if(m.jarvis_open && m.text) playOpener(String(m.jarvis_open), String(m.text));
  else if(m.jarvis_ack) playAck(["question","command","lookup"].includes(m.jarvis_ack)?m.jarvis_ack:"question","relay");
}
function stopAckStream(){ if(ackSse){ try{ ackSse.close(); }catch(e){} ackSse=null; } }
function startAckStream(){
  stopAckStream();
  const topic=ackTopic(); if(!topic||typeof EventSource==="undefined") return;
  try{
    ackSse=new EventSource("https://ntfy.sh/"+encodeURIComponent(topic)+"/sse");
    ackSse.onmessage=ev=>{ try{ const d=JSON.parse(ev.data); if(d&&d.event==="message") onAckSignal(d); }catch(e){} };
  }catch(e){ ackSse=null; }
  ensureAckBank();
}
/* After a cached opener played, the reply's part 1 (same opener) is skipped and parts 2..n follow. */
async function playAfterOpener(text, token){
  const r=partRec(text,true); r.started=true;
  for(let k=2;;k++){
    if(r.n && k>r.n) return true;
    const u=await waitPart(r,k,PART_WAIT_MS);
    if(!u){ if(k===2) vlog({ev:"part-missing",k,n:r.n,text}); return true; }
    if(token!==voiceSeq||!canSpeak()) return true;
    await playExclusiveUrl(u, token);
  }
}

async function sendRequest(text){
  text=(text||"").trim(); if(!text) return;
  if(looksLikeInboxCommand(text)){
    const inp=$("#vb-input"); if(inp) inp.value="";
    log("YOU: "+text);
    const hadList=!!emailCache.list;   // v12.8: spoken/typed "check my email" gets an instant ack only when no saved list shows at once
    const p=openInbox(); newAckRequest(-1); if(!hadList) playAck("lookup","inbox");
    return p;
  }
  const inp=$("#vb-input"); if(inp) inp.value="";
  log("YOU: "+text);
  const req=requestsTopic();
  if(!req){ toast("TAP SETUP TO CONNECT"); log("Not sent — open SETUP and paste the requests channel"); holdStatus("TAP SETUP TO CONNECT",true,5000); return; }
  histAdd("you",text);
  busyReq=true; setBusy(); holdStatus("TRANSMITTING",false,2000);
  const prog=$("#vb-prog"); if(prog) prog.style.width="100%";
  noteSentRequest();
  // v12.6.1: no chime before replies (owner request)
  const sentTs=Date.now();
  newAckRequest(sentTs);
  if(looksLikeTask(text)) playAck(ackKind(text),"local");   // v12.8: instant, from the on-device bank
  const body=JSON.stringify({text,source:SOURCE,ts:sentTs});
  try{
    // Plain text body, no custom headers: a CORS "simple" request that ntfy.sh accepts from any page.
    const r=await fetch("https://ntfy.sh/"+encodeURIComponent(req),{method:"POST",body});
    if(!r.ok) throw new Error("HTTP "+r.status);
    toast("SENT TO CHIEF OF STAFF"); log("Sent to Chief of Staff"); holdStatus("SENT TO CHIEF OF STAFF",false,5000);
  }catch(e){
    toast("UPLINK ERROR"); log("Send failed — check the connection"); holdStatus("UPLINK ERROR",true,5000); speakLine("error");
  }finally{
    busyReq=false; setBusy(); if(prog) prog.style.width="60%";
  }
}

function openSetup(){
  const ov=$("#setup"); if(!ov) return;
  const rq=$("#su-req"),tp=$("#su-topic"),city=$("#su-city"),cityRow=$("#su-city-row");
  if(rq) rq.value=requestsTopic(); if(tp) tp.value=repliesTopic();
  if(cityRow){ const show=typeof setupLocationFromField==="function"; cityRow.hidden=!show;
    if(show&&city){ try{ const l=JSON.parse(localStorage.getItem("jarvis_loc")||"null"); city.value=(l&&!l.auto&&l.name)?l.name:""; }catch(e){ city.value=""; } } }
  const aw=$("#su-awake"); if(aw) aw.checked=keepAwakeOn();
  const wk=$("#su-wake"); if(wk) wk.checked=!!C.WAKE_WORD_ENABLED;
  const ll=$("#su-launch"); if(ll) ll.checked=launchListenPref();
  ov.hidden=false;
}
function closeSetup(){ const ov=$("#setup"); if(ov) ov.hidden=true; }
async function saveSetup(ev){
  if(ev) ev.preventDefault();
  const req=($("#su-req")&&$("#su-req").value||"").trim();
  const topic=($("#su-topic")&&$("#su-topic").value||"").trim();
  try{
    if(req) localStorage.setItem(LS_REQ,req); else localStorage.removeItem(LS_REQ);
    if(topic) localStorage.setItem(LS_TOPIC,topic); else localStorage.removeItem(LS_TOPIC);
    localStorage.removeItem(LS_URL); localStorage.removeItem(LS_KEY);
  }catch(e){ toast("COULD NOT SAVE ON THIS DEVICE"); return; }
  const cityEl=$("#su-city");
  if(cityEl&&typeof setupLocationFromField==="function") await setupLocationFromField(cityEl.value);
  const aw=$("#su-awake"); if(aw) applyKeepAwake(!!aw.checked);
  closeSetup();
  startReplies();
  updateLink();
  toast(hookReady()?"SETUP SAVED":"SETUP SAVED — REQUESTS CHANNEL STILL NEEDED");
}
function bindSetup(){
  const vb=$("#voicebar"); if(vb) vb.addEventListener("submit",e=>{e.preventDefault(); sendRequest($("#vb-input").value);});
  const inbox=$("#inbox-btn"); if(inbox) inbox.addEventListener("click",e=>{e.preventDefault(); openInbox();});
  const dockMail=$("#dock-mail"); if(dockMail) dockMail.addEventListener("click",e=>{e.preventDefault(); openInbox();});
  const epClose=$("#ep-close"); if(epClose) epClose.addEventListener("click",e=>{e.preventDefault(); closeInbox();});
  const epBack=$("#ep-back"); if(epBack) epBack.addEventListener("click",e=>{e.preventDefault(); showEmailList();});
  const epRefresh=$("#ep-refresh"); if(epRefresh) epRefresh.addEventListener("click",e=>{e.preventDefault(); openInbox(true);});
  const epList=$("#ep-list"); if(epList) epList.addEventListener("click",e=>{
    if(Date.now()-(bindSetup.swipedAt||0)<350) return;   // that touch was a swipe between inboxes
    const li=e.target.closest("li[data-id]"); if(li) openEmail(li.getAttribute("data-id"));
  });
  // v12.10 inbox switcher: tabs + swipe/trackpad left-right + arrow keys
  const accts=$("#ep-accts"); if(accts){
    accts.innerHTML=INBOX_ACCOUNTS.map(x=>`<button type="button" role="tab" data-acct="${x.id}" title="${x.addr||"Main Gmail"}">${x.label}</button>`).join("");   // label text node first, unread <b> badge after
    accts.addEventListener("click",e=>{ const b=e.target.closest("[data-acct]"); if(!b) return; e.preventDefault();
      const i=INBOX_ACCOUNTS.findIndex(x=>x.id===inboxAcct), j=INBOX_ACCOUNTS.findIndex(x=>x.id===b.dataset.acct); switchInbox(b.dataset.acct, j>i?1:-1); });
    paintInboxTabs(); }
  const ep=$("#email-panel"); if(ep){
    let sx=0, sy=0, st=0, track=false;
    ep.addEventListener("touchstart",e=>{ if(e.touches.length!==1||emailView==="detail") { track=false; return; } track=true; sx=e.touches[0].clientX; sy=e.touches[0].clientY; st=Date.now(); },{passive:true});
    ep.addEventListener("touchend",e=>{ if(!track) return; track=false; const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy;
      if(Math.abs(dx)>60 && Math.abs(dx)>1.6*Math.abs(dy) && Date.now()-st<900 && !e.target.closest("#ep-accts")){ bindSetup.swipedAt=Date.now(); stepInbox(dx<0?1:-1); } },{passive:true});
    let wAcc=0, wAt=0;
    ep.addEventListener("wheel",e=>{ if(emailView==="detail") return; const dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:(e.shiftKey?e.deltaY:0); if(!dx) return;
      const now=Date.now(); if(now-wAt>400) wAcc=0; wAt=now; wAcc+=dx; if(Math.abs(wAcc)>120 && now-(bindSetup.swipedAt||0)>500){ bindSetup.swipedAt=now; stepInbox(wAcc>0?1:-1); wAcc=0; } },{passive:true});
    ep.addEventListener("keydown",e=>{ if(emailView==="detail") return; if(e.key==="ArrowRight"){ e.preventDefault(); stepInbox(1); } else if(e.key==="ArrowLeft"){ e.preventDefault(); stepInbox(-1); } });
  }

  bindTodo();
  const ds=$("#dock-settings"); if(ds) ds.addEventListener("click",e=>{e.preventDefault(); openSetup();});
  const gear=$("#m-gear"); if(gear) gear.addEventListener("click",e=>{e.preventDefault(); openSetup();});
  const cancel=$("#su-cancel"); if(cancel) cancel.addEventListener("click",e=>{e.preventDefault(); closeSetup();});
  const form=$("#setup-card"); if(form) form.addEventListener("submit",saveSetup);
  const ov=$("#setup"); if(ov) ov.addEventListener("click",e=>{ if(e.target===ov) closeSetup(); });
  const aw=$("#su-awake"); if(aw){ aw.checked=keepAwakeOn(); aw.addEventListener("change",()=>applyKeepAwake(!!aw.checked)); }
  const wk=$("#su-wake"); if(wk){ wk.addEventListener("change",()=>setWakeWord(!!wk.checked,true)); }
  const ll=$("#su-launch"); if(ll){ ll.checked=launchListenPref(); ll.addEventListener("change",()=>{ try{ localStorage.setItem(LS_LAUNCH,ll.checked?"1":"0"); }catch(e){} log(ll.checked?"Listen on open: on":"Listen on open: off"); }); }
  startReplies();
}

/* ---------- speech recognition: mic tile + "Hey Jarvis" wake word (v12.4) ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition; let rec=null, wakeArmed=false, micBlocked=false, booted=false;
const cap=s=>s.toUpperCase();
const LS_WAKE="jarvis_wake_word", LS_LAUNCH="jarvis_launch_listen";
const WAKE_LABEL="HEY JARVIS";
// "hey jarvis" and close mishearings anywhere in an utterance; bare "jarvis" only at the start of one.
const WAKE_NAME="(?:jarvis|jarviss|jarvas|jarvus|jervis|javis|jarvi)";
const WAKE_ANY=new RegExp("(?:^|\\s)(?:hey|hay|hei|heh|ey|eh|ay|a|hi|okay|ok)\\s+"+WAKE_NAME+"(?=\\s|$)");
const WAKE_START=new RegExp("^"+WAKE_NAME+"(?=\\s|$)");
// same-length normalisation, so the match position maps back onto the original words (case + punctuation kept)
function normWake(s){ return (s||"").replace(/[^A-Za-z0-9'\s]/g," ").replace(/\s/g," ").toLowerCase(); }
// Returns null (no wake phrase) or {rest:"<words after the wake phrase>"}.
function matchWake(text){ text=text||""; const n=normWake(text), lead=n.length-n.replace(/^ +/,"").length, t=n.slice(lead);
  if(!t.trim()) return null;
  let m=WAKE_ANY.exec(t), end=-1;
  if(m) end=m.index+m[0].length; else { m=WAKE_START.exec(t); if(m) end=m[0].length; }
  if(end<0) return null;
  return {rest:text.slice(lead+end).replace(/^[\s,.!?;:\-]+/,"").replace(/\s+/g," ").trim()}; }
function wakePref(){ try{ const v=localStorage.getItem(LS_WAKE); if(v==="1") return true; if(v==="0") return false; }catch(e){} return C.WAKE_WORD_ENABLED!==false; }
C.WAKE_WORD_ENABLED=wakePref();
let wakeQuietUntil=0, wakeFails=0;

/* v12.7 holographic helm: visible while a conversation is listening (command/handoff).
   Speaking bars use a Web Audio analyser on an already-granted mic stream only; never prompts.
   Falls back to SpeechRecognition speech/result events if the analyser is unavailable. */
let helmStream=null, helmAnalyser=null, helmRaf=0, helmPending=false, helmDenied=false, helmSpeech=false, helmSrc=null;
function helmActive(){ return (listening&&mode==="command")||mode==="handoff"||nativeLis||convo; }
function helmMuted(){ return convo&&convoMuted; }
/* v12.10: while JARVIS talks during a conversation the helm's eyes and glow follow his voice (output analyser), even when muted */
function helmVoiceLoop(){
  const el=helmEl(); if(!el) return;
  const on=convo && speaking;
  if(!on){ if(el.classList.contains("jv-talk")){ el.classList.remove("jv-talk"); el.style.setProperty("--hh-jv","0"); } helmVoiceLoop.raf=0; return; }
  let lv=0; try{ lv=window.JARVIS_AUDIO&&JARVIS_AUDIO.level? +JARVIS_AUDIO.level() : 0; }catch(e){}
  el.classList.add("jv-talk"); el.style.setProperty("--hh-jv",Math.max(0,Math.min(1,lv||0)).toFixed(3));
  helmVoiceLoop.raf=requestAnimationFrame(helmVoiceLoop); }
/* v12.9: inside the Android app the native recogniser owns the mic; it reports the level (onRmsChanged) here instead of a second
   getUserMedia capture, which can starve the recogniser. No level (older APK) = gentle idle shimmer only. */
const IN_APK=!!window.JarvisNative; let helmNativeAt=0;
window.__jarvisMicLevel=v=>{ if(convoMuted) v=0; helmNativeAt=Date.now(); helmLevel=Math.max(0,Math.min(1,+v||0)); paintHelmet(); };
window.__jarvisNativeListening=on=>{ nativeLis=!!on; if(!on){ helmLevel=0; } micUI(); };
function helmEl(){ return $("#holo-helm"); }
let helmLevel=0;
function paintHelmet(){
  const el=helmEl(); if(!el) return;
  const on=helmActive();
  el.classList.toggle("on",on);
  el.setAttribute("aria-hidden", on?"false":"true");
  if(!on){ helmSpeech=false; helmLevel=0; el.classList.remove("speaking"); el.style.setProperty("--hh-level","0"); return; }
  el.style.setProperty("--hh-level", helmLevel.toFixed(3));
  el.classList.toggle("muted", helmMuted());
  if(convo && speaking && !helmVoiceLoop.raf) helmVoiceLoop.raf=requestAnimationFrame(helmVoiceLoop);
  el.classList.toggle("speaking", !helmMuted() && (helmSpeech || helmLevel>0.06));
}
function setHelmSpeech(on){
  helmSpeech=!!on;
  const el=helmEl(); if(!el) return;
  if(on){ el.classList.add("speaking"); clearTimeout(setHelmSpeech.t); setHelmSpeech.t=setTimeout(()=>{ helmSpeech=false; paintHelmet(); },700); }
  else { clearTimeout(setHelmSpeech.t); }
  paintHelmet();
}
function stopHelmMeter(){
  if(helmRaf){ cancelAnimationFrame(helmRaf); helmRaf=0; }
  if(helmSrc){ try{ helmSrc.disconnect(); }catch(e){} helmSrc=null; }
  helmAnalyser=null;
  if(helmStream){ try{ helmStream.getTracks().forEach(t=>t.stop()); }catch(e){} helmStream=null; }
  helmPending=false;
  helmSpeech=false; helmLevel=0;
  const el=helmEl(); if(el) el.style.setProperty("--hh-level","0");
  paintHelmet();
}
async function startHelmMeter(){
  if(!helmActive() || helmStream || helmPending || helmDenied || IN_APK) return;
  let granted=false;
  try{ const st=await navigator.permissions.query({name:"microphone"}); granted=!!(st&&st.state==="granted"); }catch(e){ granted=false; }
  if(!granted || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  helmPending=true;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    if(!helmActive()){ stream.getTracks().forEach(t=>t.stop()); helmPending=false; return; }
    const ac=audioCtx();
    if(!ac){ stream.getTracks().forEach(t=>t.stop()); helmPending=false; return; }
    if(ac.state==="suspended") try{ await ac.resume(); }catch(e){}
    const src=ac.createMediaStreamSource(stream);
    const an=ac.createAnalyser(); an.fftSize=256; an.smoothingTimeConstant=0.72;
    src.connect(an);
    helmStream=stream; helmSrc=src; helmAnalyser=an; helmPending=false;
    const data=new Uint8Array(an.fftSize);
    const tick=()=>{
      if(!helmAnalyser) return;
      helmAnalyser.getByteTimeDomainData(data);
      let sum=0; for(let i=0;i<data.length;i++){ const v=(data[i]-128)/128; sum+=v*v; }
      helmLevel=Math.min(1, Math.sqrt(sum/data.length)*4);
      paintHelmet();
      helmRaf=requestAnimationFrame(tick);
    };
    helmRaf=requestAnimationFrame(tick);
  }catch(e){ helmDenied=true; helmPending=false; }
}
function syncHelmet(){
  paintHelmet();
  // Analyser only while the command recogniser is already running; never during wake-word idle.
  if(listening && mode==="command") startHelmMeter();
  else if(!helmActive()) stopHelmMeter();
}

function micUI(){ $("#p-mic").classList.toggle("listening",listening&&(mode==="command"||mode==="handoff"));
  ["#vb-mic","#mic-btn"].forEach(q=>{ const b=$(q); if(b){ b.classList.toggle("convo",convo); b.title=convo?"End conversation":"Talk"; b.setAttribute("aria-pressed",convo?"true":"false"); } });
  const mb=$("#vb-mute"); if(mb){ mb.classList.toggle("on",convoMuted); mb.setAttribute("aria-pressed",convoMuted?"true":"false"); const sp=mb.querySelector("span"); if(sp) sp.textContent=convoMuted?"MUTED":"MUTE"; mb.title=convoMuted?"Unmute the mic":"Mute the mic (conversation stays open)"; }
  $("#mic-state").textContent = (mode==="command"||mode==="handoff")?"LISTENING…":"JARVIS ONLINE";
  const wakeOn=C.WAKE_WORD_ENABLED&&!micBlocked&&!!SR;
  const mh=$("#m-hint"); if(mh) mh.textContent = convo?(convoMuted?"MIC MUTED · TAP MUTE TO TALK · MIC TO END":(mode==="command"||mode==="handoff")?"LISTENING… TAP THE MIC TO END":"CONVERSATION ON · TAP THE MIC TO END"): !SR?"TYPE BELOW - VOICE INPUT NEEDS CHROME": (mode==="command"||mode==="handoff")?"LISTENING… SPEAK YOUR REQUEST": wakeOn?`SAY "${WAKE_LABEL}" OR TAP THE SPHERE`:"TAP THE MIC OR THE SPHERE TO TALK";
  $("#mic-hint").textContent = !SR?"VOICE INPUT NEEDS CHROME OR EDGE": (mode==="command"||mode==="handoff")?"SPEAK YOUR REQUEST": wakeOn?`SAY "${WAKE_LABEL}" TO ACTIVATE`:"CLICK THE MIC TO TALK";
  document.body.classList.toggle("wake-on",wakeOn&&wakeArmed);
  setBusy(); syncHelmet(); }
function scheduleWake(delay){ clearTimeout(scheduleWake.t);
  scheduleWake.t=setTimeout(()=>{ if(!convo && C.WAKE_WORD_ENABLED && wakeArmed && !document.hidden && mode!=="command" && mode!=="handoff") startRec("wake"); },delay); }
// Wake phrase heard: short cue, sphere to LISTENING, then either send the words that followed it or listen for the request.
// v12.6: short, soft, gold "thinking" chime when a request is sent (generated, not voiced; quiet, under 0.5 s)
function thinkingChime(){ if(muted) return; try{ const ac=audioCtx(); if(!ac) return; if(ac.state==="suspended") ac.resume();
  const t=ac.currentTime, g=ac.createGain(); g.connect(ac.destination);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.06,t+0.03);
  g.gain.exponentialRampToValueAtTime(0.0001,t+0.42);
  [[659.25,0],[830.61,0.08]].forEach(([f,d])=>{ const o=ac.createOscillator(); o.type="sine"; o.frequency.setValueAtTime(f,t+d); o.connect(g); o.start(t+d); o.stop(t+d+0.34); });
  window.__jarvisThinkChimes=(window.__jarvisThinkChimes||0)+1; }catch(e){} }
// short rising two-tone chime (Web Audio, no file) so the wake hit is acknowledged instantly
function wakeChime(){ if(muted) return; try{ const ac=audioCtx(); if(!ac) return; if(ac.state==="suspended") ac.resume();
  const t=ac.currentTime, g=ac.createGain(); g.connect(ac.destination); g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.26);
  [[660,0],[990,0.09]].forEach(([f,d])=>{ const o=ac.createOscillator(); o.type="sine"; o.frequency.setValueAtTime(f,t+d); o.connect(g); o.start(t+d); o.stop(t+d+0.17); });
  window.__jarvisChimes=(window.__jarvisChimes||0)+1; }catch(e){} }
function onWake(rest){ wakeQuietUntil=Date.now()+1500; log("Wake word heard"); wakeChime(); convoStart("wake word");
  if(rest.split(/\s+/).filter(Boolean).length>=2){ mode="wakesent"; try{ rec.abort(); }catch(e){} sendRequest(rest); convoSent(); return; }
  mode="handoff"; listening=true; micUI(); try{ rec.abort(); }catch(e){}
  try{ speechSynthesis.cancel(); }catch(e){} stopReplyAudio();
  speakLine("ready").then(()=>{ startRec.retried=false; startRec("command"); }); }
function startRec(m){ if(!SR){ toast("SPEECH RECOGNITION NEEDS CHROME OR EDGE"); return; }
  if(m==="wake" && (convo || !C.WAKE_WORD_ENABLED || !wakeArmed || document.hidden)) return;
  mode=m; try{ rec&&rec.abort(); }catch(e){}
  const r=new SR(); rec=r; r.lang="en-GB"; r.interimResults=true; r.continuous=(m==="wake"); let finalText="", heard=false;
  r.onstart=()=>{ if(rec!==r) return; listening=true; startRec.okAt=Date.now(); micUI(); };
  r.onspeechstart=()=>{ if(rec!==r) return; if(m==="command"||m==="handoff") setHelmSpeech(true); if(m==="command") convoSpeechAgain(); };
  r.onspeechend=()=>{ if(rec!==r) return; if(m==="command"||m==="handoff") setHelmSpeech(false); };
  r.onresult=ev=>{ if(rec!==r) return; let interim=""; for(let i=ev.resultIndex;i<ev.results.length;i++){ const t=ev.results[i][0].transcript; if(ev.results[i].isFinal) finalText+=t+" "; else interim+=t; }
    micLevel=1; heard=true; wakeFails=0; if(m==="command"&&convo){ convoHeardAt=Date.now(); convoSpeechAgain(); } clearTimeout(startRec.t); startRec.t=setTimeout(()=>micLevel=0,400);
    if(m==="command"||m==="handoff") setHelmSpeech(true);
    if(m==="command") $("#vb-input").value=((convoPending?convoPending+" ":"")+finalText+interim).trim();
    if(m==="wake"){ if(speaking || Date.now()<wakeQuietUntil){ finalText=""; return; }   // never wake on JARVIS's own voice
      const last=ev.results[ev.results.length-1]; if(!last.isFinal) return;
      // check each final result as its own utterance so bare "jarvis" only counts at the start of one
      let hit=null; for(let i=ev.resultIndex;i<ev.results.length;i++){ if(ev.results[i].isFinal){ hit=matchWake(ev.results[i][0].transcript); if(hit) break; } }
      finalText=""; if(hit) onWake(hit.rest); } };
  r.onerror=e=>{ if(rec!==r) return; if(e.error==="not-allowed"||e.error==="service-not-allowed"||e.error==="audio-capture"){ wakeArmed=false;
      if(m==="command" && !startRec.retried){ startRec.retried=true; askMic().then(ok=>{ if(ok){ micBlocked=false; setTimeout(()=>startRec("command"),250); } else { micBlocked=true; toast("MIC BLOCKED ("+e.error+") - CHROME SITE SETTINGS > MICROPHONE"); } }); return; }
      micBlocked=true; toast("MIC BLOCKED ("+e.error+") - CHROME SITE SETTINGS > MICROPHONE"); }
    else if(m==="wake" && e.error!=="no-speech" && e.error!=="aborted") wakeFails++; };
  r.onend=()=>{ if(rec!==r) return; listening=false;
    if(m==="command"){ const t=$("#vb-input").value.trim(); mode="idle";
      if(convo) convoTurnEnded(t, heard);   // v12.10: hold and merge (one sentence with pauses = one request)
      else if(t){ sendRequest(t); convoSent(); } }
    if(mode==="wakesent") mode="idle";
    if(convo){ if(rec!==r){ micUI(); return; } if(mode!=="handoff") mode="idle"; }   // rec!==r: the hold already restarted listening
    else if(mode!=="handoff" && C.WAKE_WORD_ENABLED && wakeArmed){ if(mode!=="command") mode="idle";
      // back off when the recogniser keeps failing (network etc.) instead of spinning
      scheduleWake(speaking?1500:Math.min(30000,300*Math.pow(2,Math.min(wakeFails,7)))); }
    else if(mode!=="handoff") mode="idle";
    micUI(); };
  try{ r.start(); }catch(e){} }
function setWakeWord(on,fromUser){ C.WAKE_WORD_ENABLED=!!on; try{ localStorage.setItem(LS_WAKE,on?"1":"0"); }catch(e){}
  if(on){ micBlocked=false; if(booted&&SR){ wakeArmed=true; wakeFails=0; if(mode==="idle"||mode==="wake") startRec("wake"); } if(fromUser) log('Wake word "Hey Jarvis" on'); }
  else { wakeArmed=false; clearTimeout(scheduleWake.t); if(mode==="wake"){ try{ rec&&rec.abort(); }catch(e){} mode="idle"; } if(fromUser) log("Wake word off"); }
  micUI(); }
// Chrome stops the mic when the app is hidden; pick it back up when it returns to the foreground.
document.addEventListener("visibilitychange",()=>{ if(document.hidden){ clearTimeout(scheduleWake.t); if(mode==="wake"){ try{ rec&&rec.abort(); }catch(e){} } }
  else if(booted && C.WAKE_WORD_ENABLED && SR && !micBlocked){ wakeArmed=true; if(mode==="idle"||mode==="wake") scheduleWake(400); } });
async function askMic(){ try{ if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return false; const st=await navigator.mediaDevices.getUserMedia({audio:true}); st.getTracks().forEach(t=>t.stop()); return true; }catch(err){ return false; } }
function talk(){ if(convo){ convoEnd("tapped"); return; }
  try{ speechSynthesis.cancel(); }catch(e){} stopReplyAudio(); convoStart("mic"); startRec.retried=false; setTimeout(()=>startRec("command"),120); }

/* ---------- v12.9 conversation mode ----------
   Mic tap or "Hey Jarvis" (in-page or the Android native engine) opens a conversation: after each reply has finished playing,
   JARVIS listens again by itself. Tap the mic again to end it. While it is open the wake word is paused (in-page wake recogniser
   and, in the Android app >= 1.2.0, the native openWakeWord engine). Never listens while JARVIS is talking: listening resumes only
   after playback has been quiet for CONVO_QUIET_MS. Closes by itself after CONVO_SILENCE_MS without hearing the user. */
const CONVO_SILENCE_MS=90000, CONVO_REPLY_WAIT_MS=30000, CONVO_QUIET_MS=1200;
let convoTimer=0, convoHeardAt=0, convoAwait=null, convoAwaitAt=0, convoQuietAt=0, convoHow="";
function nativeConvo(on){ try{ if(window.JarvisNative&&typeof JarvisNative.setConversation==="function") JarvisNative.setConversation(!!on); }catch(e){} }
function convoStart(how){
  convoHeardAt=Date.now(); convoQuietAt=0; convoAwait=null;
  if(convo) return; convo=true; convoHow=how||"";
  clearTimeout(scheduleWake.t); if(mode==="wake"){ try{ rec&&rec.abort(); }catch(e){} mode="idle"; }
  nativeConvo(true); clearInterval(convoTimer); convoTimer=setInterval(convoTick,250);
  log("Conversation open ("+convoHow+") - tap the mic to end"); window.__jarvisConvo=(window.__jarvisConvo||0)+1; micUI(); }
function convoEnd(why){
  if(!convo) return; convoFlush("end"); convo=false; convoMuted=false; clearInterval(convoTimer); convoTimer=0; convoAwait=null;
  if(mode==="command"||mode==="handoff"){ const i=$("#vb-input"); if(i) i.value=""; mode="idle"; try{ rec&&rec.abort(); }catch(e){} listening=false; }
  nativeConvo(false); log("Conversation closed"+(why?" ("+why+")":"")); toast("CONVERSATION CLOSED",1800);
  if(C.WAKE_WORD_ENABLED&&wakeArmed&&SR) scheduleWake(900);
  micUI(); }
function convoSent(){ if(!convo) return; convoHeardAt=Date.now(); convoQuietAt=0; convoAwait=ackReq; convoAwaitAt=Date.now(); }
function convoBusy(){ return speaking||busyReq||voiceJobDepth>0; }
/* v12.10 one sentence = one request. Recognisers (Android's above all) end a turn at a short breath. In a conversation a finished
   turn is held: we listen straight on and only send once CONVO_HOLD_MS pass without new speech (longer after a dangling word like
   "that", "and", "the"). New speech is appended. Cost: every request leaves ~1.3 s later (the fast brain's ~0.5 s answer now lands
   ~1.8 s after you stop); the instant on-device ack still plays at send time. */
const CONVO_HOLD_MS=1300, CONVO_HOLD_LONG_MS=2300;
const DANGLING=/\b(and|or|but|so|because|that|which|the|a|an|to|of|for|with|about|from|at|if|then|my|your|i|we)$/i;   // words a finished sentence rarely ends on ("what time is it", "how are you" are complete)
let convoPending="", convoHoldT=0, convoHoldFire=false, convoMerged=0;
function convoHoldMs(t){ return DANGLING.test(String(t||"").trim().replace(/[.,!?;:]+$/,""))?CONVO_HOLD_LONG_MS:CONVO_HOLD_MS; }
function convoFlush(why){
  clearTimeout(convoHoldT); convoHoldT=0;
  const t=convoPending.trim(); convoPending=""; if(!t) return;
  const i=$("#vb-input"); if(i) i.value="";
  vlog({ev:"convo-send",why,merged:convoMerged,len:t.length}); window.__jarvisMerged=(window.__jarvisMerged||0)+(convoMerged>0?1:0); convoMerged=0;
  sendRequest(t); convoSent(); }
function convoSpeechAgain(){ if(convoHoldT){ clearTimeout(convoHoldT); convoHoldT=0; if(convoPending) convoMerged++; } }
function convoTurnEnded(t, heardNew){
  if(convoMuted){ if(convoPending) convoFlush("mute"); return; }
  if(convoHoldFire){ convoHoldFire=false; convoFlush("pause"); return; }
  if(!t){ convoFlush("empty"); return; }
  if(convoPending && (t===convoPending || !heardNew)){ convoFlush("no-more"); return; }   // the follow-up turn heard nothing new
  convoPending=t;
  clearTimeout(convoHoldT);
  convoHoldT=setTimeout(()=>{ convoHoldT=0;
    if(rec && mode==="command"){ convoHoldFire=true; try{ rec.abort(); }catch(e){ convoHoldFire=false; convoFlush("pause"); } }   // onend sends
    else convoFlush("pause"); }, convoHoldMs(t));
  startRec.retried=false; startRec("command");   // keep listening during the hold
}
function setConvoMute(on){
  if(!convo) return; on=!!on; if(on===convoMuted) return;
  convoMuted=on;
  if(on){ if(mode==="command"){ convoHoldFire=false; try{ rec&&rec.abort(); }catch(e){} } else convoFlush("mute");
    listening=false; helmLevel=0; log("Mic muted - conversation stays open"); toast("MIC MUTED · JARVIS CAN STILL ANSWER",2000); }
  else { convoHeardAt=Date.now(); convoQuietAt=0; log("Mic on"); if(!speaking && mode!=="command" && mode!=="handoff"){ startRec.retried=false; startRec("command"); } }
  window.__jarvisMuteToggles=(window.__jarvisMuteToggles||0)+1; micUI(); }
function convoTick(){
  if(!convo) return;
  const now=Date.now();
  if(now-(convoTick.hb||0)>30000){ convoTick.hb=now; nativeConvo(true); }   // heartbeat: the APK expires a conversation pause after 150 s without one
  if(mode==="command"||mode==="handoff"){
    // JARVIS started talking while we listen and the user has said nothing: stop listening so he never hears himself
    if(speaking && mode==="command" && !(($("#vb-input")||{}).value||"").trim() && !convoPending){ try{ rec&&rec.abort(); }catch(e){} }
    return; }
  if(document.hidden && !IN_APK) return;
  if(convoMuted){ convoHeardAt=now; convoQuietAt=0; return; }   // muted: no listening and no silence timer, replies still play
  if(convoBusy()){ convoQuietAt=0; return; }
  if(convoAwait){ const a=convoAwait;
    if(a.ts>0 && !a.replied && ackReq===a && now-convoAwaitAt<CONVO_REPLY_WAIT_MS) return;   // reply on its way
    convoAwait=null; convoQuietAt=0; }
  if(!convoQuietAt){ convoQuietAt=now; return; }
  if(now-convoQuietAt<CONVO_QUIET_MS) return;
  if(now-convoHeardAt>CONVO_SILENCE_MS){ convoEnd("quiet for "+Math.round(CONVO_SILENCE_MS/1000)+" s"); return; }
  convoQuietAt=0; startRec.retried=false; startRec("command"); }
document.addEventListener("visibilitychange",()=>{ if(document.hidden && convo && !IN_APK) convoEnd("app hidden"); });
(function(){ const vb=$("#vb-mic"); if(!vb||$("#vb-mute")) return;
  const b=document.createElement("button"); b.type="button"; b.id="vb-mute"; b.title="Mute the mic (conversation stays open)"; b.setAttribute("aria-pressed","false");
  b.innerHTML='<svg viewBox="0 0 24 24"><rect x="8.5" y="2" width="7" height="13" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/><path class="slash" d="M4 3l16 18"/></svg><span>MUTE</span>';
  vb.parentNode.insertBefore(b, vb);
  b.addEventListener("click",e=>{ e.preventDefault(); setConvoMute(!convoMuted); }); })();
$("#mic-btn").addEventListener("click",talk); $("#vb-mic").addEventListener("click",talk);
$("#dock-core").addEventListener("click",e=>{e.preventDefault(); talk();});
const coreStage=$("#core-stage");
if(coreStage) coreStage.addEventListener("click",()=>{ if(document.body.classList.contains("phone")) talk(); });
$("#t-fs").addEventListener("click",e=>{e.preventDefault(); document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});});
$("#power").addEventListener("click",()=>{ if(document.fullscreenElement) document.exitFullscreen(); });
$("#t-mute").addEventListener("click",e=>{e.preventDefault(); muted=!muted; $("#t-mute-l").textContent=muted?"MUTED":"SOUND"; if(muted){ try{speechSynthesis.cancel();}catch(_){} stopReplyAudio(); } });
$("#t-test").addEventListener("click",async e=>{e.preventDefault(); await cue("online");});
addEventListener("keydown",e=>{ if(e.key==="F2") talk(); });
micUI();

bindSetup();

/* ---------- boot (one click needed for sound + full screen) ---------- */
async function boot(){ const b=$("#boot"); if(b.classList.contains("hide")) return; b.classList.add("hide"); booted=true; acquireWakeLock();
  try{ if(!qs.has("nofs")) await document.documentElement.requestFullscreen(); }catch(e){}
  log("System online"); weather(); if(C.PLAY_STARTUP_GREETING) await speakLine("boot");
  if(SR&&C.WAKE_WORD_ENABLED){ wakeArmed=true; if(mode==="idle") startRec("wake"); } micUI(); }
$("#boot").addEventListener("click",boot);

/* ---------- launch-to-listen v12.5: ?listen=1, the "Talk to JARVIS" app shortcut, or the SETUP option ---------- */
function launchListenPref(){ try{ return localStorage.getItem(LS_LAUNCH)==="1"; }catch(e){ return false; } }
const LAUNCH_FROM_URL=/^(1|true|yes|on)$/i.test(qs.get("listen")||"") || /(^#|&)listen\b/.test(location.hash||"");
const WANT_LISTEN=LAUNCH_FROM_URL || (launchListenPref() && /^(pwa|shortcut)$/.test(qs.get("source")||""));
let launchStarted=0;
function clearListenParam(){ try{ const u=new URL(location.href); if(!u.searchParams.has("listen") && !/listen/.test(u.hash)) return;
  u.searchParams.delete("listen"); u.hash=u.hash.replace(/(^#|&)listen\b(=[^&]*)?/,"$1").replace(/^#&?$/,""); history.replaceState(null,"",u.toString()); }catch(e){} }
// Chrome: an installed PWA on Android may play sound without a tap; a new AudioContext reports "running" when it can.
async function audioAllowed(){ const ac=audioCtx(); if(!ac) return true; if(ac.state==="running") return true;
  try{ await Promise.race([ac.resume(), new Promise(r=>setTimeout(r,350))]); }catch(e){}
  return ac.state==="running"; }
async function micPermission(){ try{ const st=await navigator.permissions.query({name:"microphone"}); return st.state; }catch(e){ return "unknown"; } }
function hideTapTalk(){ const t=$("#tap-talk"); if(t) t.hidden=true; document.body.classList.remove("tap-talk"); }
function showTapTalk(why){ const t=$("#tap-talk"); if(!t) return; t.hidden=false; document.body.classList.add("tap-talk");
  const s=$("#tt-sub"); if(s) s.textContent = why==="mic-denied"?"MICROPHONE IS BLOCKED - CHROME SITE SETTINGS > MICROPHONE":"ONE TAP TO START LISTENING";
  window.__jarvisTapTalk=(window.__jarvisTapTalk||0)+1; log("Tap to talk ("+why+")"); }
// straight into LISTENING: chime, sphere to LISTENING, "I'm listening", then capture the request
function listenNow(){ hideTapTalk(); launchStarted=Date.now(); wakeQuietUntil=Date.now()+1500;
  if(convo && (mode==="command"||mode==="handoff")) return;   // already listening in this conversation
  convoStart("hey jarvis");
  try{ speechSynthesis.cancel(); }catch(e){} stopReplyAudio();
  wakeChime(); mode="handoff"; listening=true; micUI();
  speakLine("ready").then(()=>{ startRec.retried=false; startRec("command");
    const t0=launchStarted; setTimeout(()=>{ if(launchStarted===t0 && !(startRec.okAt>=t0)) showTapTalk("no-mic-start"); },2500); }); }
async function launchListen(){ clearListenParam();
  const b=$("#boot"); if(b) b.classList.add("hide"); booted=true; acquireWakeLock();
  log("System online"); log("Opened to listen"); weather();
  if(SR&&C.WAKE_WORD_ENABLED) wakeArmed=true;
  if(!SR){ toast("SPEECH RECOGNITION NEEDS CHROME"); return; }
  const [mic,audioOk]=await Promise.all([micPermission(), audioAllowed()]);
  window.__jarvisLaunch={mic,audioOk};
  if(mic==="denied"){ showTapTalk("mic-denied"); return; }
  if(mic==="granted" && audioOk) return listenNow();
  showTapTalk(audioOk?"mic-prompt":"audio-gesture"); }
(function(){ const t=$("#tap-talk"); if(!t) return;
  t.addEventListener("click",e=>{ e.preventDefault(); e.stopPropagation(); unlockAudio(); acquireWakeLock(); micBlocked=false; listenNow(); }); })();

/* ---------- phone: card dots for the swipeable panels ---------- */
(function(){ const wrap=$("#m-cards"), dots=$("#m-dots"); if(!wrap||!dots) return; const cards=[...wrap.children];
  dots.innerHTML=cards.map((_,i)=>`<i data-i="${i}"></i>`).join("");
  const upd=()=>{ const i=Math.round(wrap.scrollLeft/Math.max(1,(cards[1]?cards[1].offsetLeft-cards[0].offsetLeft:wrap.clientWidth)));
    [...dots.children].forEach((d,k)=>d.classList.toggle("on",k===i)); };
  wrap.addEventListener("scroll",upd,{passive:true}); upd();
  dots.addEventListener("click",e=>{ const i=e.target.dataset&&e.target.dataset.i; if(i!=null) cards[+i].scrollIntoView({behavior:"smooth",inline:"start",block:"nearest"}); }); })();
if(qs.has("noboot")) log("System online");
if(WANT_LISTEN && !window.__WANT_SETUP) setTimeout(launchListen,0);
(function(){ const v=$("#brand .ver"); const B=window.JARVIS_BUILD||""; if(v&&B) v.textContent="v"+B;
  const am=/JarvisAndroid\/([\d.]+)/.exec(navigator.userAgent); log("Build v"+(B||"?")+(am?" · Android app "+am[1]:"")); })();
window.JARVIS={get build(){return window.JARVIS_BUILD||"";},get history(){return chatHist.slice();},histAdd,openChat,closeChat,linkify,get convo(){return convo;},get convoMuted(){return convoMuted;},setMute:on=>setConvoMute(on),get convoPending(){return convoPending;},startConversation:h=>{ if(!convo){ convoStart(h||"api"); startRec.retried=false; startRec("command"); } },endConversation:w=>convoEnd(w||"api"),get nativeListening(){return nativeLis;},get helmLevel(){return helmLevel;},launchListen:()=>launchListen(),get launchInfo(){return window.__jarvisLaunch||null;},get wantListen(){return WANT_LISTEN;},matchWake:t=>matchWake(t),setWakeWord:(on)=>setWakeWord(on,true),get wakeOn(){return !!C.WAKE_WORD_ENABLED;},get wakeArmed(){return wakeArmed;},get recMode(){return mode;},ingestNtfy:m=>ingestNtfy(m),ntfyPayload,audioParts,openTodo,closeTodo,get todoData(){return todoData;},say,cue,thinkingChime,playUrl,speakLine,onReply,offerAudio,isVoiceLeader,claimVoice,invalidateVoice,pickVariant,dayPart,lines:LINES,noteSentRequest,isAckText,looksLikeTask,ackKind,ensureAckBank,playAck,get ackBank(){return ackBank;},get ackReq(){return ackReq;},get instId(){return instId;},get audioWaitMs(){return AUDIO_WAIT_MS;},get emailWaitMs(){return EMAIL_WAIT_MS;},get inboxSaved(){return inboxSaved;},get emailPending(){return emailPending;},get emailView(){return emailView;},requestInboxList,prefetchInbox,switchInbox,stepInbox,get inboxAccount(){return inboxAcct;},accounts:INBOX_ACCOUNTS,set emailWaitMs(v){EMAIL_WAIT_MS=Math.max(200,Number(v)||EMAIL_WAIT_MS);},isEmailJson,parseEmailJson,handleEmailPayload,openInbox,openEmail,closeInbox,sendRequest,renderData,log,updateLink,startReplies,openSetup,stopReplies,catchUpReplies,acquireWakeLock,releaseWakeLock,applyKeepAwake,get sseOpen(){return sseOpen;},get lastReply(){return lastReply;},get lastSeenId(){return lastSeenId;},get wakeHeld(){return !!(wakeLock||wakeFallback);},get wakeMode(){return wakeLock?"wakelock":(wakeFallback?"fallback":"off");},get keepAwake(){return keepAwakeOn();}};
})();

/* open SETUP automatically when the link has #setup */
if(window.__WANT_SETUP){ const b=document.getElementById("boot"); if(b) b.classList.add("hide"); setTimeout(()=>window.JARVIS&&JARVIS.openSetup(),300); }
