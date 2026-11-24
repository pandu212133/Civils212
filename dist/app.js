'use strict';
const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const byId = id => document.getElementById(id);
const regions = ['All regions','Andhra Pradesh','India','World'];
const lenses = {
  Geography:['GS I · Physical and human geography','Group I · History, culture and geography','Locate the place on a blank map. Which river basin, coast, border or landform helps explain the event?'],
  Governance:['GS II · Polity and governance','Group I · Polity, constitution and governance','Identify the responsible institution and distinguish its legal power from its implementation role.'],
  Economy:['GS III · Economic development','Group I · Economy and development','Trace who funds the intervention, who benefits and which indicator would measure the outcome.'],
  Environment:['GS III · Environment and disaster management','Group I · Geography and environmental issues','Identify the ecosystem, pressure and response. Which institution can act, and at what scale?'],
  Science:['GS III · Science and technology','Group I · Science and technology','Explain the underlying principle, one public application and one implementation constraint.'],
  'International relations':['GS II · International relations','Group I · Current events of international importance','Locate the actors and identify their interests. How might an Indian policymaker assess the outcome?'],
  Ethics:['GS IV · Ethics and integrity','Group I · Ethics in public service','Identify the stakeholders, conflicting duties and a defensible administrative response.'],
  History:['GS I · History and culture','Group I · History, culture and geography','Place the event on a timeline and distinguish contemporary evidence from later interpretations.'],
  'General studies':['Prelims · Current events','Group I · Current events','Identify one verifiable fact and explain its public-policy significance in two sentences.']
};
const state = {view:'Brief', region:regions[0], topic:'All topics', day:'All dates', studies:[], brief:{items:[],sources:[]}, saved:[], answers:{}, open:new Set()};
try { state.saved = JSON.parse(localStorage.getItem('civic-atlas-saved-v1') || '[]'); if (!Array.isArray(state.saved)) state.saved=[]; } catch {}
const button = (label, click, cls) => {
  const b=el('button',label,cls); b.type='button'; b.addEventListener('click',click); return b;
};
function link(label, url) {
  const a=el('a',label);
  try { const parsed=new URL(url); if(parsed.protocol==='https:'){a.href=parsed.href; a.target='_blank'; a.rel='noopener noreferrer';} } catch {}
  return a;
}
function para(parent,title,body){if(body){parent.append(el('h3',title),el('p',body));}}
function pretty(date){if(!date)return 'Date unavailable'; const d=new Date(date.length===10?date+'T12:00:00+05:30':date);return Number.isNaN(+d)?'Date unavailable':d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'});}
function comparison(trap,correction){
  const table=el('table'),head=table.createTHead().insertRow(),row=table.createTBody().insertRow();
  for(const name of ['UPSC trap','How to eliminate it'])head.append(el('th',name));
  row.insertCell().textContent=trap;row.insertCell().textContent=correction;return table;
}
function save(item,kind,b){
  const key=kind+'|'+(item.id||item.title);
  const found=state.saved.some(s=>s.key===key);
  const next=found?state.saved.filter(s=>s.key!==key):[{key,kind,item},...state.saved];
  try {localStorage.setItem('civic-atlas-saved-v1',JSON.stringify(next));}catch{byId('status').textContent='Your browser could not store this bookmark.';return;}
  state.saved=next;
  if(state.view==='Saved'){render();return;}
  b.textContent=found?'Save for revision':'Saved · Remove';b.setAttribute('aria-pressed',String(!found));
}
function quiz(box,item){
  para(box,'Prelims practice',item.question);
  const opts=el('div',undefined,'options'),feedback=el('div',undefined,'feedback');feedback.setAttribute('aria-live','polite');
  const display=idx=>{
    [...opts.children].forEach((btn,i)=>btn.setAttribute('aria-pressed',String(idx===i)));
    feedback.replaceChildren(el('strong',idx===item.answer?'Correct.':'Review the answer.'),el('p','Answer '+String.fromCharCode(65+item.answer)+'. '+item.options[item.answer]));
    const ul=el('ul');item.why.forEach((v,i)=>ul.append(el('li',String.fromCharCode(65+i)+'. '+v)));feedback.append(ul);
  };
  item.options.forEach((opt,i)=>opts.append(button(String.fromCharCode(65+i)+'. '+opt,()=>{state.answers[item.title]=i;display(i);})));
  box.append(opts,feedback);if(item.title in state.answers)display(state.answers[item.title]);
}
function card(item,kind){
  const study=kind==='study',article=el('article'),top=el('div',undefined,'metarow'),d=el('details',undefined,study?'study':'story'),box=el('div',undefined,'detail');
  top.append(el('span',item.region,'tag'),el('span',study?item.difficulty:pretty(item.date),'date'));
  const key=kind+'|'+(item.id||item.title);
  d.open=state.open.has(key); d.addEventListener('toggle',()=>{if(d.open)state.open.add(key);else state.open.delete(key);});
  d.append(el('summary',item.title),box);
  const lens=lenses[item.topic]||lenses['General studies'];
  if(study){para(box,'Core concept',item.concept);para(box,'Context',item.context);}
  else{para(box,'Source brief',item.summary||'Headline only. Open the linked coverage and confirm exam facts against an official release.');}
  para(box,study?'Syllabus link':'Suggested syllabus link',lens[0]+' · '+lens[1]);
  if(study){
    para(box,'Map or timeline cue',item.map);para(box,'Two-minute recall',item.recall);box.append(comparison(item.trap,item.correction));
    quiz(box,item);para(box,'Mains practice',item.mains);
  } else {
    para(box,'Two-minute recall',lens[2]);
    const matching=state.studies.find(s=>s.topic===item.topic);
    if(matching){box.append(button('Practise '+matching.title,()=>{state.view='Practice';state.region='All regions';state.topic=matching.topic;state.open.add('study|'+matching.title);render();byId('heading').scrollIntoView();},'action'));}
  }
  const actions=el('div',undefined,'actions'),saved=state.saved.some(s=>s.key===key);
  const b=button(saved?'Saved · Remove':'Save for revision',()=>save(item,kind,b),'action');b.setAttribute('aria-pressed',String(saved));
  actions.append(b,link(item.source?.startsWith('Google News')?'Open publisher coverage':'Read official source',item.url));box.append(actions);if(typeof localStudyActions==='function')box.append(localStudyActions(item));article.append(top,d,el('div',study?item.topic+' · Original practice':item.source+' · '+item.topic,'meta'));
  return article;
}
function dailyRecall(region,topic){
  const stories=state.brief.items.filter(i=>(region==='All regions'||i.region===region)&&(topic==='All topics'||topic===i.topic)&&i.summary);
  if(!stories.length)return null;
  const panel=el('section',undefined,'panel');
  panel.append(el('small','FROM THE BRIEF'),el('h3','Daily recall drill'));
  const picks=[];
  for(const name of regions.slice(1)){
    const pool=stories.filter(i=>i.region===name);
    if(!pool.length)continue;
    const latest=pool[0].date;
    const sameDay=pool.filter(i=>i.date===latest);
    const index=Math.floor(Date.now()/86400000)%sameDay.length;
    picks.push(sameDay[index]);
  }
  let position=0;
  const place=el('div');
  function show(){
    const story=picks[position], lens=lenses[story.topic]||lenses['General studies'];
    const reveal=el('details',undefined,'study');
    reveal.append(el('summary','Check your recall'),el('p',story.summary),link('Verify with the publisher',story.url));
    place.replaceChildren(el('p',story.region+' · '+pretty(story.date),'meta'),el('strong',story.title),el('p','Recall one detail from the report. '+lens[2]),reveal);
    if(picks.length>1)place.append(button('Next region',()=>{position=(position+1)%picks.length;show();},'action'));
  }
  show();panel.append(place);return panel;
}
function sourcePanel(){
  const p=el('div',undefined,'panel');
  p.append(el('h3','Edition status'),el('p',state.brief.checkedAt?'Last collection attempt: '+pretty(state.brief.checkedAt):'Starter edition with dated official reports. Open online to check the official feeds.'));
  for(const s of state.brief.sources)p.append(el('p',s.name+' · '+s.status+(typeof s.count==='number'?' · '+s.count+' items':'')));
  p.append(el('h3','Previous-year papers'),el('p','After a study card, find a past question on the same subject and compare how the examiner frames the options. The practice desk contains original questions.'));
  p.append(link('UPSC question papers','https://upsc.gov.in/examinations/previous-question-papers'),document.createTextNode('  ·  '),link('APPSC previous papers','https://psc.ap.gov.in/'));
  para(p,'Reading the edition','Dates beside headlines are publication dates. Syllabus suggestions use topic rules. Bookmarks stay on this device.');
  p.append(button('Check for a newer edition',()=>load(true),'action'));return p;
}
function render(){
  const {view,region,topic}=state,content=byId('content');content.replaceChildren();
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  byId('heading').textContent={Brief:'Briefing desk',Practice:'Practice desk',Saved:'Saved for revision',Sources:'Sources & editions'}[view];
  byId('kicker').textContent={Brief:'READING ROOM',Practice:'ACTIVE RECALL',Saved:'YOUR NOTEBOOK',Sources:'REFERENCE DESK'}[view];
  byId('topic').hidden=view==='Sources';byId('topic').value=topic;
  byId('daybar').hidden=view!=='Brief';
  const filters=document.querySelector('.regions');filters.hidden=view==='Sources';filters.replaceChildren();
  if(view!=='Sources')for(const r of regions){const b=button(r,()=>{state.region=r;render();});b.setAttribute('aria-pressed',String(r===region));filters.append(b);}
  if(view==='Sources'){byId('status').textContent='';content.append(sourcePanel());return;}
  let list=view==='Saved'?state.saved:view==='Practice'?state.studies.map(item=>({item,kind:'study'})):state.brief.items.map(item=>({item,kind:'story'}));
  list=list.filter(({item})=>(view!=='Brief'||state.day==='All dates'||item.date===state.day)&&(region==='All regions'||region===item.region)&&(topic==='All topics'||topic===item.topic));
  const age=state.brief.checkedAt?(Date.now()-Date.parse(state.brief.checkedAt))/86400000:0;
  const prefix=view==='Brief'?(state.brief.checkedAt?(age>2?'Archived edition · checked ':'Last checked ')+pretty(state.brief.checkedAt):'Starter edition')+' · ':'';
  byId('status').textContent=prefix+list.length+' '+(view==='Brief'?'report':view==='Practice'?'study card':'saved item')+(list.length===1?'':'s');
  if(view==='Practice'){const drill=dailyRecall(region,topic);if(drill)content.append(drill);}
  list.forEach(({item,kind})=>content.append(card(item,kind)));
  if(!list.length)content.append(el('div',view==='Saved'?'Open a report or study card and tap “Save for revision”. Saved items appear under their region and topic.':'No entries match this selection. Try another region or choose All topics.','panel'));
}
async function load(manual=false){
  try{
    const seed=JSON.parse(byId('starter').textContent);
    let fallback=false;
    const [fresh,studies]=await Promise.all(['brief','study'].map(async name=>{
      try{
        const response=await fetch('./data/'+name+'.json',{cache:'no-cache',signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw Error();
        const data=await response.json();
        if(!(name==='brief'?data.items:data)?.length)throw Error();
        return data;
      }catch{fallback=true;return seed[name];}
    }));
    let brief=fresh;
    try{
      const previous=JSON.parse(localStorage.getItem('civic-edition-v1'));
      if(previous?.items?.length&&Date.parse(previous.checkedAt)>Date.parse(brief.checkedAt||0))brief=previous;
    }catch{}
    state.brief=brief;state.studies=studies;try{localStorage.setItem('civic-edition-v1',JSON.stringify(brief));}catch{}
    const dates=[...new Set(brief.items.map(i=>i.date))].sort().reverse();
    const day=byId('day');day.replaceChildren(el('option','All dates'));
    for(const date of dates){const opt=el('option',pretty(date));opt.value=date;day.append(opt);}
    if(!dates.includes(state.day))state.day='All dates';
    day.value=state.day;render();if(fallback)byId('status').append(' · Using a saved edition');
  }catch{byId('status').textContent='Edition unavailable. Reopen online to download an edition.';byId('content').replaceChildren(button('Try again',()=>load(),'action'));}
}
for(const name of Object.keys(lenses))byId('topic').append(el('option',name));
byId('day').onchange=e=>{state.day=e.target.value;render();};
byId('topic').onchange=e=>{state.topic=e.target.value;render();};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;state.region=regions[0];state.topic='All topics';render();});
function globe(){
  const ctx=byId('sphere').getContext('2d');if(!ctx)return;
  ctx.translate(282,158);ctx.rotate(-.27);ctx.strokeStyle='#94b8a3';ctx.lineWidth=1;
  function arc(rx,ry,start=0,end=2*Math.PI,rot=0){ctx.beginPath();ctx.ellipse(0,0,rx,ry,rot,start,end);ctx.stroke();}
  ctx.globalAlpha=.49;arc(131,131);for(const rx of [34,70,103,124])arc(rx,131);
  for(let i=-3;i<=3;i++){const y=i*31,r=Math.sqrt(131**2-y**2);ctx.save();ctx.translate(0,y);arc(r,Math.max(4,r*.16));ctx.restore();}
  ctx.strokeStyle='#d4b679';ctx.globalAlpha=.83;arc(153,36,0,Math.PI*2,-.20);arc(158,40,0,Math.PI*2,-.20);
  ctx.globalAlpha=.45;arc(144,144,Math.PI*.9,Math.PI*1.85);for(let i=0;i<30;i++){ctx.save();ctx.rotate(i*Math.PI/50-1.88);ctx.beginPath();ctx.moveTo(0,-141);ctx.lineTo(0,-147);ctx.stroke();ctx.restore();}
}
globe();load();
let lastForeground=Date.now();
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&Date.now()-lastForeground>3600000){lastForeground=Date.now();load();}
});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
