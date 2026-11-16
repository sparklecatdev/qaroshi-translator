/**
 * Qaroshi translation core. Source-backed, deterministic, works in browser + Node.
 * A fully general Qaroshi translator is not linguistically validated: return
 * explicitly unresolved rather than silently invent source meanings.
 */
export const RESONANCE_DEFAULT = 'sen';
export const CASES = {m:'object',na:'genitive',lo:'location',gu:'goal',de:'source',wa:'companion',tu:'recipient',shi:'instrument',za:'passive agent',nga:'path'};
export const VOICES = {ru:'causative',li:'passive',wo:'reciprocal',ne:'reflexive'};
export const TENSES = {te:'past',yu:'future'};
export const ASPECTS = {se:'progressive',mo:'completive','në':'habitual'};
export const MODALS = {ki:'ability',ho:'permission',du:'obligation'};
export const PRONOUNS = {mi:{s:'I',o:'me',poss:'my'},ti:{s:'you',o:'you',poss:'your'},sa:{s:'they',o:'them',poss:'their'},sari:{s:'they',o:'them',poss:'their'},naru:{s:'we',o:'us',poss:'our'},muru:{s:'we',o:'us',poss:'our'},tiri:{s:'you all',o:'you all',poss:'your'},sari:{s:'they',o:'them',poss:'their'}};
export const CONNECTORS = new Set(['wë','ro','ko','uro','yaro','ana','ëna','do','ara','nao','oru','shoru','qëhano','wëlëmi']);
const TOKEN_RE = /[a-zë]+(?:-[a-zë]+)*/giu;
const ABSTRACT = new Set(['nu','he','ya','si','hu','ye','pëla','lan']);
const EN_SUBJECT = {'i':'mi','you':'ti','they':'sa','we':'naru','the nardoragon':'qaro','a nardoragon':'qaro','the friend':'mara','a friend':'mara','the dragon':'qaro','the friends':'mara-ri'};
const EN_NOUNS = {'friend':'mara','friends':'mara-ri','nardoragon':'qaro','nardoragons':'qaro-ri','dragon':'qaro','home':'naro','house':'naro','water':'kima','book':'shima','message':'shiwaro','wing':'banu','wings':'banu-ri','star':'sëra','sky':'wena','night':'yami','question':'shëno','me':'mi','you':'ti','them':'sa','us':'naru','the friend':'mara','a friend':'mara','the home':'naro','a home':'naro','the water':'kima','a book':'shima','the book':'shima','a message':'shiwaro','the message':'shiwaro','the dragon':'qaro','a dragon':'qaro','the nardoragon':'qaro'};
// Phrasal alternatives are intentionally curated. An English gloss is not an
// unrestricted word-sense license for generative use.
const VERBS = [
 {en:'fly',qr:'goro',past:'flew'}, {en:'travel',qr:'gura',past:'traveled'}, {en:'go',qr:'gura',past:'went'},
 {en:'stay',qr:'nëra',past:'stayed'}, {en:'remain',qr:'nëra',past:'remained'}, {en:'rest',qr:'nëru',past:'rested'},
 {en:'protect',qr:'daru',past:'protected'}, {en:'see',qr:'tika',past:'saw'}, {en:'notice',qr:'tika',past:'noticed'},
 {en:'speak',qr:'shiri',past:'spoke'}, {en:'cherish',qr:'nashi',past:'cherished'},
 {en:'read',qr:'shëliro',past:'read'}, {en:'drink',qr:'këmë',past:'drank'}, {en:'eat',qr:'shëma',past:'ate'},
 {en:'know',qr:'sëmi',past:'knew'}, {en:'have',qr:'hari',past:'had'}, {en:'give',qr:'pëli',past:'gave'},
 {en:'offer',qr:'pëli',past:'offered'}, {en:'apologize',qr:'përë',past:'apologized'},
 {en:'ask',qr:'sharoa',past:'asked'}, {en:'answer',qr:'përoa',past:'answered'},
 {en:'play',qr:'rawo',past:'played'}, {en:'explore',qr:'wori',past:'explored'},
 {en:'die',qr:'zëru',past:'died'}
];
const CURATED_ENGLISH = new Map(VERBS.map(v=>[v.en,v]));
const EN_ADJECTIVES = {'well':'haro','good':'haro','safe':'haro','cute':'lësha','beautiful':'rëla','tired':'shërohi','happy':'merawo','sad':'surawe','dry':'dërawa'};
const CURATED_EN_FOR_QR = new Map(VERBS.map(v=>[v.qr,v.en]));
const PAST_WORD = Object.fromEntries(VERBS.map(v=>[v.past,v.en]));
const IRREG = Object.fromEntries(VERBS.map(v=>[v.en,v.past]));
const ALL_SUFFIXES = new Map([
 ...Object.entries(VOICES).map(([s,v])=>[s,{type:'voice',meaning:v,slot:1}]),
 ...Object.entries(TENSES).map(([s,v])=>[s,{type:'tense',meaning:v,slot:2}]),
 ...Object.entries(ASPECTS).map(([s,v])=>[s,{type:'aspect',meaning:v,slot:3}]),
 ...Object.entries(MODALS).map(([s,v])=>[s,{type:'modal',meaning:v,slot:4}]),
 ['la',{type:'manner',meaning:'tender manner',slot:5}]
]);
const N_PREFIX = new Map([['lë',{type:'diminutive',meaning:'diminutive',slot:1}],['ri',{type:'number',meaning:'plural',slot:2}],...Object.entries(CASES).map(([s,v])=>[s,{type:'case',meaning:v,slot:3}]),['së',{type:'topic',meaning:'topic',slot:4}]]);
export function normalize(t){return String(t??'').normalize('NFC').toLocaleLowerCase('en-US').replace(/[\s.,!?;:”“"'()]+/g,' ').trim();}
function textWords(x){return String(x||'').normalize('NFC').toLocaleLowerCase('en-US').match(TOKEN_RE)||[];}
function title(s){return s? s.charAt(0).toUpperCase()+s.slice(1):s;}
function baseGloss(record){return (record?.english||'').split(';')[0].split(' (')[0].trim();}
function clamp(s,n=240){return s.length>n ? s.slice(0,n)+'…':s;}

export class Translator {
  constructor(data){
    if(!data?.lexicon?.length||!data?.examples?.length)throw Error('Missing language assets');
    this.data=data;this.lex=new Map();this.gloss=new Map();this.byQ=new Map();this.byEn=new Map();this.res=new Map();this.frame=new Map();this.manual=new Map();this.phon=new Map();
    for(const r of data.lexicon){this.lex.set(r.qaroshi,r);for(const en of (r.english||'').split(';')){const key=normalize(en.replace(/\([^)]*\)/g,''));if(!key||key.length>120)continue;const a=this.gloss.get(key)||[];a.push(r);this.gloss.set(key,a);}}
    for(const r of data.examples){for(const [index,key] of [[this.byQ,normalize(r.qaroshi)],[this.byEn,normalize(r.english)]]){const a=index.get(key)||[];a.push(r);index.set(key,a);}}
    for(const r of data.resonances)this.res.set(r.marker,r);
    for(const r of data.frames.audited)this.frame.set(r.lemma,r);
    for(const r of data.frames.reviewed)this.manual.set(r.lemma,r);
    for(const r of data.phonemes)this.phon.set(r.glyph,r.ipa.replaceAll('/',''));
    this.englishProns=EN_SUBJECT;
  }
  detect(text){let ts=textWords(text);if(!ts.length)return 'en';if(this.res.has(ts[0]))return 'qr';let qr=ts.filter(t=>this.lex.has(t.split('-')[0])||this.res.has(t)).length;return qr/ts.length>=.72?'qr':'en';}
  lookup(query,limit=25){const key=normalize(query);if(!key)return [];
    const exact=this.lex.get(key);const out=[],seen=new Set();
    const add=(r)=>{if(!seen.has(r.id)){seen.add(r.id);out.push(r);}};
    if(exact)add(exact);for(const r of this.gloss.get(key)||[])add(r);
    if(out.length>=limit)return out.slice(0,limit);
    for(const r of this.data.lexicon){if(out.length>=limit)break;if(r.qaroshi.startsWith(key)||(key.length>=3 && r.english.toLowerCase().startsWith(key)))add(r);}
    if(out.length<limit && key.length>=3){for(const r of this.data.lexicon){if(out.length>=limit)break;if(r.english.toLowerCase().includes(key))add(r);}}
    return out.slice(0,limit);
  }
  analyzeWord(token){
    const cleaned=normalize(token);if(!cleaned)return null;
    const [root,...suffixes]=cleaned.split('-');
    const r=this.lex.get(root);
    if(!r)return {surface:token,root,known:false,issues:[`Unknown lemma: ${root}`],suffixes};
    const table=r.pos==='v'?ALL_SUFFIXES:['n','pron','det'].includes(r.pos)?N_PREFIX:new Map();
    const features={},issues=[];let last=0;
    for(const s of suffixes){const entry=table.get(s);if(!entry){issues.push(`${r.pos} does not license -${s}`);continue;}if(entry.slot<=last)issues.push(`Suffix order or duplicate slot at -${s}`);last=entry.slot;features[entry.type]=entry.meaning;}
    return {surface:token,root,known:true,id:r.id,gloss:r.english,ipa:r.ipa,pos:r.pos,features,suffixes,issues};
  }
  ipa(text){let output=[];for(const token of textWords(text)){
    const w=this.analyzeWord(token);if(w?.known && !w.suffixes.length && w.ipa){output.push(w.ipa.slice(1,-1));continue;}
    const letters=token.split('-'),parts=[];for(const piece of letters){const chars=[];for(let i=0;i<piece.length;){const d=piece.slice(i,i+2);const gr=this.phon.has(d)?d:piece[i];if(!this.phon.has(gr)){chars.length=0;break;}chars.push(this.phon.get(gr));i+=gr.length;}parts.push(chars.join(''));}output.push(parts.join('-'));
  }return '/'+output.filter(Boolean).join(' ')+'/';}
  translate(text,{direction='auto',resonance='sen',_single=false}={}){
    const source=String(text||'').normalize('NFC').trim().slice(0,8000);
    const dir=direction==='auto'?this.detect(source):direction;
    const result={source,direction:dir,target:dir==='qr'?'English':'Qaroshi',output:'',status:'unresolved',method:'',variants:[],warnings:[],analysis:[],related:[],ipa:'',coverage:'none'};
    if(!source){result.warnings.push('Enter a word or sentence.');return result;}
    const index=dir==='qr'?this.byQ:this.byEn;let exact=index.get(normalize(source))||[];
    if(exact.length){const ordered=dir==='en'?[...exact].sort((a,b)=>(a.qaroshi.startsWith(resonance+' ')?-1:1)):exact;
      result.output=dir==='qr'?ordered[0].english:ordered[0].qaroshi;
      result.variants=ordered.slice(0,12).map(r=>({id:r.id,english:r.english,qaroshi:r.qaroshi,domain:r.domain}));
      result.status='documented';result.coverage='exact';result.method='Exact controlled bilingual source';
      result.warnings.push('This is an editorial/controlled reference match, not an attested universal translation.');
      if(new Set(ordered.map(r=>dir==='qr'?r.english:r.qaroshi)).size>1)result.warnings.push('More than one documented equivalent exists; context may change the choice.');
      if(dir==='en' && ordered[0].qaroshi.split(' ')[0]!==resonance)result.warnings.push('No exact reference with the selected resonance. Original source wording preserved.');
      result.ipa=this.ipa(dir==='qr'?source:result.output);return result;
    }
    // Multi-sentence texts are handled as independent source-marked clauses.
    // Never silently replace an unsupported sentence with a guessed one.
    if(!_single){
      const sentences=source.split(/(?<=[.!?])\s+|\n+/u).map(s=>s.trim()).filter(Boolean);
      if(sentences.length>1){
        const items=sentences.slice(0,64).map(s=>this.translate(s,{direction:dir,resonance,_single:true}));
        const supported=items.filter(i=>Boolean(i.output)).length;
        result.output=items.map((r,i)=>r.output||`⟦Unresolved sentence ${i+1}: ${sentences[i]}⟧`).join('\n');
        result.status=supported===items.length?'composed':'partial';
        result.coverage=`${supported}/${items.length} sentences`;
        result.method='Sentence-by-sentence constrained translation';
        result.warnings=[`Translated ${supported} of ${items.length} sentences. Each segment has its own evidence status.`,...items.flatMap((r,i)=>r.warnings.slice(0,2).map(w=>`Sentence ${i+1}: ${w}`))].slice(0,16);
        result.analysis=items.map((r,i)=>({surface:`Sentence ${i+1}`,gloss:`${r.status} · ${r.method||'unresolved'}`,known:Boolean(r.output)}));
        result.variants=[];result.related=[];result.segments=items.map((r,i)=>({source:sentences[i],output:r.output,status:r.status,method:r.method}));
        result.ipa='';return result;
      }
    }
    // Whole-word lookup does not imply a full sentence translation.
    const w=this.lex.get(normalize(source));if(dir==='qr'&&w){result.output=w.english;result.status='lexical';result.coverage='word';result.method='Dictionary entry';result.analysis=[this.analyzeWord(source)];result.ipa=this.ipa(source);return result;}
    if(dir==='en' && !/[.!?]/.test(source) && source.trim().split(/\s+/).length<=5){const candidates=this.gloss.get(normalize(source))||[];if(candidates.length){result.output=candidates[0].qaroshi;result.status='lexical';result.coverage='word';result.method='Dictionary gloss lookup';result.variants=candidates.slice(0,12).map(r=>({qaroshi:r.qaroshi,english:r.english,id:r.id}));result.warnings.push('Word-level equivalent only. English senses may be ambiguous.');result.ipa=this.ipa(result.output);return result;}}
    // Controlled single-clause composition; unknown structures abstain.
    const draft=dir==='qr'?this.fromQaroshi(source):this.fromEnglish(source,resonance);
    if(draft){Object.assign(result,draft);if(result.output && dir==='en'&&!result.ipa)result.ipa=this.ipa(source);if(result.output && dir==='qr')result.ipa=this.ipa(result.output);}
    if(!result.output){result.method=result.method||'No licensed complete interpretation';result.warnings.push('Outside the verified patterns. Related references and lexical analysis are provided without inventing an answer.');}
    result.analysis = result.analysis.length?result.analysis:(dir==='qr'?textWords(source).map(t=>this.analyzeWord(t)||{surface:t}):[]);
    result.related=this.related(source,dir,6);return result;
  }
  related(text,dir,limit=6){const query=new Set(normalize(text).split(' ').filter(x=>x.length>=3));const candidates=[];
    for(const r of this.data.examples){const candidate=normalize(dir==='qr'?r.qaroshi:r.english);const ts=new Set(candidate.split(' '));let hits=0;for(const t of query)if(ts.has(t))hits++;if(hits)candidates.push({r,score:hits/Math.max(query.size,ts.size/2)});}
    candidates.sort((a,b)=>b.score-a.score);return candidates.slice(0,limit).map(x=>({id:x.r.id,english:x.r.english,qaroshi:x.r.qaroshi,score:x.score,warning:'Related reference, not a translation of the input'}));
  }
  noun(token,role='subject'){
    const info=this.analyzeWord(token);if(!info?.known||info.issues.length||!['n','pron','det'].includes(info.pos))return null;
    const p=PRONOUNS[info.root];const f=info.features;let label=p?(f.case==='genitive'?p.poss:f.case&&f.case!=='subject'?p.o:p[role==='subject'?'s':'o']):baseGloss(this.lex.get(info.root));
    if(f.number==='plural'&&!p){label=label.replace(/y$/,'ie')+'s';}
    const prefix={location:'at',goal:'toward',source:'from',companion:'with',recipient:'to',instrument:'using','passive agent':'by',path:'via',genitive:'of'}[f.case];
    return {text:prefix?`${prefix} ${label}`:label,role:f.case||role,root:info.root,features:f};
  }
  fromQaroshi(source){
    const ts=textWords(source);const res=this.res.get(ts[0]);if(!res)return {warnings:['Complete written Qaroshi sentences need an initial resonance marker (e.g. sen).']};
    if(ts.length<3)return {warnings:['Not enough constituents to identify a complete clause.']};
    if(ts.slice(1).some(t=>CONNECTORS.has(t)))return {warnings:['Embedded or coordinated clauses require separate semantic review.']};
    let terms=ts.slice(1),question=false,command=false;
    if(terms.at(-1)==='he'){terms=terms.slice(0,-1);question=true;}else if(terms.at(-1)==='ya'){terms=terms.slice(0,-1);command=true;}
    const predicate=terms.at(-1);const verb=this.analyzeWord(predicate);
    if(!verb?.known||verb.issues.length||!['v','adj'].includes(verb.pos))return {warnings:['Final finite predicate is not a licensed verb or adjective.']};
    let args=terms.slice(0,-1);let neg=false;if(args.at(-1)==='nu'){neg=true;args.pop();}
    if(args.some(t=>t==='nu'||t==='he'||t==='ya'||this.res.has(t)))return {warnings:['Unsupported nested negation, mood or resonance.']};
    let quant='',subject=null;
    if(['ngënao','nëgëra','shërano'].includes(args[0])){quant=args.shift();}
    if(!args.length)return {warnings:['Missing subject.']};
    const head=args.shift();subject=this.noun(head,'subject');if(!subject||subject.role!=='subject')return {warnings:['Unlicensed or case-marked subject.']};
    const f=verb.features;
    if(f.voice)return {warnings:[`Voice ${f.voice} needs reviewed argument and agent structure; no automatic English sentence rendered.`]};
    const objects=[],extra=[];let recipient=false;
    for(const a of args){const n=this.noun(a,'object');if(!n)return {warnings:[`Unsupported constituent ${a}.`]};
      if(n.role==='object')objects.push(n);
      else if(['recipient','location','goal','source','companion','instrument','path'].includes(n.role)){extra.push(n);if(n.role==='recipient')recipient=true;}
      else return {warnings:[`Unexpected noun case ${a} in this clause.`]};
    }
    if(objects.length>1)return {warnings:['Multiple objects require an explicitly reviewed frame.']};
    const manual=this.manual.get(verb.root);const audited=this.frame.get(verb.root);
    if(objects.length){if(!manual)return {warnings:[`Object-bearing frame for ${verb.root} is source-limited, not generalized.`]};if(!manual.required_roles.some(r=>r.startsWith('object:-m'))&&!manual.licensed_optional_roles.some(r=>r.startsWith('object:-m')))return {warnings:[`Verb ${verb.root} does not license object -m in this sense.`]};}
    if(verb.root==='pëli' && (!recipient||!objects.length))return {warnings:['Giving requires an overt theme -m and recipient -tu in the reviewed frame.']};
    if((verb.root==='këmë'&&objects[0]&&!['kima'].includes(objects[0].root))||(verb.root==='shëma'&&objects[0]&&objects[0].root==='kima'))return {warnings:['The object type conflicts with the reviewed drink/eat sense.']};
    if(f.modal&&f.tense||f.aspect&&f.modal)return {warnings:['This combined tense/aspect/modal reading requires human review.']};
    const who=subject.text;let phrase='';let details=['Resonance '+ts[0]+': '+res.meaning,'Subject: '+head,`Predicate: ${verb.root}`];
    if(verb.pos==='adj'){
      if(objects.length||f.tense||f.aspect||f.modal||f.voice)return {warnings:['Adjective with direct object or verbal inflection is outside this pattern.']};
      const a=baseGloss(this.lex.get(verb.root));phrase=question?`Is ${who.toLowerCase()} ${neg?'not ':''}${a}?`:`${who} ${who==='I'?'am':who==='you'||who==='you all'||who==='we'||who==='they'?'are':'is'} ${neg?'not ':''}${a}.`;
    }else{
      let eng=CURATED_EN_FOR_QR.get(verb.root);if(!eng)return {warnings:[`No reviewed English predicate label for ${verb.root}; dictionary meaning does not automatically license sentence translation.`]};
      let objtext=objects.length?' '+objects[0].text:'';
      let extraText=extra.map(e=>e.text).join(' ');
      let full=objtext+(extraText?' '+extraText:'');
      const third=!['I','you','you all','we','they'].includes(who);
      let aux='',word=eng;
      if(f.modal){aux={ability:'can',permission:'may',obligation:'must'}[f.modal];}
      else if(f.tense==='future')aux='will';
      else if(f.tense==='past'){if(question||neg)aux='did';else word=IRREG[eng]||eng+'ed';}
      else if(neg||question)aux=third?'does':'do';
      else if(third)word=/[sxz]$|ch$|sh$/.test(word)?word+'es':word+'s';
      if(f.aspect){if(f.aspect==='progressive')return {warnings:['Progressive aspect requires a separate reviewed English auxiliary and reference-time choice.']};if(f.aspect==='completive')return {warnings:['Completive aspect needs reference-time interpretation.']};if(f.aspect==='habitual')aux=aux?aux+' usually':'usually';}
      if(neg){aux=aux?aux+' not':'do not';word=eng;}
      if(question){const qaux=aux|| (third?'does':'do');phrase=`${title(qaux)} ${who.toLowerCase()} ${eng}${full}?`;}
      else phrase=`${who} ${[aux,word].filter(Boolean).join(' ')}${full}.`;
      const thirdVerb=/[sxz]$|ch$|sh$/.test(eng)?eng+'es':eng==='fly'?'flies':eng+'s';
      if(quant==='ngënao')phrase=neg?`No ${subject.text} ${thirdVerb}${full}.`:`Every ${subject.text} ${thirdVerb}${full}.`;
      if(quant==='nëgëra'){if(neg)return {warnings:['Not-every with separate predicate negation needs scope review.']};phrase=`Not every ${subject.text} ${thirdVerb}${full}.`;}
      if(quant==='shërano')phrase=`At least one ${subject.text} ${neg?'does not '+eng:thirdVerb}${full}.`;
    }
    return {output:phrase,status:'composed',coverage:'restricted',method:'Rule-based simple-clause analysis',analysis:ts.map(t=>({surface:t,...this.analyzeWord(t)})),warnings:['Provisional compositional interpretation. Article choice, lexical sense and discourse context are not independently verified.'],ipa:this.ipa(source)};
  }
  parseEnglishNoun(phrase){const x=normalize(phrase).replace(/^(the|a|an) /,'');return EN_NOUNS[normalize(phrase)]||EN_NOUNS[x]||null;}
  fromEnglish(source,resonance='sen'){
    if(!this.res.has(resonance))resonance='sen';
    const original=source.trim();let s=normalize(original.replace(/\bdon't\b/gi,'do not').replace(/\bdoesn't\b/gi,'does not').replace(/\bdidn't\b/gi,'did not'));let question=/\?\s*$/.test(original);
    if(!s || /[;,]/.test(original)|| /\b(because|although|whether|unless|which|that|while|if|when|until)\b/.test(s))return {warnings:['Complex or embedded English requires semantic review, not word-for-word conversion.']};
    if(/^are (you|we|they) (not )?/.test(s)||/^(i am|you are|we are|they are|the friend is) /.test(s)){
      let m=s.match(/^(?:are (you|we|they) |(i am|you are|we are|they are|the friend is) )(not )?([a-z ]+)$/);
      if(m){let sub=m[1]||{'i am':'i','you are':'you','we are':'we','they are':'they','the friend is':'the friend'}[m[2]];let adj=EN_ADJECTIVES[m[4]];let qr=EN_SUBJECT[sub];if(adj&&qr){let built=`${resonance} ${qr} ${m[3]?'nu ':''}${adj}${question?' he?':'.'}`;return this.edraft(built,`English adjective and written resonance pattern`);}}
    }
    let neg=false,modal='',tense='',subject='';
    let first=Object.keys(EN_SUBJECT).sort((a,b)=>b.length-a.length).find(k=>s===k||s.startsWith(k+' '));
    if(s.startsWith('do ')||s.startsWith('does ')){question=true;s=s.replace(/^(do|does) /,'');first=Object.keys(EN_SUBJECT).sort((a,b)=>b.length-a.length).find(k=>s.startsWith(k+' '));}
    if(!first)return {warnings:['This English subject is not in the reviewed transfer grammar. Try a documented example or glossary lookup.']};
    subject=EN_SUBJECT[first];s=s.slice(first.length).trim();
    if(/^do not |^does not |^don't |^doesn't |^did not |^didn't /.test(s)){neg=true;tense=s.startsWith('did')?'te':'';s=s.replace(/^(do not|does not|don't|doesn't|did not|didn't) /,'');}
    if(s.startsWith('will ')){tense='yu';s=s.slice(5);}
    if(s.startsWith('can ')){modal='ki';s=s.slice(4);}else if(s.startsWith('may ')){modal='ho';s=s.slice(4);}else if(s.startsWith('must ')){modal='du';s=s.slice(5);}
    if(s.startsWith('not ')){neg=true;s=s.slice(4);}
    let matched=VERBS.find(v=>s===v.en||s.startsWith(v.en+' ')||s===v.past||s.startsWith(v.past+' '));
    if(!matched){return {warnings:['No reviewed verb-sense mapping for this predicate. Gloss matching alone is insufficient.']};}
    const stem=s===matched.past||s.startsWith(matched.past+' ')?matched.past:matched.en;
    if(stem===matched.past&&stem!==matched.en)tense='te';
    s=s.slice(stem.length).trim();
    const frame=this.manual.get(matched.qr);if(!frame)return {warnings:[`Verb ${matched.qr} lacks a generalized reviewed frame.`]};
    let complement='',direct='',recipient='';
    if(s){const toIdx=s.lastIndexOf(' to ');if(toIdx>=0 && matched.qr==='pëli'){recipient=this.parseEnglishNoun(s.slice(toIdx+4));s=s.slice(0,toIdx);}
      if(matched.qr==='gura'&&/^to /.test(s)){const place=this.parseEnglishNoun(s.slice(3));if(place)complement=place+'-gu';}
      else if(matched.qr==='nëra'&&/^at |^in /.test(s)){const place=this.parseEnglishNoun(s.replace(/^(at|in) /,''));if(place)complement=place+'-lo';}
      else if(matched.qr==='përë'&&/^to /.test(s)){const target=this.parseEnglishNoun(s.slice(3));if(target)complement=target+'-tu';}
      else direct=this.parseEnglishNoun(s);
      if(!direct&&!complement&&!recipient)return {warnings:['Unrecognized or ambiguous object/oblique noun phrase; no guess made.']};
    }
    const required=frame.required_roles||[],optional=frame.licensed_optional_roles||[];
    const canObject=[...required,...optional].some(x=>x.startsWith('object:-m'));
    if(direct&&!canObject)return {warnings:[`Reviewed ${matched.qr} sense does not license a direct object.`]};
    if(required.some(x=>x.startsWith('object:-m'))&&!direct)return {warnings:['An obligatory direct object is missing.']};
    if(matched.qr==='pëli' && (!direct||!recipient))return {warnings:['Give/offer needs both an object and a recipient.']};
    if(matched.qr==='këmë'&&direct!=='kima')return {warnings:['Drink requires a known liquid patient; this object needs review.']};
    if(matched.qr==='shëma'&&direct==='kima')return {warnings:['Eating water is a distinct figurative sense; cannot silently substitute.']};
    if(recipient)complement=recipient+'-tu '+direct+'-m';else if(direct)complement=direct+'-m'+(complement?' '+complement:'');
    let qr=`${resonance} ${subject}${complement?' '+complement:''}${neg?' nu':''} ${matched.qr}${tense?'-'+tense:''}${modal?'-'+modal:''}${question?' he?':'.'}`;
    return this.edraft(qr,'Reviewed frame + restricted English simple-clause transfer');
  }
  edraft(qr,method){return {output:qr,status:'composed',coverage:'restricted',method,analysis:textWords(qr).map(t=>({surface:t,...this.analyzeWord(t)})),warnings:['Provisional generation, not a canonical, independently checked translation. Review subject reference, sense, scope and resonance.'],ipa:this.ipa(qr)};}
}
export async function loadTranslator(root='./data'){
  const paths=['lexicon','examples','frames','resonances','phonemes','meta'];const vals=await Promise.all(paths.map(async p=>{const r=await fetch(`${root}/${p}.json`);if(!r.ok)throw Error(`Unable to load ${p} (${r.status})`);return r.json();}));const data=Object.fromEntries(paths.map((p,i)=>[p,vals[i]]));return new Translator(data);
}
