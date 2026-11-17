/* RAV PWA - cache only public offline help and non-sensitive icons.
   Never cache the portal HTML, user profiles, API responses, chat, DMs or audio. */
const SHELL_CACHE = 'rav-public-offline-v1';
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(PRECACHE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('rav-public-offline-')&&key!==SHELL_CACHE).map(key=>caches.delete(key))))
  .then(()=>self.clients.claim())
 );
});
self.addEventListener('fetch', event => {
 const req=event.request;
 if(req.method!=='GET') return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 // Network-only authenticated portal; show an informational offline page instead of stale personal data.
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));
  return;
 }
 // Only cache static public icons and offline notice.
 if(PRECACHE.includes(url.pathname)){
  event.respondWith(caches.match(url.pathname).then(hit=>hit||fetch(req)));
 }
});
