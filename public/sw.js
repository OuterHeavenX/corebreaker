const CACHE='corebreaker-v0.2.0';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icon.svg']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('corebreaker-')&&x!==CACHE).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request))) });
