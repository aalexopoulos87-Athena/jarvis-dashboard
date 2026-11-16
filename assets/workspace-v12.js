/* v12.11 JARVIS workspace: calendar strip, spoken morning brief, drafts approval, real task list.
   Talks to the relay through the same requests topic as the inbox; replies arrive as JARVIS_EMAIL_JSON with new types
   (calendar_list, drafts_list, draft_result, tasks), which app-v12.js hands to JW.onData (never spoken, never in chat).
   SAFETY: a draft is only ever sent after APPROVE -> "Send to X?" -> SEND on that one draft. The request carries the draft id,
   mailbox and content hash; the relay and the routine both re-check the hash before anything goes out. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const TZ="Europe/Athens";
const LS_CAL="jarvis_cal_v1", LS_TASKS="jarvis_tasks_v1", LS_DRAFTS="jarvis_drafts_v1", LS_BRIEF="jarvis_brief_day", LS_AUTO="jarvis_auto_brief";
const TYPES=new Set(["calendar_list","drafts_list","draft_result","tasks","drafts_raw"]);
const J=()=>window.JARVIS||{};
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ld=k=>{ try{ return JSON.parse(localStorage.getItem(k)||"null"); }catch(e){ return null; } };
const sv=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
const st={cal:ld(LS_CAL), tasks:ld(LS_TASKS), drafts:ld(LS_DRAFTS), view:"", cur:null, confirm:null, sending:null, calAt:0, log:[]};
function wlog(e){ try{ st.log.push(Object.assign({t:Date.now()},e)); if(st.log.length>100) st.log.shift(); }catch(_){} }

/* ---------- uplink ---------- */
function topic(){ try{ return (J().requestsTopic&&J().requestsTopic())||""; }catch(e){ return ""; } }
async function post(p,quiet){
  const t=topic(); if(!t){ if(!quiet) toast("TAP SETUP TO CONNECT"); return false; }
  const body=Object.assign({source:(J().source||"phone"),ts:Date.now(),v:String(self.JARVIS_BUILD||""),cap:"workspace"},p);
  try{ const r=await fetch("https://ntfy.sh/"+encodeURIComponent(t),{method:"POST",body:JSON.stringify(body)}); if(!r.ok) throw new Error("HTTP "+r.status); wlog({ev:"post",type:p.type}); return true; }
  catch(e){ wlog({ev:"post-fail",type:p.type}); if(!quiet) toast("UPLINK ERROR"); return false; }
}
function toast(t){ const el=$("#toast"); if(!el) return; el.textContent=t; el.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove("show"),3200); }

/* ---------- time helpers ---------- */
const fmt=(o)=>new Intl.DateTimeFormat("en-GB",Object.assign({timeZone:TZ},o));
function dayKey(d){ return fmt({year:"numeric",month:"2-digit",day:"2-digit"}).format(d); }
function evDate(e){ const s=String(e.start||""); return new Date(s.length===10? s+"T00:00:00+02:00" : s); }
function dayLabel(d){ const now=new Date(), k=dayKey(d); if(k===dayKey(now)) return "TODAY"; if(k===dayKey(new Date(now.getTime()+864e5))) return "TOMORROW";
  return fmt({weekday:"short",day:"2-digit"}).format(d).toUpperCase(); }
function hhmm(d){ return fmt({hour:"2-digit",minute:"2-digit",hour12:false}).format(d); }
function ago(sec){ if(!sec) return ""; const m=Math.round((Date.now()/1000-sec)/60); return m<1?"JUST NOW":m<60?m+" MIN AGO":m<1440?Math.round(m/60)+" H AGO":Math.round(m/1440)+" D AGO"; }

/* ---------- calendar strip ---------- */
function renderCal(){
  const el=$("#cal-strip"); if(!el) return;
  const d=st.cal; const now=Date.now();
  const evs=((d&&d.events)||[]).filter(e=>{ const s=evDate(e); const en=e.end?evDate({start:e.end}):s; return isFinite(s) && (en.getTime()>=now-60e3 || (e.all_day && dayKey(s)===dayKey(new Date()))); })
    .sort((a,b)=>evDate(a)-evDate(b)).slice(0,8);
  const chips=[]; const today=dayKey(new Date());
  if(!evs.some(e=>dayKey(evDate(e))===today)) chips.push(`<li class="cs-chip cs-clear"><b>TODAY</b><span>CLEAR</span></li>`);
  for(const e of evs){ const s=evDate(e);
    chips.push(`<li class="cs-chip${dayKey(s)===today?" cs-today":""}" title="${esc(e.title)}${e.location?" · "+esc(e.location):""}"><b>${dayLabel(s)}</b>${e.all_day?"<i>ALL DAY</i>":`<i>${hhmm(s)}</i>`}<span>${esc(e.title)}</span></li>`); }
  if(!d) chips.length=0, chips.push(`<li class="cs-chip cs-clear"><b>CALENDAR</b><span>SYNCING…</span></li>`);
  el.querySelector("ol").innerHTML=chips.join("");
  el.classList.toggle("cs-setup", !!(d&&d.feed==="pending_setup"));
  el.title=d&&d.as_of?("Calendar updated "+ago(d.as_of).toLowerCase()):"";
}
function requestCal(force){ if(!force && Date.now()-st.calAt<60e3) return; st.calAt=Date.now(); post(Object.assign({type:"calendar_list"},force?{refresh:1}:{}),true); }

/* ---------- panel (drafts / tasks) ---------- */
let hideT=0;
function panel(){ return $("#ws-panel"); }
function openPanel(view){
  const p=panel(); if(!p) return;
  try{ J().closeInbox&&(()=>{ const ep=$("#email-panel"); if(ep&&!ep.hidden) J().closeInbox(); })(); }catch(e){}
  try{ J().closeChat&&J().closeChat(); }catch(e){} try{ J().closeTodo&&J().closeTodo(); }catch(e){}
  clearTimeout(hideT); p.classList.remove("ws-closing"); document.body.classList.add("ws-open");
  if(p.hidden){ p.hidden=false; void p.offsetWidth; }
  p.classList.add("ws-open-p"); st.view=view; st.cur=null; st.confirm=null; render(); wlog({ev:"open",view});
}
function closePanel(){
  const p=panel(); if(!p||p.hidden){ document.body.classList.remove("ws-open"); return; }
  p.classList.remove("ws-open-p"); p.classList.add("ws-closing"); st.view=""; st.confirm=null;
  clearTimeout(hideT); hideT=setTimeout(()=>{ if(!p.classList.contains("ws-closing")) return; p.hidden=true; p.classList.remove("ws-closing"); document.body.classList.remove("ws-open"); },
    (window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)?140:640);
}
function setHead(kicker,title,status){ $("#ws-kicker").textContent=kicker; $("#ws-title").textContent=title; $("#ws-status").textContent=status||""; }
function render(){
  if(st.view==="drafts") return st.cur?renderDraft():renderDrafts();
  if(st.view==="tasks") return renderTasks();
}

/* ---------- drafts ---------- */
const MB={default:"MAIN",dspy:"DSPY",godpack:"GODPACK",cartamagica:"CARTA MAGICA",box:"BOX NOTE"};
function draftsList(){ return ((st.drafts&&st.drafts.drafts)||[]); }
function renderDrafts(){
  const d=st.drafts; const list=draftsList();
  setHead("PENDING YOUR APPROVAL","DRAFTS", d? ((list.length?list.length+" DRAFTS":"NO DRAFTS")+" · UPDATED "+ago(d.as_of)+(d.refreshing?" · SYNCING…":"")+(d.approve_ready?"":" · APPROVE PENDING SETUP")) : "LOADING…");
  $("#ws-back").hidden=true; $("#ws-refresh").hidden=false;
  const body=$("#ws-body");
  if(!d){ body.innerHTML=`<p class="ws-empty">REQUESTING DRAFTS…</p>`; return; }
  if(!list.length){ body.innerHTML=`<p class="ws-empty">NO DRAFTS WAITING, SIR.</p>`; return; }
  body.innerHTML=`<ul class="ws-list">`+list.map((x,i)=>`<li class="ws-row${x.blocked?" ws-blocked":""}" data-i="${i}" tabindex="0" role="button">
    <div class="ws-r1"><em class="ws-mb">${esc(MB[x.mailbox]||x.mailbox)}</em><span class="ws-to">${x.to?("TO "+esc(x.to)):(x.mailbox==="box"?"":"NO RECIPIENT")}</span><time>${x.date?esc(dayLabel(new Date(x.date))):""}</time></div>
    <div class="ws-subj">${esc(x.subject||"(no subject)")}</div>
    <div class="ws-snip">${esc(String(x.body||"").slice(0,110))}</div>${x.blocked?`<div class="ws-why">${esc(x.blocked)}</div>`:""}</li>`).join("")+`</ul>`;
  body.querySelectorAll(".ws-row").forEach(li=>li.addEventListener("click",()=>{ st.cur=list[+li.dataset.i]; st.confirm=null; render(); }));
}
function approveState(x){
  if(x.blocked) return {can:false,label:x.mailbox==="box"?"NOT A GMAIL DRAFT":"CAN'T APPROVE"};
  if(!(st.drafts&&st.drafts.approve_ready)) return {can:false,label:"APPROVE · PENDING SETUP"};
  return {can:true,label:"APPROVE & SEND"};
}
function renderDraft(){
  const x=st.cur; setHead(MB[x.mailbox]||"DRAFT", "DRAFT", st.sending&&st.sending.id===x.id?st.sending.msg:"");
  $("#ws-back").hidden=false; $("#ws-refresh").hidden=true;
  const a=approveState(x);
  const atts=(x.attachments||[]).length?`<div class="ws-kv"><span>ATTACHED</span><b>${esc(x.attachments.join(", "))}</b></div>`:"";
  $("#ws-body").innerHTML=`<article class="ws-draft">
    <div class="ws-kv"><span>FROM</span><b>${esc(x.from)}</b></div>
    <div class="ws-kv"><span>TO</span><b>${esc(x.to||"—")}</b></div>${x.cc?`<div class="ws-kv"><span>CC</span><b>${esc(x.cc)}</b></div>`:""}${x.bcc?`<div class="ws-kv"><span>BCC</span><b>${esc(x.bcc)}</b></div>`:""}
    <div class="ws-kv"><span>SUBJECT</span><b>${esc(x.subject||"(no subject)")}</b></div>${atts}
    <pre class="ws-text">${esc(x.body||"")}</pre>
    ${x.blocked?`<div class="ws-why">${esc(x.blocked)}</div>`:""}
    <footer class="ws-actions"><button type="button" id="ws-approve" ${a.can?"":"disabled"} class="${a.can?"":"ws-pending"}">${a.label}</button></footer>
    ${st.confirm?`<div class="ws-confirm" role="alertdialog" aria-labelledby="ws-cq"><div class="ws-cq" id="ws-cq">Send to ${esc(x.to)}?</div>
      <div class="ws-cs">${esc(x.cc?("CC "+x.cc+" · "):"")}FROM ${esc(x.from)}<br>${esc(x.subject||"(no subject)")}</div>
      <div class="ws-cb"><button type="button" id="ws-cancel">CANCEL</button><button type="button" id="ws-send">SEND</button></div></div>`:""}
  </article>`;
  const ap=$("#ws-approve"); if(ap&&a.can) ap.addEventListener("click",()=>{ st.confirm={id:x.id,at:Date.now()}; render(); });
  const c=$("#ws-cancel"); if(c) c.addEventListener("click",()=>{ st.confirm=null; render(); });
  const s=$("#ws-send"); if(s) s.addEventListener("click",()=>sendApproved(x));
}
async function sendApproved(x){
  if(!st.confirm||st.confirm.id!==x.id) return;
  st.confirm=null; st.sending={id:x.id,msg:"SENDING FOR APPROVAL…"}; render();
  const ok=await post({type:"draft_approve",id:x.id,mailbox:x.mailbox,h:x.h,confirm:1});
  if(!ok){ st.sending={id:x.id,msg:"UPLINK ERROR · NOTHING SENT"}; render(); }
  wlog({ev:"approve",mailbox:x.mailbox});
}
function onDraftResult(d){
  const msg=d.ok? (d.sent?"SENT ✓":"APPROVED · CHIEF OF STAFF IS SENDING IT") : (d.pending_setup?"APPROVE IS PENDING SETUP · NOTHING WAS SENT":("NOT SENT · "+String(d.error||"").toUpperCase()));
  st.sending={id:d.id,msg}; toast(d.ok?(d.sent?"DRAFT SENT":"DRAFT APPROVED"):"NOT SENT");
  if(d.sent && st.drafts){ st.drafts.drafts=draftsList().filter(x=>!(x.id===d.id&&x.mailbox===d.mailbox)); sv(LS_DRAFTS,st.drafts); }
  if(st.view==="drafts") render(); updateBadges();
}

/* ---------- tasks ---------- */
function taskList(){ return (st.tasks&&st.tasks.tasks)||[]; }
function renderTasks(){
  const all=taskList(), open=all.filter(t=>!t.done), done=all.filter(t=>t.done).slice(-6).reverse();
  setHead("SYNCED ON THE BOX","TASKS", st.tasks?(open.length+" OPEN · SAY \"ADD A TASK …\""):"LOADING…");
  $("#ws-back").hidden=true; $("#ws-refresh").hidden=false;
  const row=t=>`<li class="ws-task${t.done?" ws-done":""}"><label><input type="checkbox" data-id="${esc(t.id)}" ${t.done?"checked":""}><span>${esc(t.text)}</span></label></li>`;
  $("#ws-body").innerHTML=`<form class="ws-add" autocomplete="off"><input id="ws-new" maxlength="200" placeholder="Add a task…" aria-label="New task"><button type="submit">ADD</button></form>
    <ul class="ws-tasks">${open.map(row).join("")||`<li class="ws-empty">${st.tasks?"NOTHING OPEN, SIR.":"REQUESTING YOUR LIST…"}</li>`}</ul>
    ${done.length?`<div class="ws-sub">DONE</div><ul class="ws-tasks">${done.map(row).join("")}</ul>`:""}`;
  $("#ws-body .ws-add").addEventListener("submit",e=>{ e.preventDefault(); const i=$("#ws-new"); const v=(i.value||"").trim(); if(!v) return;
    i.value=""; addTask(v); });
  $("#ws-body").querySelectorAll("input[type=checkbox]").forEach(cb=>cb.addEventListener("change",()=>toggleTask(cb.dataset.id,cb.checked)));
}
function addTask(text){
  const tmp={id:"tmp"+Date.now(),text,done:false,pending:1}; if(!st.tasks) st.tasks={tasks:[]};
  st.tasks.tasks.push(tmp); render(); updateBadges(); post({type:"task_add",text});
}
function toggleTask(id,done){ const t=taskList().find(x=>x.id===id); if(t){ t.done=done; render(); updateBadges(); } post({type:"task_done",id,done:done?1:0}); }

/* ---------- brief ---------- */
function athensHM(){ const p={}; fmt({hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()).forEach(x=>p[x.type]=x.value); return [+p.hour%24,+p.minute]; }
function brief(auto){
  if(!auto){ try{ J().noteSentRequest&&J().noteSentRequest(); }catch(e){} toast("MORNING BRIEF"); }
  sv(LS_BRIEF,dayKey(new Date()));
  return post(auto?{type:"brief",auto:1}:{type:"brief"},!!auto);
}
function maybeAutoBrief(){
  try{ if(localStorage.getItem(LS_AUTO)==="0") return; }catch(e){}
  if(ld(LS_BRIEF)===dayKey(new Date())) return;
  const [h,m]=athensHM(); if(h<6||(h===6&&m<30)||h>=12) return;   // first open after 06:30, mornings only
  let tries=0;
  const go=()=>{ tries++;
    const boot=$("#boot"); const booting=boot && !boot.classList.contains("hide") && getComputedStyle(boot).display!=="none";
    const busy=document.body.classList.contains("busy")||document.body.classList.contains("listening");
    if(document.hidden||booting||busy||!topic()){ if(tries<40) setTimeout(go,3000); return; }
    wlog({ev:"auto-brief"}); brief(true); };
  setTimeout(go,4000);
}

/* ---------- data from the relay ---------- */
function onData(d){
  if(!d||!TYPES.has(d.type)) return false;
  wlog({ev:"data",type:d.type});
  if(d.type==="calendar_list"){ if(Array.isArray(d.events)){ st.cal=d; sv(LS_CAL,d); renderCal(); } return true; }
  if(d.type==="tasks"){ if(Array.isArray(d.tasks)){ st.tasks=d; sv(LS_TASKS,d); if(st.view==="tasks") render(); updateBadges(); } return true; }
  if(d.type==="drafts_list"){ if(Array.isArray(d.drafts)){ st.drafts=d; sv(LS_DRAFTS,d);
      if(st.cur){ const n=draftsList().find(x=>x.id===st.cur.id&&x.mailbox===st.cur.mailbox); if(n&&n.h===st.cur.h) st.cur=n; else if(st.view==="drafts"){ st.cur=null; st.confirm=null; toast("DRAFT CHANGED · CHECK IT AGAIN"); } }
      if(st.view==="drafts") render(); updateBadges(); } return true; }
  if(d.type==="draft_result"){ onDraftResult(d); return true; }
  return true;   // drafts_raw: relay-only
}
function updateBadges(){
  const nd=draftsList().filter(x=>x.mailbox!=="box").length, nt=taskList().filter(t=>!t.done).length;
  const a=$("#ws-drafts-n"), b=$("#ws-tasks-n"); if(a){ a.textContent=nd||""; a.hidden=!nd; } if(b){ b.textContent=nt||""; b.hidden=!nt; }
}

/* ---------- wiring ---------- */
function bind(){
  const on=(id,f)=>{ const el=document.getElementById(id); if(el) el.addEventListener("click",e=>{ e.preventDefault(); e.stopPropagation(); f(); }); };
  on("brief-btn",()=>brief(false));
  on("drafts-btn",()=>{ if(st.view==="drafts") return closePanel(); openPanel("drafts"); post({type:"drafts_list"},true); });
  on("tasks-btn",()=>{ if(st.view==="tasks") return closePanel(); openPanel("tasks"); post({type:"task_list"},true); });
  on("ws-close",closePanel); on("ws-back",()=>{ st.cur=null; st.confirm=null; render(); });
  on("ws-refresh",()=>{ if(st.view==="drafts"){ post({type:"drafts_list",refresh:1}); if(st.drafts) st.drafts.refreshing=1; render(); } else post({type:"task_list"}); });
  const cs=$("#cal-strip"); if(cs) cs.addEventListener("click",()=>{ requestCal(true); toast("CALENDAR · SYNCING"); });
  document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&st.view) closePanel(); });
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden){ requestCal(false); post({type:"task_list"},true); maybeAutoBrief(); } });
  renderCal(); updateBadges();
  setTimeout(()=>{ requestCal(false); post({type:"task_list"},true); post({type:"drafts_list"},true); },2500);
  setInterval(()=>{ if(!document.hidden) requestCal(false); renderCal(); },15*60e3);
  setInterval(renderCal,60e3);
  maybeAutoBrief();
}
window.JW={onData,handles:d=>!!(d&&TYPES.has(d.type)),openDrafts:()=>{ openPanel("drafts"); post({type:"drafts_list"},true); },openTasks:()=>{ openPanel("tasks"); post({type:"task_list"},true); },
  close:closePanel,brief,requestCal,get state(){return st;},get log(){return st.log;}};
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",bind); else bind();
})();
