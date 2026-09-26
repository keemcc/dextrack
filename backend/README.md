# Diabetes App - Backend

Handles everything that has to talk to Dexcom directly (their API blocks
browser-based CORS requests, so the phone app can't call it straight from
JS — this server sits in between).

## What it does
- Runs the Dexcom OAuth2 login flow and stores/refreshes tokens automatically
- Proxies + locally caches Dexcom glucose readings (`/glucose`, `/glucose/history`)
- Looks up carbs for a food from USDA FoodData Central (`/food/search`)
- Stores meal & workout **templates**, plus a **log** of every time you
  actually ate/did one, each tagged with a glucose window (-30min to
  +3hr for meals, +4hr for workouts) so you can see the actual effect
- Calculates insulin dose from a ratio ("1 unit : 8g carbs") and a
  step-based correction rule ("every 50 over target, +1 unit")
- Estimates A1C from cached glucose readings (standard eAG formula)
- Estimates dawn phenomenon (average glucose rise, 3am-8am) from cached readings

## Setup

1. Go to https://developer.dexcom.com and create a free developer account.
2. Register an app. You'll immediately get **Sandbox** credentials — no
   approval needed for sandbox, which is fine for building/testing.
3. Set the app's redirect URI to match `DEXCOM_REDIRECT_URI` below. To log
   in from a phone, use the tailnet URL from `tailscale serve` (see the root
   README), e.g. `https://<host>/auth/callback` - the phone's browser gets
   redirected there after sign-in, so it must be reachable from the phone.
   `http://localhost:4000/auth/callback` only works when logging in from a
   browser on the dev machine itself.
4. Copy `.env.example` to `.env` and fill in your client ID/secret:
   ```
   cp .env.example .env
   ```
5. Install dependencies and run:
   ```
   npm install
   npm run dev
   ```
6. Visit `<your backend URL>/auth/login` in a browser to test the OAuth
   flow. Dexcom's sandbox lets you log in with fake test accounts (see their
   docs for sandbox test user credentials).

## USDA food lookup
`USDA_API_KEY=DEMO_KEY` works out of the box for testing but is shared by
everyone using the demo key and rate-limits fast. Get your own free key in
seconds at https://fdc.nal.usda.gov/api-key-signup.html and drop it in `.env`.

## Notes on the sandbox
Dexcom's sandbox gives you realistic simulated CGM data tied to a handful of
test accounts — you don't need a real CGM to develop against it. When you're
ready to move past 5 real users you'll need to apply for Dexcom's Limited or
Full Commercial partner tier, which involves a review (can take weeks to
months), so it's worth starting that application early if this app is going
somewhere beyond a class project.

## Important
Real CGM data is PHI (protected health info) under HIPAA. This starter is
built for learning/sandbox use — if you ever store or process *real* Dexcom
data for real users, you'd need a Business Associate Agreement with any
cloud provider you use, and proper encryption at rest/in transit.
