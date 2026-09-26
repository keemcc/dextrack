# Diabetes Companion App - Starter Project

Tracks blood sugar + trends from Dexcom, saves meals and workouts with a
history of every time you log them (each with the glucose curve from around
that time), calculates insulin doses using your own ratio and correction
rule, looks up carbs from USDA's food database, and estimates A1C and dawn
phenomenon from your cached readings. Once a meal or workout has been
logged twice, it predicts the glucose curve for the next time and rates how
consistent it is. A Gemini-powered assistant answers "I'm about to eat X"
questions, and the app can remind you to take long-acting insulin.

## Structure
```
diabetes-app/
├── backend/     Node/Express server - Dexcom OAuth, USDA lookup, all the data
└── mobile/      Expo (React Native) app - runs on your phone via Expo Go
```

## Why two parts?
Dexcom's API doesn't allow direct browser/app calls (no CORS support), so
something has to sit in the middle to do the OAuth login and fetch data on
the app's behalf. That's the backend. The phone app never talks to Dexcom
or USDA directly - it only talks to your backend.

## Getting it running

The phone reaches the dev machine over a [Tailscale](https://tailscale.com)
tailnet, so it works on any network (no LAN IPs, no venue Wi-Fi client
isolation issues). Install Tailscale on the dev machine and the phone and
sign both into the same tailnet. Below, `<host>` is the dev machine's
MagicDNS name, e.g. `mymachine.tailXXXX.ts.net` (see `tailscale status`).

**1. Expose the backend over the tailnet** (one-time; persists across reboots)
```
tailscale serve --bg 4000
```
This serves `https://<host>` -> `localhost:4000`, reachable only from
tailnet devices. The first run may ask you to enable Serve/HTTPS for the
tailnet via a link.

**2. Backend** (see `backend/README.md` for full detail)
```
cd backend
cp .env.example .env      # Dexcom sandbox creds, optionally USDA + Gemini keys
npm install
npm run dev
```
Set `DEXCOM_REDIRECT_URI=https://<host>/auth/callback` in `.env` and
register the same URI on developer.dexcom.com.

**3. Mobile app** (Expo SDK 57 - needs a current Expo Go)
```
cd mobile
cp .env.example .env.local    # set both values to your <host>
npm install
npx expo start --clear
```
Scan the QR code with Expo Go. `EXPO_PUBLIC_API_URL` is the backend URL
the app calls; `REACT_NATIVE_PACKAGER_HOSTNAME` makes the QR code point at
the tailnet host. They must live in `.env.local` (Expo refuses to load the
packager hostname from a plain `.env`), and restart with `--clear` after
changing them since `EXPO_PUBLIC_` values are baked into the bundle.

**4. Connect Dexcom**
Open the app, tap "Connect Dexcom Account," log in with a Dexcom sandbox
test account, then copy the `userId` shown and paste it back into the app.

**5. Seed demo data** (optional, for demos) - with the backend stopped, run
`node seed-demo.js <userId>` in `backend/`, then start it again. See
`backend/README.md`.

**Troubleshooting**
- *"Cannot connect to Expo CLI"* warning after switching apps (e.g. during
  login): Fast Refresh's connection dropped while Expo Go was backgrounded.
  Harmless - dismiss it or press `r` in the Expo terminal.
- App can't load at all: check Tailscale is connected on the phone, and
  that the dev machine's firewall allows port 8081 on `tailscale0`.

**Adding a teammate's phone:** either have them join the tailnet (they must
sign in to *your* tailnet, not their personal one - check the account
switcher, and approve the device in the admin console if device approval is
on), or share just the dev machine with them from the admin console
(Machines -> ... -> Share).

## What's in each screen
- **Dashboard** - live glucose trend, latest reading, estimated A1C, and a
  dawn-phenomenon summary (average early-morning rise), an Auto/Light/Dark
  theme toggle, and a Log out button that clears the saved userId and
  returns to the login screen
- **Meals** - save meal templates made of one or more foods (with USDA carb
  lookup or manual entry), then log each time you actually eat one; each
  logged instance shows the glucose curve from 30 min before to 3 hours
  after, so you can compare how the same meal behaves over time. With 2+
  logs, the detail screen shows a predicted curve (the average of past
  ones) before you log again, and a "Consistent"/"Unpredictable" badge
  appears on the list and detail screens
- **Workouts** - same pattern as meals: save a workout, log sessions, see
  blood sugar from 30 min before to 4 hours after each session, with the
  same predicted curve and consistency badge
- **Assistant** - chat about what you're about to eat or do. Gemini only
  reads the message and words the reply; the dose is calculated in code
  from your saved settings, and any adjustment based on your history is
  capped at +/-20%. Workouts get a carb suggestion, never an insulin change.
  Uses your live CGM reading (if under 20 min old) unless you type a glucose
  value, and can answer "what's my blood sugar?". Needs `GEMINI_API_KEY` in `backend/.env`
- **Insulin Calc** - enter your ratio as "1 unit : 8g carbs" and your
  correction as a step rule ("every 50 over target, +1 unit") instead of a
  raw formula - matches how most people actually think about dosing.
  Settings are saved per meal (breakfast/lunch/dinner/snack) and shared
  with the assistant. Also holds daily long-acting insulin reminders (local
  notifications; they only remind, never dose)

## A note on scope
This is a sandbox/learning build. If real users' real CGM data ever flows
through it, that data is legally protected health information (HIPAA), and
Dexcom's production API access requires an application review. Treat
anything past sandbox data as a "when it's time to launch" problem, not a
"right now" problem.
