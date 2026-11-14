// ===== JARVIS dashboard configuration =====
// Edit this file, save, and reload the page. No build step.
window.JARVIS_CONFIG = {
  // JARVIS voice clips (Paul Bettany AI pack, final cleaned set) for fixed cues.
  VOICE_DIRS: ["assets/voice/final_Paul_Bettany_AI"],

  // Requests: paste the routine webhook URL and sender key in the SETUP panel (gear).
  // They are stored in localStorage only — do not put them here.
  WEBHOOK_URL: "",
  WEBHOOK_HEADERS: {},
  SOURCE: "phone",

  // Replies topic is set via the private setup link (#topic=...) or the SETUP panel, in localStorage only.
  RESPONSES_URL: "",
  RESPONSES_POLL_SECONDS: 15,
  RESPONSES_TOPIC: "",

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
  TTS_RATE: 0.95,
  TTS_VOICE_PREFERENCE: ["Microsoft Ryan", "Google UK English Male", "Microsoft George", "Microsoft Thomas", "Daniel", "English United Kingdom", "en-GB"],
  PLAY_STARTUP_GREETING: true,
  OWNER_NAME: "Sir"
};
