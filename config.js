// ===== JARVIS dashboard configuration =====
// Edit this file, save, and reload the page. No build step.
window.JARVIS_CONFIG = {
  // JARVIS voice clips (Paul Bettany AI pack, final cleaned set) for fixed cues.
  VOICE_DIRS: ["assets/voice/final_Paul_Bettany_AI"],

  // Where typed/spoken requests are POSTed as JSON {"request": "...", "ts": 1731580000000}.
  // Leave empty until the Grok Bot routine webhook is set up.
  WEBHOOK_URL: "",

  // Optional extra headers for the webhook (e.g. {"Authorization": "Bearer ..."}). Keep secrets off shared machines.
  WEBHOOK_HEADERS: {},

  // URL polled for replies. Expected JSON: [{"id":"abc","text":"Reply to speak","ts":1731580000000}, ...]
  // or {"responses":[...]} . New ids are shown and spoken aloud. Leave empty to skip.
  RESPONSES_URL: "",
  RESPONSES_POLL_SECONDS: 15,

  // Panels data (Waiting on you / Fleet today). data.json is read when served over http;
  // data.js is the fallback when index.html is opened by double-click (file://).
  DATA_URL: "data.json",
  DATA_REFRESH_SECONDS: 60,

  // Weather (Open-Meteo, no API key). Phone app: no fixed city is stored here. It uses the phone's
  // location (asked once), or a city you set with the SETUP button (saved only on the device).
  WEATHER: null,

  // Clock / calendar time zone (IANA). Empty = the device's own time zone.
  TIMEZONE: "",
  USE_24H: true,

  // Speech
  WAKE_WORD: "jarvis",          // say "Jarvis ..." to send a request hands-free
  WAKE_WORD_ENABLED: true,      // false = mic tile is push-to-talk only
  WAKE_WORD_ON_MOBILE: false,   // phones: always-on listening beeps and drains battery, so tap-to-talk by default
  TTS_PITCH: 0.85,              // slightly lowered
  TTS_RATE: 1.0,
  TTS_VOICE_PREFERENCE: ["Microsoft Ryan", "Google UK English Male", "Microsoft George", "Microsoft Thomas", "Daniel", "English United Kingdom", "en-GB"],
  PLAY_STARTUP_GREETING: true,
  OWNER_NAME: "Sir"
};
