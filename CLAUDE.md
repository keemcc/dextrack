# Diabetes Companion App - Project Brief for Claude Code

## What this is
A hackathon project (36-hour build). A diabetes management app: syncs with
Dexcom for glucose data, lets you save meals/workouts as templates and log
each time you eat/do one, and shows the glucose curve around that instance
so patterns become visible over time. Also has an insulin dose calculator,
A1C estimate, and dawn phenomenon tracking.

## Stack
- `backend/` - Node.js + Express. Handles Dexcom OAuth2, proxies + caches
  Dexcom's `/v3/users/self/egvs` glucose endpoint, proxies USDA FoodData
  Central for carb lookup, stores everything in a local JSON file via
  `lowdb` (v1, CommonJS API - `db.get('collection').push(...).write()` style).
- `mobile/` - Expo SDK 57 (React Native 0.86, React 19), JS not TypeScript.
  Bottom tab navigation (`@react-navigation/bottom-tabs` v7) with a native
  stack navigator nested inside the Meals and Workouts tabs for list ->
  detail navigation. Don't downgrade the SDK - Expo Go on the store only
  runs current SDKs.
- Dev networking: phone reaches the dev machine over a Tailscale tailnet.
  Backend is exposed via `tailscale serve --bg 4000` (HTTPS on the machine's
  MagicDNS name); Dexcom's redirect URI points at that HTTPS URL. Never
  hardcode the tailnet hostname in tracked files - it lives in
  `mobile/.env.local` and `backend/.env`.
- No database beyond the JSON file, no auth beyond the Dexcom OAuth token
  exchange, no TypeScript. Keep additions consistent with this - don't
  introduce a real DB, don't convert to TS, don't add a build step.

## Repo layout
```
backend/
  server.js       - all routes live here, single file
  seed-demo.js    - writes demo meals + synthetic glucose into db.json
  db.json         - created at runtime, gitignored
  .env            - Dexcom + USDA credentials (see .env.example)
mobile/
  App.js          - navigation shell
  api.js          - all fetch calls to the backend, one object: `api.xxx()`;
                    base URL from EXPO_PUBLIC_API_URL
  .env.local      - EXPO_PUBLIC_API_URL + REACT_NATIVE_PACKAGER_HOSTNAME,
                    gitignored (see .env.example; must be .env.local, Expo
                    rejects the packager hostname in a plain .env)
  components/MiniGlucoseChart.js  - reusable chart for a glucose window
  screens/        - one file per screen, plain functional components
```

## What's already built (don't rebuild these)
- Dexcom OAuth2 login flow (`/auth/login`, `/auth/callback`), token refresh
- Live + cached glucose fetching (`/glucose`, `/glucose/history`)
- USDA carb lookup (`/food/search`)
- Meal templates + logged instances, each instance tagged with a glucose
  window from -30min to +3hr (`/meals`, `/meals/:id/log`, `/meals/:id/logs`)
- Same pattern for workouts, window is -30min to +4hr (`/workouts...`).
  Windows are always answered from `glucoseHistory` (refreshed from Dexcom
  first when reachable), so seeded demo readings show up too
- Demo seed script: `node seed-demo.js [userId]` (defaults to the most
  recent login) adds 3 meal templates with 4-5 logged instances each and
  synthetic 5-min EGV curves (peak ~45-75min, back near baseline by 2-3hr)
  over the past 2 weeks. Pizza is deliberately inconsistent. Seeded records
  carry `demo: true` and are replaced on re-run. Stop the backend first -
  lowdb holds db.json in memory and would overwrite the seed
- Insulin calculator using a ratio ("1 unit : 8g carbs") and a step-based
  correction ("every 50 over target, +1 unit") - NOT a continuous formula
  (`POST /calculate-dose`)
- A1C estimate from cached glucose history, standard eAG formula (`/a1c`)
- Dawn phenomenon: average glucose rise 3am-8am across recent days
  (`/dawn-phenomenon`)
- Mobile screens: Login, Dashboard (trend + A1C card + dawn card + Log
  out, which clears the stored userId), Meals
  list -> AddMeal (with USDA search) -> MealDetail (log + history),
  Workouts (same pattern), Insulin Calc

## What to build next (priority order)

### 1. Predicted meal curve (highest priority - this is the demo centerpiece)
When a meal template has 2+ logged instances, show an averaged glucose
curve as a preview BEFORE the user logs a new instance of it.
- Backend: add `GET /meals/:id/predicted-curve?userId=` - pull all past
  logs' glucose arrays, align them by minutes-from-meal-time (not clock
  time), average the values at each aligned offset, return as a single
  curve. Only return one if there are 2+ past instances with data.
- Mobile: on `MealDetailScreen`, show this as a second dashed/lighter line
  on a chart above the "I'm eating this now" button, labeled "Predicted
  based on past X times".

### 2. Meal predictability score
A consistency label per meal template based on variance across past curves.
- Backend: add `GET /meals/:id/predictability?userId=` - compute standard
  deviation of peak glucose value across past instances. Return a label:
  low stdev (~<20 mg/dL) = "Consistent", higher = "Unpredictable", plus the
  raw number. Needs 2+ instances or return null/"not enough data".
- Mobile: show this as a small badge on the `MealsScreen` list rows and at
  the top of `MealDetailScreen`.


## Known rough edges (leave as-is, not worth fixing in 36 hours)
- Login is "paste your userId after OAuth" instead of a real deep link -
  fine for a demo where you pre-log-in before presenting. OAuth itself
  completes on the phone thanks to the tailnet redirect URI; only the
  copy/paste step remains
- Tokens stored in plaintext in `db.json` - not production-safe, don't fix
  now, just be ready to name this as a known gap if asked
- No per-request auth checks (anyone with a userId can hit any endpoint) -
  same as above, acceptable for a sandbox hackathon build

## Constraints
- This is a 36-hour hackathon build. Prioritize working + demoable over
  complete or elegant. Don't add new dependencies unless clearly necessary.
- Keep the dark theme (`#0f172a` background, `#22c55e` green accent,
  `#1e293b` card backgrounds) consistent with existing screens.
- Keep the markdown docs (`CLAUDE.md`, `README.md`, `backend/README.md`)
  in sync with the code. When a change affects setup steps, env vars,
  routes, dependencies/versions, or what's built vs. still to do, update
  the relevant docs in the same change (e.g. move a finished item from
  "What to build next" to "What's already built"). Don't put machine-
  specific values like the tailnet hostname in them - use placeholders.
- Dexcom sandbox and USDA API keys are the developer's own - don't attempt
  to sign up for accounts or generate credentials; ask if `.env` is missing
  values rather than guessing or hardcoding placeholders that look real.
