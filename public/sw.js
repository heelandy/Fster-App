// Minimal service worker — its only job is to make the app installable as a PWA
// (browsers want a registered worker with a fetch handler). It deliberately does
// NOT cache responses: this is an authenticated app, and caching pages/API data
// could serve another user stale or private content. Every request passes straight
// through to the network (the browser handles it normally).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Passthrough: not calling event.respondWith() lets the browser fetch as usual.
});
