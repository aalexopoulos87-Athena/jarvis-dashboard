/* JARVIS service worker: app shell + fonts + voice clips cached for offline start. */
const VERSION = "jarvis-v12.1";
const SHELL = [
  "./", "index.html", "config.js", "data.js", "data.json", "manifest.webmanifest",
  "assets/app-v11.css", "assets/app-v11.1.js", "assets/app-v12.js", "assets/phone-v11.css", "assets/email-v12.css",
  "assets/sphere.js", "assets/vendor/three.min.js",
  "assets/fonts/Orbitron.ttf", "assets/fonts/Rajdhani-Regular.ttf", "assets/fonts/Rajdhani-Medium.ttf",
  "assets/fonts/Rajdhani-SemiBold.ttf", "assets/fonts/Rajdhani-Bold.ttf",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png", "assets/icons/icon-maskable-192.png",
  "assets/icons/icon-maskable-512.png", "assets/icons/apple-touch-icon.png", "assets/icons/favicon-48.png",
  ...["StartDrive2","StartDrive5","StartDrive6","StartDrive7","StartDrive9","TickerPoints",
    "var_boot_tod_welcome_morning","var_boot_tod_welcome_afternoon","var_boot_tod_welcome_evening",
    "var_boot_tod_standby_morning","var_boot_tod_standby_afternoon","var_boot_tod_standby_evening",
    "var_boot_tod_pleasure_morning","var_boot_tod_pleasure_afternoon","var_boot_tod_pleasure_evening",
    "var_boot_order","var_boot_hello",
    "var_ready_service","var_ready_here","var_ready_listening","var_ready_whenever",
    "var_ready_tod_morning","var_ready_tod_afternoon","var_ready_tod_evening",
    "var_error_uplink","var_error_through","var_error_afraid","var_error_transmission","var_error_complete"]
    .map(c => `assets/voice/final_Paul_Bettany_AI/${c}.mp3`)
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // weather etc. go straight to network
  const path = url.pathname;
  const fresh = req.mode === "navigate" || /\.(html|js|css|json)$/.test(path) || path.endsWith("/");
  if (fresh) {                                             // network first, cache fallback
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req.mode === "navigate" ? "index.html" : stripQ(req), cp)); }
      return r;
    }).catch(() => caches.match(req.mode === "navigate" ? "index.html" : stripQ(req), {ignoreSearch: true})));
    return;
  }
  // cache first (shell, fonts, icons, voice clips); Range requests from <audio> get the full body
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(r => {
    if (r.ok && r.status === 200) { const cp = r.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
    return r;
  })));
});
function stripQ(req) { const u = new URL(req.url); u.search = ""; return u.toString(); }
