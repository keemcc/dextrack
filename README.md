# Diabetes Companion App - Starter Project

Tracks blood sugar + trends from Dexcom, saves meals and workouts with a
history of every time you log them (each with the glucose curve from around
that time), calculates insulin doses using your own ratio and correction
rule, looks up carbs from USDA's food database, and estimates A1C and dawn
phenomenon from your cached readings.

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

**1. Backend** (see `backend/README.md` for full detail)
```
cd backend
cp .env.example .env      # fill in Dexcom sandbox creds + optionally a USDA key
npm install
npm run dev
```

**2. Mobile app**
```
cd mobile
npm install
npx expo start
```
Scan the QR code with Expo Go on your phone. Update `API_BASE_URL` in
`mobile/api.js` to your computer's LAN IP (not `localhost`) so your phone
can actually reach it.

**3. Connect Dexcom**
Open the app, tap "Connect Dexcom Account," log in with a Dexcom sandbox
test account, then paste the `userId` shown back into the app.

## What's in each screen
- **Dashboard** - live glucose trend, latest reading, estimated A1C, and a
  dawn-phenomenon summary (average early-morning rise)
- **Meals** - save meal templates (with USDA carb lookup or manual entry),
  then log each time you actually eat one; each logged instance shows the
  glucose curve from 30 min before to 3 hours after, so you can compare
  how the same meal behaves over time
- **Workouts** - same pattern as meals: save a workout, log sessions, see
  blood sugar from 30 min before to 4 hours after each session
- **Insulin Calc** - enter your ratio as "1 unit : 8g carbs" and your
  correction as a step rule ("every 50 over target, +1 unit") instead of a
  raw formula - matches how most people actually think about dosing

## A note on scope
This is a sandbox/learning build. If real users' real CGM data ever flows
through it, that data is legally protected health information (HIPAA), and
Dexcom's production API access requires an application review. Treat
anything past sandbox data as a "when it's time to launch" problem, not a
"right now" problem.
