const CACHE='qaroshi-translator-root-v2';
const SHELL=['./','./index.html','./bootstrap.mjs','./app.mjs','./src/engine.mjs','./styles.css','./manifest.webmanifest','./favicon.svg',...Array.from({length:7},(_,i)=>'./.snapshot/part'+String(i).padStart(2,'0')+'.bin')];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(res=>{
    if(res.ok){const clone=res.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone));}
    return res;
  })));
});