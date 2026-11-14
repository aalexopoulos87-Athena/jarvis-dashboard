# JARVIS (phone app)

A J.A.R.V.I.S.-style HUD dashboard packaged as an installable web app (PWA).

**Install on Android (Chrome):** open the site, tap the ⋮ menu → **Add to home screen → Install**, then open **JARVIS** from the home screen.
Tap once to initialize (enables sound), allow the microphone when asked, and allow location if you want local weather (or set a city with **SETUP**).

- Portrait phones get a stacked layout (ring, status, swipeable cards, pinned input bar with a big mic button).
- Landscape and desktop show the full HUD.
- Works offline for the app shell, fonts and voice clips (weather and speech input need internet).
- Panels show **EXAMPLE DATA** only. Requests are not connected to any backend (`WEBHOOK_URL` / `RESPONSES_URL` are empty in `config.js`).

Fonts: Orbitron and Rajdhani (SIL Open Font License, `assets/fonts/OFL.txt`).
