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
async function cue(name){
  await voiceReady; if(muted||!voiceDir||!CUES[name]) return;
  const src=`${voiceDir}/${CUES[name]}.mp3`; const a=audioCache[src]||(audioCache[src]=new Audio(src));
  a.currentTime=0; speaking=true; setBusy();
  await new Promise(res=>{ a.onended=a.onerror=res; a.play().catch(res); });
  speaking=false; setBusy();
}

/* ---------- unlock audio + speech on the first tap (Android/iOS autoplay rules) ---------- */
let unlocked=false;
function unlockAudio(){ if(unlocked) return; unlocked=true;
  try{ const AC=window.AudioContext||window.webkitAudioContext; if(AC){ const ac=new AC(); const b=ac.createBuffer(1,1,22050), s=ac.createBufferSource(); s.buffer=b; s.connect(ac.destination); s.start(0); ac.resume&&ac.resume(); } }catch(e){}
  try{ Object.values(audioCache).forEach(a=>{ a.muted=true; const p=a.play(); if(p) p.then(()=>{a.pause(); a.currentTime=0; a.muted=false;}).catch(()=>{a.muted=false;}); else a.muted=false; }); }catch(e){}
  try{ if("speechSynthesis" in window){ speechSynthesis.resume(); const u=new SpeechSynthesisUtterance(" "); u.volume=0; speechSynthesis.speak(u); } }catch(e){}
  const vu=$("#voice-unlock"); if(vu) vu.hidden=true; }

function showVoiceUnlock(){
  const vu=$("#voice-unlock"); if(!vu) return;
  const need=matchMedia("(pointer:coarse)").matches||/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  vu.hidden=!(need&&!unlocked);
}

["pointerdown","touchend","keydown"].forEach(ev=>addEventListener(ev,unlockAudio,{capture:true,passive:true}));
const vuBtn=$("#voice-unlock"); if(vuBtn) vuBtn.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();unlockAudio();});
showVoiceUnlock();

/* ---------- TTS for arbitrary replies ---------- */
let ttsVoice=null;
function pickVoice(){ const vs=speechSynthesis.getVoices(); if(!vs.length) return;
  for(const pref of C.TTS_VOICE_PREFERENCE){ const p=pref.toLowerCase();
    const L=v=>String(v.lang||"").toLowerCase().replace("_","-");
    const v=vs.find(v=>v.name.toLowerCase().includes(p)) || (p.includes("-")? (vs.find(v=>L(v)===p && /male|ryan|george|thomas|daniel|arthur/i.test(v.name))||vs.find(v=>L(v)===p)):null);
    if(v){ ttsVoice=v; break; } }
  if(!ttsVoice) ttsVoice=vs.find(v=>/^en/i.test(v.lang))||vs[0];
  $("#gi-tts")&&($("#gi-tts").textContent = ("TTS: "+ttsVoice.name.replace(/Microsoft |Google | Online.*|\(.*\)/g,"")).slice(0,16).toUpperCase()); }
if("speechSynthesis" in window){ pickVoice(); speechSynthesis.onvoiceschanged=pickVoice; } else $("#gi-tts").textContent="NO TTS";
function say(text){ if(muted||!("speechSynthesis" in window)||!text) return Promise.resolve();
  return new Promise(res=>{ const u=new SpeechSynthesisUtterance(text); if(ttsVoice) u.voice=ttsVoice; u.pitch=C.TTS_PITCH; u.rate=C.TTS_RATE;
    u.lang=(ttsVoice&&ttsVoice.lang)||"en-GB";
    let done=false; const fin=()=>{ if(done) return; done=true; clearTimeout(guard); speaking=false;setBusy();res(); };
    const guard=setTimeout(fin, 4000+text.length*120);   // Android sometimes never fires onend
    u.onstart=()=>{speaking=true;setBusy();}; u.onend=u.onerror=fin; speechSynthesis.cancel(); speechSynthesis.speak(u); }); }

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

/* ---------- ring decorations ---------- */
const NS="http://www.w3.org/2000/svg"; const eqBars=[];
(function(){ const dots=$("#dots"); [[-60,322],[-5,298],[38,322],[178,285],[-118,262]].forEach(([deg,r])=>{ const a=deg*Math.PI/180;
    const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",350+r*Math.cos(a)); c.setAttribute("cy",350+r*Math.sin(a)); c.setAttribute("r",9); c.setAttribute("fill","#9ae9ff"); dots.appendChild(c); });
  const gt=$("#globe-ticks"); for(let ring=0;ring<3;ring++){ const r=110+ring*36, n=12+ring*6; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+ring*.3;
    const c=document.createElementNS(NS,"circle"); c.setAttribute("cx",350+r*Math.cos(a)); c.setAttribute("cy",350+r*Math.sin(a)); c.setAttribute("r",ring===2?2.2:1.6); c.setAttribute("class","gt"); gt.appendChild(c); } }
  const eq=$("#eq-ring"); for(let i=0;i<120;i++){ const l=document.createElementNS(NS,"line"); l.setAttribute("class","eq"); eq.appendChild(l); eqBars.push(l); } })();

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
  topwave($("#topwave"),.5+.5*act,t); bars($("#micwave"),40,.4+.6*act,t);
  for(let i=0;i<eqBars.length;i++){ const a=i/eqBars.length*Math.PI*2; const v=4+(4+18*act)*Math.abs(Math.sin(i*.5+t*2.4)*Math.cos(i*.17-t*1.3)); const r1=176;
    eqBars[i].setAttribute("x1",(350+r1*Math.cos(a)).toFixed(1)); eqBars[i].setAttribute("y1",(350+r1*Math.sin(a)).toFixed(1));
    eqBars[i].setAttribute("x2",(350+(r1+v)*Math.cos(a)).toFixed(1)); eqBars[i].setAttribute("y2",(350+(r1+v)*Math.sin(a)).toFixed(1)); }
  $("#core-line").setAttribute("stroke-width",(6+3*act*Math.abs(Math.sin(t*4))).toFixed(2));
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
  return l&&l.lat!=null? l : null; }
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


/* ---------- uplink (webhook in localStorage) + replies (ntfy SSE) ---------- */
const LS_URL="jarvis_webhook_url", LS_KEY="jarvis_webhook_key", LS_TOPIC="jarvis_replies_topic", LS_SEEN="jarvis_ntfy_seen";
const SOURCE=C.SOURCE||((/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))?"phone":"desktop");
function consumeTopicFragment(){
  const raw=location.hash||"";
  if(!raw||raw.length<2) return;
  let t="";
  try{ t=(new URLSearchParams(raw[0]==="#"?raw.slice(1):raw).get("topic")||"").trim(); }catch(e){}
  if(!t){ const m=raw.match(/(?:^#|&)topic=([^&]+)/); if(m) try{ t=decodeURIComponent(m[1].replace(/\+/g," ")).trim(); }catch(e){} }
  if(!t){ if(/(^#|&)setup\b/.test(raw)) try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){} return; }
  try{ localStorage.setItem(LS_TOPIC,t); }catch(e){}
  try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){}
}
consumeTopicFragment();
function hookCfg(){ let url="",key=""; try{ url=(localStorage.getItem(LS_URL)||"").trim(); key=(localStorage.getItem(LS_KEY)||"").trim(); }catch(e){} return {url,key}; }
function repliesTopic(){ try{ const t=(localStorage.getItem(LS_TOPIC)||"").trim(); if(t) return t; }catch(e){} return (C.RESPONSES_TOPIC||"").trim(); }
let sse=null, sseOpen=false, lastReply=null, statusHold=false;
function hookReady(){ const {url,key}=hookCfg(); return !!(url&&key); }
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
  try{ data=JSON.parse(ev.data); }catch(e){ const s=String(ev.data).trim(); return s?{id:s,text:s}:null; }
  if(!data||data.event==="open"||data.event==="keepalive") return null;
  const text=String(data.message||data.body||data.text||"").trim();
  if(!text) return null;
  return {id:String(data.id||data.time||text), text};
}
const ntfySeen=new Set((()=>{ try{ return JSON.parse(localStorage.getItem(LS_SEEN)||"[]"); }catch(e){ return []; } })());
function rememberNtfy(id){ ntfySeen.add(id); try{ localStorage.setItem(LS_SEEN,JSON.stringify([...ntfySeen].slice(-400))); }catch(e){} }
async function onReply(text,id){
  lastReply={text,id,ts:Date.now()};
  log("JARVIS: "+text);
  holdStatus("NEW REPLY",false,8000);
  await cue("done");
  await say(text);
}
function stopReplies(){ if(sse){ try{ sse.close(); }catch(e){} sse=null; } sseOpen=false; }
function startReplies(){
  stopReplies();
  const topic=repliesTopic();
  if(!topic||typeof EventSource==="undefined"){ updateLink(); return; }
  try{
    sse=new EventSource("https://ntfy.sh/"+encodeURIComponent(topic)+"/sse");
    sse.onopen=()=>{ sseOpen=true; updateLink(); };
    sse.onerror=()=>{ sseOpen=false; updateLink(); };
    sse.onmessage=ev=>{
      const msg=ntfyPayload(ev); if(!msg) return;
      if(ntfySeen.has(msg.id)) return;
      rememberNtfy(msg.id);
      onReply(msg.text,msg.id);
    };
  }catch(e){ sseOpen=false; }
  updateLink();
}

async function sendRequest(text){
  text=(text||"").trim(); if(!text) return;
  const inp=$("#vb-input"); if(inp) inp.value="";
  log("YOU: "+text);
  const {url,key}=hookCfg();
  if(!url||!key){ toast("TAP SETUP TO CONNECT"); log("Not sent — open SETUP and paste the webhook URL and sender key"); holdStatus("TAP SETUP TO CONNECT",true,5000); return; }
  busyReq=true; setBusy(); holdStatus("TRANSMITTING",false,2000);
  const prog=$("#vb-prog"); if(prog) prog.style.width="100%";
  cue("ack");
  const body=JSON.stringify({text,source:SOURCE,ts:Date.now()});
  const headers=Object.assign({"Content-Type":"application/json","Authorization":"Bearer "+key,"X-Webhook-Key":key}, C.WEBHOOK_HEADERS||{});
  try{
    const r=await fetch(url,{method:"POST",headers,body});
    if(!r.ok) throw new Error("HTTP "+r.status);
    toast("SENT TO CHIEF OF STAFF"); log("Sent to Chief of Staff"); holdStatus("SENT TO CHIEF OF STAFF",false,5000);
  }catch(e){
    try{
      await fetch(url,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain"},body});
      toast("SENT (UNCONFIRMED)"); log("Sent (unconfirmed) to Chief of Staff"); holdStatus("SENT (UNCONFIRMED)",false,5000);
    }catch(e2){
      toast("UPLINK ERROR"); log("Send failed"); holdStatus("UPLINK ERROR",true,5000); cue("error");
    }
  }finally{
    busyReq=false; setBusy(); if(prog) prog.style.width="60%";
  }
}

function openSetup(){
  const ov=$("#setup"); if(!ov) return;
  const {url,key}=hookCfg();
  const u=$("#su-url"),k=$("#su-key"),tp=$("#su-topic"),city=$("#su-city"),cityRow=$("#su-city-row");
  if(u) u.value=url; if(k) k.value=key; if(tp) tp.value=repliesTopic();
  if(cityRow){ const show=typeof setupLocationFromField==="function"; cityRow.hidden=!show;
    if(show&&city){ try{ const l=JSON.parse(localStorage.getItem("jarvis_loc")||"null"); city.value=(l&&!l.auto&&l.name)?l.name:""; }catch(e){ city.value=""; } } }
  ov.hidden=false;
}
function closeSetup(){ const ov=$("#setup"); if(ov) ov.hidden=true; }
async function saveSetup(ev){
  if(ev) ev.preventDefault();
  const url=($("#su-url")&&$("#su-url").value||"").trim();
  const key=($("#su-key")&&$("#su-key").value||"").trim();
  const topic=($("#su-topic")&&$("#su-topic").value||"").trim();
  try{
    if(url) localStorage.setItem(LS_URL,url); else localStorage.removeItem(LS_URL);
    if(key) localStorage.setItem(LS_KEY,key); else localStorage.removeItem(LS_KEY);
    if(topic) localStorage.setItem(LS_TOPIC,topic); else localStorage.removeItem(LS_TOPIC);
  }catch(e){ toast("COULD NOT SAVE ON THIS DEVICE"); return; }
  const cityEl=$("#su-city");
  if(cityEl&&typeof setupLocationFromField==="function") await setupLocationFromField(cityEl.value);
  closeSetup();
  startReplies();
  updateLink();
  toast(hookReady()?"UPLINK SAVED":"SETUP SAVED — WEBHOOK STILL NEEDED");
}
function bindSetup(){
  const vb=$("#voicebar"); if(vb) vb.addEventListener("submit",e=>{e.preventDefault(); sendRequest($("#vb-input").value);});
  const ds=$("#dock-settings"); if(ds) ds.addEventListener("click",e=>{e.preventDefault(); openSetup();});
  const gear=$("#m-gear"); if(gear) gear.addEventListener("click",e=>{e.preventDefault(); openSetup();});
  const cancel=$("#su-cancel"); if(cancel) cancel.addEventListener("click",e=>{e.preventDefault(); closeSetup();});
  const form=$("#setup-card"); if(form) form.addEventListener("submit",saveSetup);
  const ov=$("#setup"); if(ov) ov.addEventListener("click",e=>{ if(e.target===ov) closeSetup(); });
  startReplies();
}

/* ---------- speech recognition: mic tile + wake word ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition; let rec=null, wakeArmed=false, micBlocked=false;
const cap=s=>s.toUpperCase();
function micUI(){ $("#p-mic").classList.toggle("listening",listening&&mode==="command");
  $("#mic-state").textContent = mode==="command"?"LISTENING…":"JARVIS ONLINE";
  const mh=$("#m-hint"); if(mh) mh.textContent = !SR?"TYPE BELOW - VOICE INPUT NEEDS CHROME": mode==="command"?"LISTENING… SPEAK YOUR REQUEST":"TAP THE MIC OR THE RING TO TALK";
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
        if(rest.split(/\s+/).filter(Boolean).length>=2) sendRequest(rest); else { mode="handoff"; rec.abort(); cue("ready").then(()=>startRec("command")); } } } };
  rec.onerror=e=>{ if(e.error==="not-allowed"||e.error==="service-not-allowed"){ wakeArmed=false; micBlocked=true; toast("MICROPHONE BLOCKED - ALLOW MIC ACCESS"); } };
  rec.onend=()=>{ listening=false;
    if(m==="command"){ const t=$("#vb-input").value.trim(); mode="idle"; if(t) sendRequest(t); }
    if(mode!=="handoff" && C.WAKE_WORD_ENABLED && wakeArmed){ setTimeout(()=>{ if(mode!=="command"&&mode!=="handoff") startRec("wake"); },speaking?1500:300); }
    else if(mode!=="handoff") mode="idle";
    micUI(); };
  try{ rec.start(); }catch(e){} }
function talk(){ try{ speechSynthesis.cancel(); }catch(e){} startRec("command"); }
$("#mic-btn").addEventListener("click",talk); $("#vb-mic").addEventListener("click",talk);
$("#dock-core").addEventListener("click",e=>{e.preventDefault(); talk();});
$("#ring").addEventListener("click",()=>{ if(document.body.classList.contains("phone")) talk(); });
$("#t-fs").addEventListener("click",e=>{e.preventDefault(); document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});});
$("#power").addEventListener("click",()=>{ if(document.fullscreenElement) document.exitFullscreen(); });
$("#t-mute").addEventListener("click",e=>{e.preventDefault(); muted=!muted; $("#t-mute-l").textContent=muted?"MUTED":"SOUND"; if(muted) try{speechSynthesis.cancel();}catch(_){} });
$("#t-test").addEventListener("click",async e=>{e.preventDefault(); await cue("online"); await say("Voice check complete. This is how I will read your replies, sir.");});
addEventListener("keydown",e=>{ if(e.key==="F2") talk(); });
micUI();

bindSetup();

/* ---------- boot (one click needed for sound + full screen) ---------- */
async function boot(){ const b=$("#boot"); if(b.classList.contains("hide")) return; b.classList.add("hide");
  try{ if(!qs.has("nofs")) await document.documentElement.requestFullscreen(); }catch(e){}
  log("System online"); weather(true); if(C.PLAY_STARTUP_GREETING) await cue("boot");
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
window.JARVIS={say,cue,sendRequest,renderData,log,updateLink,startReplies,openSetup,get sseOpen(){return sseOpen;},get lastReply(){return lastReply;}};
})();

/* open SETUP automatically when the link has #setup */
if(window.__WANT_SETUP){ const b=document.getElementById("boot"); if(b) b.classList.add("hide"); setTimeout(()=>window.JARVIS&&JARVIS.openSetup(),300); }
