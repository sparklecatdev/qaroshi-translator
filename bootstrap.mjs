// Root GitHub Pages loader for the source-pinned, offline-friendly Qaroshi data.
// No third-party services, dynamic npm bundles, or API keys are needed.
const EXPECTED_SHA256='ab9fb534776599efc2aff430d3e832a3d23f5df82efa057a1a1d5c20b11f26ed';
const EXPECTED_KEYS=new Set(['lexicon','examples','frames','resonances','phonemes','meta']);
const decoder=new TextDecoder('utf-8',{fatal:true});

async function hydrateSnapshot(fetchPart){
  if(!globalThis.DecompressionStream||!globalThis.crypto?.subtle){
    throw new Error('Loading Qaroshi requires a modern HTTPS browser with gzip support.');
  }
  const parts=await Promise.all(Array.from({length:7},(_,i)=>fetchPart(i)));
  const size=parts.reduce((n,p)=>n+p.length,0);
  if(size>5_000_000||parts.some(p=>!(p instanceof Uint8Array)))throw new Error('Invalid Qaroshi snapshot parts');
  const zipped=new Uint8Array(size);
  let offset=0;
  for(const p of parts){zipped.set(p,offset);offset+=p.length;}
  const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',zipped));
  const sha=[...hash].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(sha!==EXPECTED_SHA256)throw new Error('Qaroshi snapshot hash mismatch. Refresh to get the current data.');
  const inflated=new Uint8Array(await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if(inflated.length>90_000_000)throw new Error('Unexpectedly large Qaroshi dataset');
  const result={};
  for(let i=0;i+512<=inflated.length;){
    const head=inflated.subarray(i,i+512);
    if(head.every(b=>b===0))break;
    const name=decoder.decode(head.subarray(0,100)).replace(/\0.*$/s,'');
    const count=parseInt(decoder.decode(head.subarray(124,136)).replace(/\0.*$/s,'').trim(),8);
    if(!Number.isSafeInteger(count)||count<0||i+512+count>inflated.length)throw new Error('Corrupt Qaroshi archive member');
    if(name.startsWith('public/data/')&&name.split('/').length===3&&name.endsWith('.json')){
      const key=name.slice('public/data/'.length,-'.json'.length);
      if(!EXPECTED_KEYS.has(key)||Object.hasOwn(result,key))throw new Error('Unexpected Qaroshi dataset entry');
      result[key]=JSON.parse(decoder.decode(inflated.subarray(i+512,i+512+count)));
    }
    i+=512+512*Math.ceil(count/512);
  }
  if(Object.keys(result).length!==6||![...EXPECTED_KEYS].every(k=>Object.hasOwn(result,k))||
     result.meta?.lexical_count!==30001||result.meta?.examples_count!==4383||
     result.lexicon?.length!==30001||result.examples?.length!==4383||
     result.frames?.audited?.length!==400||result.resonances?.length!==16){
    throw new Error('The published Qaroshi dictionary or grammar is incomplete.');
  }
  return result;
}

const nativeFetch=window.fetch.bind(window);
const dataset=hydrateSnapshot(async i=>{
  const path='./.snapshot/part'+String(i).padStart(2,'0')+'.bin';
  const response=await nativeFetch(path);
  if(!response.ok)throw new Error('Failed to load '+path+' (HTTP '+response.status+')');
  return new Uint8Array(await response.arrayBuffer());
});
// The existing translator reads its six datasets through fetch(). Serve them
// from the pinned, verified snapshot instead of duplicating 10 MB of JSON.
window.fetch=(input,options)=>{
  const uri=typeof input==='string'?input:input?.url;
  const url=new URL(uri,document.baseURI);
  const m=url.origin===location.origin && url.pathname.match(/\/data\/(lexicon|examples|frames|resonances|phonemes|meta)\.json$/);
  if(m)return dataset.then(data=>new Response(JSON.stringify(data[m[1]]),{status:200,headers:{'Content-Type':'application/json; charset=utf-8'}}));
  return nativeFetch(input,options);
};
await import('./app.mjs');
