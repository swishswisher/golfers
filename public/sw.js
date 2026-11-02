const CACHE='clubline-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.add('/offline.html')));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
// Never cache authenticated pages, API responses, messages, files or payment data.
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))});
self.addEventListener('push',event=>{let p={};try{p=event.data.json()}catch{}event.waitUntil(self.registration.showNotification(p.title||'Clubline update',{body:p.body||'Open Clubline to see your update.',tag:p.id,data:{url:typeof p.url==='string'&&p.url.startsWith('/app/')?p.url:'/app'},icon:'/icon.svg'}))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow(event.notification.data?.url||'/app'))});
