# JARVIS (phone app)

A J.A.R.V.I.S.-style HUD dashboard packaged as an installable web app (PWA).

**Install on Android (Chrome):** open the site, tap the ⋮ menu → **Add to home screen → Install**, then open **JARVIS** from the home screen.
Tap once to initialize (enables sound), allow the microphone when asked, and allow location if you want local weather (or set a city with **SETUP**).

## Connect to Chief of Staff

1. Open the private setup link you were given (it saves the replies feed on this phone, then disappears from the address bar).
2. Tap **SETUP** (gear) and paste the **webhook URL** and **sender key** from your Grok Bot routine panel. They stay on this device only.
3. If a browser blocks speech, use the one-time **TAP TO ENABLE VOICE** prompt.

Requests you type or speak are sent to Chief of Staff. Replies appear in the activity log and are read aloud in a calm British voice after a short JARVIS cue. The systems pill shows **CONNECTED** when the webhook is saved and the replies feed is open.

- Portrait phones get a stacked layout (ring, status, swipeable cards, pinned input bar with a big mic button).
- Landscape and desktop show the full HUD.
- Works offline for the app shell, fonts and voice clips (weather, sending requests, and speech input need internet).
- Panels show **EXAMPLE DATA** only until a private data feed is wired.

Fonts: Orbitron and Rajdhani (SIL Open Font License, `assets/fonts/OFL.txt`).
