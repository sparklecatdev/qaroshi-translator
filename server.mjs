#!/usr/bin/env node
/** Minimal zero-dependency static server and optional AI drafting proxy.
 * Bind to localhost by default; users can explicitly change HOST for hosting.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {pipeline} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {Translator,normalize} from './src/engine.mjs';
const BASE=path.dirname(fileURLToPath(import.meta.url));
const DIST=path.join(BASE,'dist');
const HOST=process.env.HOST||'127.0.0.1',PORT=Number(process.env.PORT||4173);
const AI_URL=process.env.AI_API_URL||'https://api.openai.com/v1/chat/completions';
const AI_MODEL=process.env.AI_MODEL||'';
const AI_KEY=process.env.AI_API_KEY||'';
const configured=Boolean(AI_KEY&&AI_MODEL);
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8'};
let data;const rates=new Map();
function json(res,status,obj){const body=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Length':Buffer.byteLength(body)});res.end(body);}
function getEngine(){if(data)return data;const read=k=>JSON.parse(fs.readFileSync(path.join(DIST,'data',`${k}.json`),'utf8'));data=new Translator({lexicon:read('lexicon'),examples:read('examples'),frames:read('frames'),resonances:read('resonances'),phonemes:read('phonemes')});return data;}
async function assist(req,res){if(!configured)return json(res,503,{error:'AI drafting not configured. Set AI_API_KEY and AI_MODEL on the server.'});
 const ip=req.socket.remoteAddress||'local';const now=Date.now();const uses=(rates.get(ip)||[]).filter(t=>t>now-3600000);if(uses.length>=12)return json(res,429,{error:'AI drafting rate limit reached.'});rates.set(ip,[...uses,now]);if(rates.size>1000)for(const [k,v] of rates)if(!v.some(x=>x>now-3600000))rates.delete(k);
 let raw='';try{for await(const part of req){raw+=part;if(raw.length>12000)return json(res,413,{error:'Request too long.'});}}catch{return json(res,400,{error:'Invalid request.'});}
 let body;try{body=JSON.parse(raw);}catch{return json(res,400,{error:'Malformed JSON.'});}
 const text=String(body.text||'').trim(),direction=body.direction==='qr'?'qr':'en',resonance=String(body.resonance||'sen');
 if(!text||text.length>1400)return json(res,400,{error:'Enter a sentence shorter than 1,400 characters.'});
 const engine=getEngine();const initial=engine.translate(text,{direction,resonance});const candidates=[];
 for(const chunk of normalize(text).split(' ').filter(w=>w.length>=3).slice(0,18))for(const r of engine.lookup(chunk,3))if(!candidates.some(x=>x.id===r.id))candidates.push({id:r.id,word:r.qaroshi,meaning:r.english,pos:r.pos,warning:r.current_lexical_sense_constraint});
 const examples=initial.related.slice(0,5).map(x=>({id:x.id,qaroshi:x.qaroshi,english:x.english}));
 const system='You draft candidate translations for Qaroshi, a constructed language. You MUST avoid guessing or inventing unprovided Qaroshi lexemes. Source lexemes are in the evidence JSON. Qaroshi sentences require one resonance at start, SOV order, nouns with case -m object/-tu recipient/-lo location/-gu goal, verbs with suffix -te past/-yu future, nu immediately before predicate. Never assert correctness, speaker attestation, or certainty when unlicensed. If evidence is insufficient, output draft:null. Return STRICT JSON with keys draft (string|null), gloss (string), issues (array of strings), justification (string). A system response is only a suggestion; it is not independently vetted.';
 const userEvidence={requested_direction:direction==='qr'?'Qaroshi to English':'English to Qaroshi',preferred_resonance:resonance,source_text:text,current_engine_status:initial.status,existing_output:initial.output||null,lexical_witnesses:candidates.slice(0,36),related_examples:examples};
 try{const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),30000);let remote;
  try{remote=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${AI_KEY}`},body:JSON.stringify({model:AI_MODEL,messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(userEvidence)}],temperature:0.1}),signal:ac.signal});}finally{clearTimeout(timer);}
  if(!remote.ok)return json(res,502,{error:'AI provider returned an error. Verify the server configuration.'});
  const response=await remote.json();let content=response.choices?.[0]?.message?.content||'';
  if(typeof content!=='string')return json(res,502,{error:'Unexpected AI provider reply.'});
  content=content.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');let parsed;
  try{parsed=JSON.parse(content);}catch{return json(res,502,{error:'AI response was not valid structured data.'});}
  const draft=typeof parsed.draft==='string'?parsed.draft.trim().slice(0,4000):'';
  const issues=Array.isArray(parsed.issues)?parsed.issues.map(x=>String(x).slice(0,180)).slice(0,8):[];
  if(draft&&direction==='en'){
    const tokens=draft.toLowerCase().match(/[a-zë]+(?:-[a-zë]+)*/g)||[];
    const unknown=[...new Set(tokens.filter(t=>!engine.lex.has(t.split('-')[0])&&!engine.res.has(t)&&!['nu','he','ya','do','pëla','lan','si','hu','ye'].includes(t)))];
    if(unknown.length)issues.unshift('Unknown or unlicensed word forms in draft: '+unknown.slice(0,10).join(', '));
    if(!engine.res.has(tokens[0]))issues.unshift('No valid sentence-initial resonance in this Qaroshi draft.');
  }
  return json(res,200,{draft:draft||null,gloss:String(parsed.gloss||'').slice(0,1000),issues,justification:String(parsed.justification||'').slice(0,1100),status:'unverified-ai-draft',disclaimer:'A third-party model generated this draft. It may be inaccurate; do not treat it as an approved Qaroshi translation.'});
 }catch(e){return json(res,502,{error:e.name==='AbortError'?'AI request timed out.':'Unable to reach AI provider.'});}
}
async function serve(req,res){const url=new URL(req.url||'/',`http://${HOST}`);
 if(url.pathname==='/api/status')return json(res,200,{aiConfigured:configured});
 if(url.pathname==='/api/assist'){if(req.method!=='POST')return json(res,405,{error:'Method not allowed.'});return assist(req,res);}
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed.'});
 let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{return json(res,400,{error:'Malformed path.'});}
 if(decoded.includes('\0')||decoded.includes('\\'))return json(res,400,{error:'Invalid path.'});
 const rel=decoded==='/'?'index.html':decoded.replace(/^\/+/,''),file=path.resolve(DIST,rel);
 if(!file.startsWith(DIST+path.sep))return json(res,403,{error:'Forbidden.'});
 let stat;try{stat=await fs.promises.stat(file);}catch{return json(res,404,{error:'Not found.'});}
 if(!stat.isFile())return json(res,404,{error:'Not a file.'});
 res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control',rel.startsWith('data/')?'public,max-age=900':'no-cache');
 if(req.method==='HEAD'){res.writeHead(200);return res.end();}
 const stream=fs.createReadStream(file);
 if(/\bgzip\b/.test(req.headers['accept-encoding']||'')&&stat.size>1024){res.writeHead(200,{'Content-Encoding':'gzip','Vary':'Accept-Encoding'});pipeline(stream,zlib.createGzip(),res,e=>{if(e)res.destroy();});}
 else{res.writeHead(200);pipeline(stream,res,e=>{if(e)res.destroy();});}
}
if(!fs.existsSync(path.join(DIST,'index.html'))){console.error('Missing dist/. Run: npm run build');process.exit(1);}
const server=http.createServer((req,res)=>{serve(req,res).catch(()=>json(res,500,{error:'Internal server error.'}));});server.listen(PORT,HOST,()=>console.log(`Qaroshi Translator running at http://${HOST}:${PORT} (AI ${configured?'enabled':'disabled'})`));
