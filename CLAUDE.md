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
- `mobile/` - Expo (React Native), JS not TypeScript. Bottom tab navigation
  (`@react-navigation/bottom-tabs`) with a native stack navigator nested
  inside the Meals and Workouts tabs for list -> detail navigation.
- No database beyond the JSON file, no auth beyond the Dexcom OAuth token
  exchange, no TypeScript. Keep additions consistent with this - don't
  introduce a real DB, don't convert to TS, don't add a build step.

## Repo layout
```
backend/
  server.js       - all routes live here, single file
  db.json         - created at runtime, gitignored
  .env            - Dexcom + USDA credentials (see .env.example)
mobile/
  App.js          - navigation shell
  api.js          - all fetch calls to the backend, one object: `api.xxx()`
  components/MiniGlucoseChart.js  - reusable chart for a glucose window
  screens/        - one file per screen, plain functional components
```

## What's already built (don't rebuild these)
- Dexcom OAuth2 login flow (`/auth/login`, `/auth/callback`), token refresh
- Live + cached glucose fetching (`/glucose`, `/glucose/history`)
- USDA carb lookup (`/food/search`)
- Meal templates + logged instances, each instance tagged with a glucose
  window from -30min to +3hr (`/meals`, `/meals/:id/log`, `/meals/:id/logs`)
- Same pattern for workouts, window is -30min to +4hr (`/workouts...`)
- Insulin calculator using a ratio ("1 unit : 8g carbs") and a step-based
  correction ("every 50 over target, +1 unit") - NOT a continuous formula
  (`POST /calculate-dose`)
- A1C estimate from cached glucose history, standard eAG formula (`/a1c`)
- Dawn phenomenon: average glucose rise 3am-8am across recent days
  (`/dawn-phenomenon`)
- Mobile screens: Login, Dashboard (trend + A1C card + dawn card), Meals
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

### 3. Demo data seed script (needed regardless of priority 1/2 status)
A script (`backend/seed-demo.js`, run with `node seed-demo.js`) that, given
a userId already connected via sandbox OAuth, creates 2-3 meal templates
and 3-5 logged instances each with synthetic-but-realistic glucose curves
written directly into `db.json`'s `glucoseHistory` (don't call the real
Dexcom API for this - just fabricate plausible EGV-shaped data: gentle
rise after eating, peak ~45-60min in, gradual return to baseline by 2-3hr).
This is critical for the live demo - a fresh account has no history to show.

## Known rough edges (leave as-is, not worth fixing in 36 hours)
- Login is "paste your userId after OAuth" instead of a real deep link -
  fine for a demo where you pre-log-in before presenting
- Tokens stored in plaintext in `db.json` - not production-safe, don't fix
  now, just be ready to name this as a known gap if asked
- No per-request auth checks (anyone with a userId can hit any endpoint) -
  same as above, acceptable for a sandbox hackathon build

## Constraints
- This is a 36-hour hackathon build. Prioritize working + demoable over
  complete or elegant. Don't add new dependencies unless clearly necessary.
- Keep the dark theme (`#0f172a` background, `#22c55e` green accent,
  `#1e293b` card backgrounds) consistent with existing screens.
- Dexcom sandbox and USDA API keys are the developer's own - don't attempt
  to sign up for accounts or generate credentials; ask if `.env` is missing
  values rather than guessing or hardcoding placeholders that look real.
