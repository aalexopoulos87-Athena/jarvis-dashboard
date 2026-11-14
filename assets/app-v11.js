/* J.A.R.V.I.S. dashboard - no build step, no external deps. */
(function(){
"use strict";
const C = Object.assign({VOICE_DIRS:["assets/voice/final_Paul_Bettany_AI","assets/voice/clean_Paul_Bettany_AI"],WEBHOOK_URL:"",RESPONSES_URL:"",RESPONSES_POLL_SECONDS:15,RESPONSES_TOPIC:"",SOURCE:"phone",
  DATA_URL:"data.json",DATA_REFRESH_SECONDS:60,WEATHER:null,
  TIMEZONE:"",WAKE_WORD_ON_MOBILE:false,USE_24H:true,WAKE_WORD:"jarvis",WAKE_WORD_ENABLED:true,TTS_PITCH:.85,TTS_RATE:.95,
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
  const ul=$("#log"); const li=document.createElement("li"); li.innerHTML=`<b>${p}</b><span></span>`; li.lastChild.textContent=msg; ul.prepend(li);
  while(ul.children.length>8) ul.lastChild.remove(); }

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
  if(voiceDir) Object.values(CUES).forEach(c=>{ const src=`${voiceDir}/${c}.mp3`; if(!audioCache[src]){ const a=new Audio(); a.preload="auto"; a.src=src; audioCache[src]=a; } });
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
const AUDIO_WAIT_MS=(()=>{ const n=parseInt(qs.get("audiowait")||"",10); return Number.isFinite(n)&&n>=0?Math.min(60000,n):10000; })();
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
async function playExclusiveUrl(url, token){
  if(token!==voiceSeq || !canSpeak() || !url) return false;
  silenceAll();
  if(token!==voiceSeq) return false;
  const a=new Audio(); a.preload="auto"; a.crossOrigin="anonymous";
  hookMedia(a);
  activeMedia=a;
  speaking=true; setBusy();
  vlog({ev:"start",kind:"mp3"});
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
  if(token!==voiceSeq || !canSpeak() || !text || !("speechSynthesis" in window)) return false;
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
    {id:"tod-welcome", text:()=>"Good "+dayPart()+", sir. Welcome back. All systems are online and fully operational."},
    {id:"tod-standby", text:()=>"Good "+dayPart()+", sir. I've completed the boot sequence and I'm standing by."},
    {id:"tod-pleasure", text:()=>"Good "+dayPart()+", sir. A pleasure to see you. Every system is nominal."},
    {id:"order", text:"Welcome back, sir. Everything is in order. I'm ready when you are."},
    {id:"hello", text:"Hello, sir. Boot sequence complete. I'm at your disposal."}
  ],
  ready:[
    {id:"clip", cue:"ready", text:"Sir, I am fully operational and standing by, ready whenever you are."},
    {id:"service", text:"At your service, sir."},
    {id:"here", text:"Yes, sir. I'm here."},
    {id:"listening", text:"I'm listening, sir."},
    {id:"whenever", text:"Ready when you are, sir."},
    {id:"tod", text:()=>"Good "+dayPart()+", sir. Standing by."}
  ],
  error:[
    {id:"clip", cue:"error", text:"Apologies, sir. I'm afraid something has gone wrong."},
    {id:"uplink", text:"Apologies, sir. I couldn't reach the uplink."},
    {id:"through", text:"I'm sorry, sir. That didn't go through."},
    {id:"afraid", text:"I'm afraid that failed, sir."},
    {id:"transmission", text:"Something went wrong with the transmission, sir."},
    {id:"complete", text:"Apologies, sir. I wasn't able to complete that."}
  ]
};
function cueAvailable(name){
  if(!voiceDir||!CUES[name]) return false;
  return !!audioCache[`${voiceDir}/${CUES[name]}.mp3`];
}
async function speakLine(key){
  const bank=LINES[key];
  if(!bank) return cue(key);
  await voiceReady;
  const v=pickVariant(key, bank);
  vlog({ev:"line",key,id:v.id,hasClip:!!(v.cue&&cueAvailable(v.cue))});
  if(v.cue && cueAvailable(v.cue)) return cue(v.cue);
  return say(v.text);
}

const audioWaiters=new Map();
const recentAudio=[];
let lastLocalAck=0;
function isAckText(t){ return /^on it,?\s*sir\.?$/i.test(String(t||"").trim()); }
function shouldSkipAck(text){ return isAckText(text) && (Date.now()-lastLocalAck)<20000; }

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
function offerAudio(msg){
  if(!msg||!msg.url) return;
  if(shouldSkipAck(msg.text) || ttsAlready(msg.text)){
    vlog({ev:"drop-mp3",reason:ttsAlready(msg.text)?"tts-already":"ack",text:msg.text});
    return;
  }
  const arr=audioWaiters.get(msg.text);
  if(arr&&arr.length){ arr[0].finish(msg.url); return; }
  recentAudio.push({text:msg.text,url:msg.url,ts:Date.now()}); if(recentAudio.length>20) recentAudio.shift();
}

async function onReply(text,id,knownUrl){
  lastReply={text,id,ts:Date.now()};
  log("JARVIS: "+text);
  holdStatus("NEW REPLY",false,8000);
  if(shouldSkipAck(text)){ vlog({ev:"skip-ack",text}); return; }
  const arrived=Date.now();
  const primed=knownUrl||takeRecentAudio(text);
  const urlP=primed?Promise.resolve(primed):waitForAudio(text, AUDIO_WAIT_MS);
  return enqueueVoice(async token=>{
    if(token!==voiceSeq || !canSpeak()) return;
    if(!isAckText(text)) await playExclusiveCue("done", token);
    if(token!==voiceSeq || !canSpeak() || !text) return;
    let url=await urlP;
    if(!url) url=takeRecentAudio(text);
    if(token!==voiceSeq || !canSpeak()) return;
    if(ttsAlready(text)){ vlog({ev:"drop-mp3",reason:"tts-already-before-play",text}); return; }
    if(url){ if(await playExclusiveUrl(url, token)) return; }
    if(token!==voiceSeq || !canSpeak()) return;
    url=takeRecentAudio(text);
    if(url){ if(await playExclusiveUrl(url, token)) return; }
    const left=AUDIO_WAIT_MS-(Date.now()-arrived);
    if(left>50){
      url=await waitForAudio(text, left);
      if(token!==voiceSeq || !canSpeak()) return;
      if(url && !ttsAlready(text)){ if(await playExclusiveUrl(url, token)) return; }
    }
    if(token!==voiceSeq || !canSpeak() || ttsAlready(text)) return;
    await playExclusiveTts(text, token);
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
function pickVoice(){ const vs=speechSynthesis.getVoices(); if(!vs.length) return;
  for(const pref of C.TTS_VOICE_PREFERENCE){ const p=pref.toLowerCase();
    const L=v=>String(v.lang||"").toLowerCase().replace("_","-");
    const v=vs.find(v=>v.name.toLowerCase().includes(p)) || (p.includes("-")? (vs.find(v=>L(v)===p && /male|ryan|george|thomas|daniel|arthur/i.test(v.name))||vs.find(v=>L(v)===p)):null);
    if(v){ ttsVoice=v; break; } }
  if(!ttsVoice) ttsVoice=vs.find(v=>/^en/i.test(v.lang))||vs[0];
  $("#gi-tts")&&($("#gi-tts").textContent = ("TTS: "+ttsVoice.name.replace(/Microsoft |Google | Online.*|\(.*\)/g,"")).slice(0,16).toUpperCase()); }
if("speechSynthesis" in window){ pickVoice(); speechSynthesis.onvoiceschanged=pickVoice; } else { const g=$("#gi-tts"); if(g) g.textContent="NO TTS"; }

/* ---------- state helpers ---------- */
let busyReq=false, listening=false, mode="idle";
function setBusy(){ const b=speaking||busyReq||(listening&&mode==="command"); document.body.classList.toggle("busy",b);
  $("#core-sub").textContent = (listening&&mode==="command")?"LISTENING": speaking?"SPEAKING": busyReq?"PROCESSING":"STANDING BY"; }
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
function frame(ts){ const t=STATIC?1.3:ts/1000; const target=(speaking||busyReq||(listening&&mode==="command"))?1:.4; level+=(target-level)*.05;
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
function savedLoc(){ try{ return JSON.parse(localStorage.getItem(LOC_KEY)||"null"); }catch(e){ return null; } }
function saveLoc(l){ localStorage.setItem(LOC_KEY,JSON.stringify(l)); }
async function placeName(lat,lon){ try{ const j=await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)).json();
    const city=j.city||j.locality||j.principalSubdivision||""; return (city+(j.countryCode?", "+j.countryCode:"")).toUpperCase()||"MY LOCATION"; }catch(e){ return "MY LOCATION"; } }
function gps(){ return new Promise(res=>{ if(!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(p=>res({lat:+p.coords.latitude.toFixed(3),lon:+p.coords.longitude.toFixed(3)}),()=>res(null),{timeout:10000,maximumAge:3600000}); }); }
async function locate(ask){ // ask=true only from a tap (boot or SETUP)
  let l=savedLoc(); if(l&&l.lat!=null&&!l.auto) return l;
  if(C.WEATHER&&C.WEATHER.lat!=null) return C.WEATHER;
  let allowed=false; try{ allowed=(await navigator.permissions.query({name:"geolocation"})).state==="granted"; }catch(e){}
  if(ask||allowed){ const g=await gps(); if(g){ l={...g,name:await placeName(g.lat,g.lon),auto:true}; saveLoc(l); return l; } }
  if(l&&l.lat!=null) return l;
  const ip=await ipLoc(); if(ip){ saveLoc(ip); return ip; }   // no GPS: approximate area from the network
  return null; }
async function ipLoc(){ try{ const j=await (await fetch("https://get.geojs.io/v1/ip/geo.json")).json();
    if(!j||j.latitude==null) return null;
    return {lat:+(+j.latitude).toFixed(3),lon:+(+j.longitude).toFixed(3),tz:j.timezone||"auto",
      name:((j.city||j.region||"")+(j.country_code?", "+j.country_code:"")).toUpperCase()||"MY AREA",auto:true}; }catch(e){ return null; } }
async function weather(ask){ const W=await locate(ask);
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
  if(!city){ localStorage.removeItem(LOC_KEY); toast("USING DEVICE LOCATION"); return weather(true); }
  try{ const j=await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(city)}`)).json();
    const r=j.results&&j.results[0]; if(!r){ toast("CITY NOT FOUND"); return; }
    saveLoc({name:(r.name+(r.country_code?", "+r.country_code:"")).toUpperCase(),lat:r.latitude,lon:r.longitude,tz:r.timezone}); toast("WEATHER: "+r.name.toUpperCase()); weather();
  }catch(e){ toast("WEATHER OFFLINE"); } }
async function setupLocation(){ openSetup(); }
weather(false); setInterval(()=>weather(false),15*60*1000);

/* ---------- panels from data.json (served) / data.js (file://) ---------- */
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function renderData(d){ if(!d) return; const ex=/example/i.test(d._note||"")||d.updated==="EXAMPLE"; const w=d.waiting_on_you||[], f=d.fleet_today||[];
  const tag=ex?'<span class="example">EXAMPLE DATA</span>':"";
  $("#wait-n").innerHTML=w.length+tag; $("#fleet-n").innerHTML=f.length+tag;
  $("#wait-list").innerHTML=w.slice(0,5).map(i=>`<li class="${esc(i.priority)}"><span class="ck"></span><span class="tx">${esc(i.title)}</span>${i.tag?`<span class="tg">${esc(i.tag)}</span>`:""}</li>`).join("");
  $("#fleet-list").innerHTML=f.slice(0,4).map(i=>`<li><span class="st ${esc(i.status)}"></span><span class="bn">${esc(i.bot)}</span><span class="tx">${esc(i.summary)}</span></li>`).join(""); }
async function loadData(){ if(location.protocol!=="file:"){ try{ const r=await fetch(C.DATA_URL+"?t="+Date.now(),{cache:"no-store"}); if(r.ok){ renderData(await r.json()); return; } }catch(e){} }
  renderData(window.JARVIS_DATA); }
loadData(); setInterval(loadData,C.DATA_REFRESH_SECONDS*1000);


/* ---------- uplink (ntfy requests topic -> relay -> Chief of Staff) + replies (ntfy SSE) ---------- */
const LS_URL="jarvis_webhook_url", LS_KEY="jarvis_webhook_key", LS_TOPIC="jarvis_replies_topic", LS_REQ="jarvis_requests_topic", LS_SEEN="jarvis_ntfy_seen";
const SOURCE=C.SOURCE||((/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))?"phone":"desktop");
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
  const text=String(data.message||data.body||data.text||"").trim();
  const tags=[].concat(data.tags||[]).map(t=>String(t).toLowerCase());
  const att=data.attachment||null;
  const url=String((att&&(att.url||att.full_url))||data.attachment_url||"").trim();
  const isAudio=tags.includes("jarvis-audio")||String(data.title||"").toLowerCase()==="jarvis-audio"||/\.mp3(\?|$)/i.test(url);
  if(!text&&!url) return null;
  return {id:String(data.id||data.time||text||url), text, isAudio, url};
}
function ingestNtfy(msg){
  if(!msg||ntfySeen.has(msg.id)) return null;
  rememberNtfy(msg.id);
  if(msg.isAudio){ offerAudio(msg); return null; }
  return msg;
}
function stopReplies(){ if(sse){ try{ sse.close(); }catch(e){} sse=null; } sseOpen=false; }
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
  updateLink();
}


/* ---------- keep screen awake + catch up replies when returning ---------- */
const LS_AWAKE="jarvis_keep_awake";
const WAKE_VIDEO_SRC="data:video/mp4;base64,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";
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
    for(const msg of pending){
      let url="";
      const i=leftoverAudio.findIndex(a=>a.text===msg.text&&a.url);
      if(i>=0) url=leftoverAudio.splice(i,1)[0].url;
      await onReply(msg.text, msg.id, url);
    }
    for(const a of leftoverAudio) offerAudio(a);
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

async function sendRequest(text){
  text=(text||"").trim(); if(!text) return;
  const inp=$("#vb-input"); if(inp) inp.value="";
  log("YOU: "+text);
  const req=requestsTopic();
  if(!req){ toast("TAP SETUP TO CONNECT"); log("Not sent — open SETUP and paste the requests channel"); holdStatus("TAP SETUP TO CONNECT",true,5000); return; }
  busyReq=true; setBusy(); holdStatus("TRANSMITTING",false,2000);
  const prog=$("#vb-prog"); if(prog) prog.style.width="100%";
  lastLocalAck=Date.now(); cue("ack");
  const body=JSON.stringify({text,source:SOURCE,ts:Date.now()});
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
  const ds=$("#dock-settings"); if(ds) ds.addEventListener("click",e=>{e.preventDefault(); openSetup();});
  const gear=$("#m-gear"); if(gear) gear.addEventListener("click",e=>{e.preventDefault(); openSetup();});
  const cancel=$("#su-cancel"); if(cancel) cancel.addEventListener("click",e=>{e.preventDefault(); closeSetup();});
  const form=$("#setup-card"); if(form) form.addEventListener("submit",saveSetup);
  const ov=$("#setup"); if(ov) ov.addEventListener("click",e=>{ if(e.target===ov) closeSetup(); });
  const aw=$("#su-awake"); if(aw){ aw.checked=keepAwakeOn(); aw.addEventListener("change",()=>applyKeepAwake(!!aw.checked)); }
  startReplies();
}

/* ---------- speech recognition: mic tile + wake word ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition; let rec=null, wakeArmed=false, micBlocked=false;
const cap=s=>s.toUpperCase();
function micUI(){ $("#p-mic").classList.toggle("listening",listening&&mode==="command");
  $("#mic-state").textContent = mode==="command"?"LISTENING…":"JARVIS ONLINE";
  const mh=$("#m-hint"); if(mh) mh.textContent = !SR?"TYPE BELOW - VOICE INPUT NEEDS CHROME": mode==="command"?"LISTENING… SPEAK YOUR REQUEST":"TAP THE MIC OR THE SPHERE TO TALK";
  $("#mic-hint").textContent = !SR?"VOICE INPUT NEEDS CHROME OR EDGE": mode==="command"?"SPEAK YOUR REQUEST": (C.WAKE_WORD_ENABLED&&!micBlocked?`SAY "${cap(C.WAKE_WORD)}" TO ACTIVATE`:"CLICK THE MIC TO TALK");
  setBusy(); }
function startRec(m){ if(!SR){ toast("SPEECH RECOGNITION NEEDS CHROME OR EDGE"); return; }
  mode=m; try{ rec&&rec.abort(); }catch(e){}
  rec=new SR(); rec.lang="en-GB"; rec.interimResults=true; rec.continuous=(m==="wake"); let finalText="";
  rec.onstart=()=>{listening=true; micUI();};
  rec.onresult=ev=>{ let interim=""; for(let i=ev.resultIndex;i<ev.results.length;i++){ const t=ev.results[i][0].transcript; if(ev.results[i].isFinal) finalText+=t+" "; else interim+=t; }
    micLevel=1; clearTimeout(startRec.t); startRec.t=setTimeout(()=>micLevel=0,400);
    if(m==="command") $("#vb-input").value=(finalText+interim).trim();
    if(m==="wake"){ const all=(finalText+interim), w=C.WAKE_WORD.toLowerCase(), idx=all.toLowerCase().lastIndexOf(w);
      if(idx>=0 && ev.results[ev.results.length-1].isFinal){ const rest=all.slice(idx+w.length).replace(/^[\s,.!?]+/,"").trim(); finalText="";
        if(rest.split(/\s+/).filter(Boolean).length>=2) sendRequest(rest); else { mode="handoff"; rec.abort(); speakLine("ready").then(()=>startRec("command")); } } } };
  rec.onerror=e=>{ if(e.error==="not-allowed"||e.error==="service-not-allowed"||e.error==="audio-capture"){ wakeArmed=false;
      if(m==="command" && !startRec.retried){ startRec.retried=true; askMic().then(ok=>{ if(ok){ micBlocked=false; setTimeout(()=>startRec("command"),250); } else { micBlocked=true; toast("MIC BLOCKED ("+e.error+") - CHROME SITE SETTINGS > MICROPHONE"); } }); return; }
      micBlocked=true; toast("MIC BLOCKED ("+e.error+") - CHROME SITE SETTINGS > MICROPHONE"); } };
  rec.onend=()=>{ listening=false;
    if(m==="command"){ const t=$("#vb-input").value.trim(); mode="idle"; if(t) sendRequest(t); }
    if(mode!=="handoff" && C.WAKE_WORD_ENABLED && wakeArmed){ setTimeout(()=>{ if(mode!=="command"&&mode!=="handoff") startRec("wake"); },speaking?1500:300); }
    else if(mode!=="handoff") mode="idle";
    micUI(); };
  try{ rec.start(); }catch(e){} }
async function askMic(){ try{ if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return false; const st=await navigator.mediaDevices.getUserMedia({audio:true}); st.getTracks().forEach(t=>t.stop()); return true; }catch(err){ return false; } }
function talk(){ try{ speechSynthesis.cancel(); }catch(e){} stopReplyAudio(); startRec.retried=false; setTimeout(()=>startRec("command"),120); }
$("#mic-btn").addEventListener("click",talk); $("#vb-mic").addEventListener("click",talk);
$("#dock-core").addEventListener("click",e=>{e.preventDefault(); talk();});
const coreStage=$("#core-stage");
if(coreStage) coreStage.addEventListener("click",()=>{ if(document.body.classList.contains("phone")) talk(); });
$("#t-fs").addEventListener("click",e=>{e.preventDefault(); document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});});
$("#power").addEventListener("click",()=>{ if(document.fullscreenElement) document.exitFullscreen(); });
$("#t-mute").addEventListener("click",e=>{e.preventDefault(); muted=!muted; $("#t-mute-l").textContent=muted?"MUTED":"SOUND"; if(muted){ try{speechSynthesis.cancel();}catch(_){} stopReplyAudio(); } });
$("#t-test").addEventListener("click",async e=>{e.preventDefault(); await cue("online"); await say("Voice check complete. This is how I will read your replies, sir.");});
addEventListener("keydown",e=>{ if(e.key==="F2") talk(); });
micUI();

bindSetup();

/* ---------- boot (one click needed for sound + full screen) ---------- */
async function boot(){ const b=$("#boot"); if(b.classList.contains("hide")) return; b.classList.add("hide"); acquireWakeLock();
  try{ if(!qs.has("nofs")) await document.documentElement.requestFullscreen(); }catch(e){}
  log("System online"); weather(true); if(C.PLAY_STARTUP_GREETING) await speakLine("boot");
  if(SR&&C.WAKE_WORD_ENABLED){ wakeArmed=true; startRec("wake"); } }
$("#boot").addEventListener("click",boot);

/* ---------- phone: card dots for the swipeable panels ---------- */
(function(){ const wrap=$("#m-cards"), dots=$("#m-dots"); if(!wrap||!dots) return; const cards=[...wrap.children];
  dots.innerHTML=cards.map((_,i)=>`<i data-i="${i}"></i>`).join("");
  const upd=()=>{ const i=Math.round(wrap.scrollLeft/Math.max(1,(cards[1]?cards[1].offsetLeft-cards[0].offsetLeft:wrap.clientWidth)));
    [...dots.children].forEach((d,k)=>d.classList.toggle("on",k===i)); };
  wrap.addEventListener("scroll",upd,{passive:true}); upd();
  dots.addEventListener("click",e=>{ const i=e.target.dataset&&e.target.dataset.i; if(i!=null) cards[+i].scrollIntoView({behavior:"smooth",inline:"start",block:"nearest"}); }); })();
if(qs.has("noboot")) log("System online");
window.JARVIS={say,cue,playUrl,speakLine,onReply,offerAudio,isVoiceLeader,claimVoice,invalidateVoice,pickVariant,dayPart,lines:LINES,markLocalAck:()=>{lastLocalAck=Date.now();},get instId(){return instId;},get audioWaitMs(){return AUDIO_WAIT_MS;},sendRequest,renderData,log,updateLink,startReplies,openSetup,stopReplies,catchUpReplies,acquireWakeLock,releaseWakeLock,applyKeepAwake,get sseOpen(){return sseOpen;},get lastReply(){return lastReply;},get lastSeenId(){return lastSeenId;},get wakeHeld(){return !!(wakeLock||wakeFallback);},get wakeMode(){return wakeLock?"wakelock":(wakeFallback?"fallback":"off");},get keepAwake(){return keepAwakeOn();}};
})();

/* open SETUP automatically when the link has #setup */
if(window.__WANT_SETUP){ const b=document.getElementById("boot"); if(b) b.classList.add("hide"); setTimeout(()=>window.JARVIS&&JARVIS.openSetup(),300); }
