/* Orbfall service worker: cache-first app shell.
   Bump CACHE with every shipped change to index.html (or anything in SHELL). Installed players only receive a new
   build when this file changes; the previous cache is deleted on activate, and skipWaiting + clients.claim mean the
   next launch is the new build. There is deliberately no forced reload, so an update never interrupts a run. */
'use strict';
var CACHE='orbfall-shell-0.8.1';
var SHELL=['./','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png',
  'icons/maskable-192.png','icons/maskable-512.png','icons/apple-touch-icon.png'];

function precache(cache,url){
  return fetch(new Request(url,{cache:'reload'})).then(function(res){
    if(!res.ok)throw new Error('Orbfall shell: '+url+' returned '+res.status);
    /* hosts with clean URLs answer ./index.html with a redirect; a redirected response cannot be replayed for a
       navigation, so the shell is cached under ./ only, and a redirected body is re-wrapped as a plain response */
    if(res.redirected)res=new Response(res.body,{status:res.status,statusText:res.statusText,headers:res.headers});
    return cache.put(url,res);
  });
}
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(CACHE).then(function(cache){
    return Promise.all(SHELL.map(function(url){return precache(cache,url);}));
  }).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
  }).then(function(){return self.clients.claim();}));
});
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  /* every navigation inside the scope is the game itself: answer with the cached shell, else the network */
  var lookup=req.mode==='navigate'?caches.match('./'):caches.match(req,{ignoreSearch:true});
  e.respondWith(lookup.then(function(hit){return hit||fetch(req);}));
});
