const CACHE_NAME = 'swm-static-v1';
const ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/script.js',
  '/static/js/assistant-widget.js',
  '/static/js/notes.js',
  '/static/js/tasks.js',
  '/static/js/contacts.js',
  '/static/js/travel.js',
  '/static/js/reminders.js',
  '/static/js/calendar.js'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(self.clients.claim());
});

// Basic fetch handler: serve cached assets, and fallback to network.
self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method === 'GET') {
    ev.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
    return;
  }
  // For POST/PUT when offline, let client handle queueing
});

// Listen for messages from client if needed
self.addEventListener('message', (ev) => {
  // No-op for now
});
