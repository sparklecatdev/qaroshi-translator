import {loadTranslator, normalize} from './src/engine.mjs';
const $=(q)=>document.querySelector(q);
const $$=(q)=>[...document.querySelectorAll(q)];
const state={engine:null,lang:'auto',last:null,history:readStore('qaroshi:history',[]),starred:readStore('qaroshi:stars',[])};
const MAX=8000;
function readStore(key,otherwise){try{return JSON.parse(localStorage.getItem(key))??otherwise;}catch{return otherwise;}}
function writeStore(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch{}}
function el(name,cls='',txt=''){const n=document.createElement(name);if(cls)n.className=cls;if(txt!==undefined&&txt!==null)n.textContent=String(txt);return n;}
let toastTimer;
function toast(message){let t=$('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}
function view(name){for(const x of $$('.view'))x.classList.toggle('active',x.id===name+'-view');for(const n of $$('.nav-pill')){let active=n.dataset.view===name;n.classList.toggle('active',active);n.setAttribute('aria-current',active?'page':'false');}if(name==='dictionary')$('#dictionary-query').focus();}
function prettyStatus(s){return ({documented:'Documented',composed:'Provisional',partial:'Partial',lexical:'Dictionary',unresolved:'Unresolved'})[s]||'Ready';}
function syncDirection(){let from=$('#from-language').value,src=$('#source-text').value.trim();let detect=from==='auto'?(state.engine?.detect(src)||'en'):from;
  $('#to-language').textContent=detect==='qr'?'English':'Qaroshi';$('#resonance').disabled=detect==='qr';$('#resonance').closest('.resonance-wrap').style.opacity=detect==='qr'?'.4':'1';$('#char-count').textContent=String(src.length);$('#translate-btn').disabled=!state.engine||!src;}
function tokenChip(t){const root=(t.root||t.surface||'').split('-')[0];const b=el('button','token');b.type='button';b.append(el('strong','',t.surface||t.root));
  // Display a glossary/case annotation only where the source actually specifies it.
  const bits=[];if(t.gloss)bits.push(t.gloss.split(';')[0]);if(t.features)for(const [k,v] of Object.entries(t.features))bits.push(`${k}: ${v}`);if(t.issues?.length)bits.push(t.issues.join(', '));
  b.append(el('small','',bits.join(' · ')||'No direct glossary match'));b.onclick=()=>openDictionary(root);return b;}
function sourceEntry(r){const d=el('div','source-card');d.append(el('strong','',r.qaroshi),el('small','',r.english));const b=el('button','','Use this example ↗');b.type='button';b.onclick=()=>{$('#source-text').value=r.english||'';$('#from-language').value='en';view('translate');translate();window.scrollTo({top:0,behavior:'smooth'});};d.append(b);return d;}
function renderResult(result){const display=$('#translation-result');display.replaceChildren();$('#quality-pill').textContent=prettyStatus(result.status);$('#quality-pill').className='quality-pill '+result.status;
  $('#result-method').textContent=result.method||'Not enough evidence to translate';$('#copy-btn').disabled=!result.output;$('#save-btn').disabled=!result.output;
  if(result.output){display.append(el('div','translated-text',result.output));if(result.ipa)display.append(el('div','ipa-text',result.ipa));}
  else{display.append(el('div','unresolved-title','Not enough evidence for a safe full translation.'),el('p','','Explore the glossary and related source sentences below.'))}
  $('#explanations').hidden=false;const tok=$('#analysis-list');tok.replaceChildren();
  if(result.analysis?.length){const grid=el('div','token-grid');for(const t of result.analysis)grid.append(tokenChip(t));tok.append(grid);}else tok.append(el('p','muted','Exact reference match or dictionary lookup. No generated grammar parse required.'));
  const warn=$('#warnings-list');warn.replaceChildren();for(const w of result.warnings||[])warn.append(el('div','notice warn',w));
  const related=$('#related-list');related.replaceChildren();const variants=result.variants||[];const others=result.related||[];
  if(variants.length){related.append(el('h3','','Source variants'));for(const v of variants.slice(0,4))related.append(sourceEntry(v));}
  if(others.length){related.append(el('h3','','Related references · not translations'));for(const r of others.slice(0,4))related.append(sourceEntry(r));}
  if(!variants.length&&!others.length)related.append(el('p','muted','No closely related controlled examples.'));
}
function saveRecent(r){if(!r.output)return;const entry={source:r.source,output:r.output,direction:r.direction,date:Date.now(),status:r.status};state.history=[entry,...state.history.filter(x=>!(x.source===entry.source&&x.direction===entry.direction))].slice(0,18);writeStore('qaroshi:history',state.history);renderHistory();}
function renderHistory(){const host=$('#history');host.replaceChildren();if(!state.history.length){host.append(el('p','muted','Your translations stay on this device.'));return;}
 for(const r of state.history.slice(0,9)){const b=el('button','history-item');b.type='button';b.append(el('strong','',r.source),el('span','',r.output));b.title='Reopen translation';b.onclick=()=>{$('#from-language').value=r.direction;$('#source-text').value=r.source;view('translate');translate();};host.append(b);}}
function translate(){if(!state.engine)return;const source=$('#source-text').value.slice(0,MAX);if(!source.trim()){toast('Enter some text to translate.');return;}
  try{const result=state.engine.translate(source,{direction:$('#from-language').value,resonance:$('#resonance').value});state.last=result;renderResult(result);syncDirection();saveRecent(result);}
  catch(err){toast('Translation engine error: '+err.message);console.error(err);}}
function openDictionary(word){view('dictionary');$('#dictionary-query').value=word||'';$('#dictionary-pos').value='all';renderDictionary();}
function wordCard(r){const d=el('article','card word-card'),top=el('div','word-top');top.append(el('h2','',r.qaroshi),el('span','pos-chip',r.pos));d.append(top,el('div','word-ipa',r.ipa||'No recorded IPA'),el('p','word-definition',r.english),el('p','word-domain',(r.domain||'Unspecified')+' · '+r.id));
  if(r.current_lexical_sense_constraint)d.append(el('div','word-caveat',r.current_lexical_sense_constraint));else if(r.semantic_boundary_notes)d.append(el('div','word-caveat',r.semantic_boundary_notes));
  if(r.verb_role_license)d.append(el('div','word-caveat','Verb license: '+r.verb_role_license.replaceAll('_',' ')));
  const b=el('button','word-use','Translate this word ↗');b.type='button';b.onclick=()=>{$('#source-text').value=r.qaroshi;$('#from-language').value='qr';view('translate');translate();};d.append(b);return d;}
function renderDictionary(){if(!state.engine)return;const q=$('#dictionary-query').value.trim();const host=$('#dictionary-results');host.replaceChildren();if(!q){$('#dictionary-count').textContent=`${state.engine.data.lexicon.length.toLocaleString()} searchable entries`;for(const r of state.engine.lookup('qaroshi',8))host.append(wordCard(r));return;}
 const pos=$('#dictionary-pos').value;const search=state.engine.lookup(q,100).filter(x=>pos==='all'||(pos==='other'?!['n','v','adj','pron'].includes(x.pos):x.pos===pos));const found=search.slice(0,36);$('#dictionary-count').textContent=`${found.length} results shown${search.length>found.length?' · refine search to narrow':''}`;if(!found.length){host.append(el('p','muted','No matching canonical entry. Try a related word or broader English gloss.'));return;}for(const r of found)host.append(wordCard(r));}
function setupEvents(){for(const n of $$('.nav-pill'))n.addEventListener('click',()=>view(n.dataset.view));
 $('#theme-btn').onclick=()=>{const light=document.documentElement.classList.toggle('light');writeStore('qaroshi:theme',light?'light':'dark');};
 $('#source-text').addEventListener('input',syncDirection);$('#source-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();translate();}});$('#from-language').addEventListener('change',syncDirection);
 $('#translate-btn').onclick=translate;$('#ai-btn').onclick=async()=>{
  if(!state.engine||!$('#source-text').value.trim())return;
  if(!confirm('Send this text and related dictionary evidence to your configured AI provider? The answer is an unverified draft.'))return;
  const btn=$('#ai-btn');btn.disabled=true;btn.textContent='Drafting…';
  try{
    let direction=$('#from-language').value;if(direction==='auto')direction=state.engine.detect($('#source-text').value);
    const response=await fetch('./api/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:$('#source-text').value,direction,resonance:$('#resonance').value})});
    const obj=await response.json();if(!response.ok)throw Error(obj.error||'AI request failed');
    const result={source:$('#source-text').value,direction,output:obj.draft||'',status:obj.draft?'composed':'unresolved',method:'AI-assisted draft · not verified',warnings:[obj.disclaimer||'Unverified AI draft',...(obj.issues||[]),obj.justification||''].filter(Boolean),analysis:[],related:[],variants:[],ipa:obj.draft&&direction==='en'?state.engine.ipa(obj.draft):''};
    state.last=result;renderResult(result);if(!result.output)toast('The provider declined to draft this sentence.');else saveRecent(result);
  }catch(e){toast(e.message);}finally{btn.disabled=false;btn.textContent='AI draft ✦';}
};$('#clear-btn').onclick=()=>{$('#source-text').value='';state.last=null;$('#translation-result').replaceChildren(el('p','muted','Your translation appears here.'));$('#explanations').hidden=true;$('#quality-pill').textContent='Ready';$('#quality-pill').className='quality-pill neutral';$('#result-method').textContent='Source-grounded by design';$('#copy-btn').disabled=true;$('#save-btn').disabled=true;syncDirection();};
 $('#swap-btn').onclick=()=>{let from=$('#from-language');const isQr=from.value==='auto'?state.engine?.detect($('#source-text').value)==='qr':from.value==='qr';from.value=isQr?'en':'qr';if(state.last?.output){$('#source-text').value=state.last.output;}syncDirection();translate();};
 for(const n of $$('[data-insert]'))n.onclick=()=>{const t=$('#source-text'),a=t.selectionStart,b=t.selectionEnd;t.setRangeText(n.dataset.insert,a,b,'end');t.focus();syncDirection();};
 for(const n of $$('[data-example]'))n.onclick=()=>{$('#source-text').value=n.dataset.example;$('#from-language').value='auto';syncDirection();translate();};
 $('#copy-btn').onclick=async()=>{if(!state.last?.output)return;try{await navigator.clipboard.writeText(state.last.output);toast('Copied translation.');}catch{toast('Clipboard requires HTTPS or localhost. Select the text to copy.');}};
 $('#save-btn').onclick=()=>{if(!state.last?.output)return;let key=normalize(state.last.source);const i=state.starred.indexOf(key);if(i>=0){state.starred.splice(i,1);toast('Removed from saved.');}else{state.starred.unshift(key);state.starred=state.starred.slice(0,50);toast('Saved locally.');}writeStore('qaroshi:stars',state.starred);$('#save-btn').textContent=state.starred.includes(key)?'★':'☆';};
 $('#clear-history').onclick=()=>{state.history=[];writeStore('qaroshi:history',[]);renderHistory();toast('History cleared.');};
 let timer;$('#dictionary-query').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(renderDictionary,110)});$('#dictionary-pos').addEventListener('change',renderDictionary);
}
async function start(){if(readStore('qaroshi:theme','dark')==='light')document.documentElement.classList.add('light');setupEvents();renderHistory();
 try{const trans=await loadTranslator('./data');state.engine=trans;const count=trans.data.meta?.lexical_count||trans.data.lexicon.length;$('#data-label').innerHTML='';const dot=el('i','status-dot ready');$('#data-label').append(dot,document.createTextNode(`${count.toLocaleString()} words · Ready`));
 fetch('./api/status').then(r=>r.ok?r.json():null).then(obj=>{if(obj?.aiConfigured)$('#ai-btn').hidden=false;}).catch(()=>{});
 const select=$('#resonance');select.replaceChildren();for(const r of trans.data.resonances){const option=el('option','',r.marker+' · '+r.name);option.value=r.marker;select.append(option);}select.value='sen';syncDirection();renderDictionary();}
 catch(err){console.error(err);$('#data-label').textContent='Language data unavailable';$('#translation-result').textContent='Could not load language data. Serve this folder with the provided local server instead of opening file:// directly.';toast('Language assets failed to load.');}
 if('serviceWorker' in navigator&&location.protocol.startsWith('http')&&(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.protocol==='https:'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
start();
