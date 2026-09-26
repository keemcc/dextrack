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
  Workouts (same pattern), Insulin Calc, Assistant. Tab bar icons come
  from `@expo/vector-icons` (Ionicons)

## What to build next
Nothing pending - both original priorities (predicted meal curve,
predictability score) are built; see "Added since the brief" below.
Remaining time goes to on-device testing and demo polish.

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

## Added since the brief (predictions, assistant, themes)
- Predicted meal + workout curves: `GET /meals/:id/predicted-curve`,
  `GET /workouts/:id/predicted-curve` (2+ logs; averaged by minutes from the
  event). Shown as a lighter line on the detail screens.
- Predictability badge: `GET /meals/:id/predictability`,
  `GET /workouts/:id/predictability` ("Consistent" if stdev < 20 mg/dL; for
  workouts it's the stdev of the post-workout drop). Badge on list + detail.
- Multi-item meals: meals have `foods: [{id, name, carbs}]`, `usualCarbs` is
  their sum. `POST /meals` takes `foods`; `PUT /meals/:id` edits them.
  UI: `components/FoodListEditor.js` (Add Meal + Meal Detail).
- Gemini assistant: `POST /chat` + Assistant tab. Gemini only parses the
  message (meal/workout, carbs, matches a saved meal) and words the reply;
  the dose is computed in code (`computeDose`) and history-based adjustments
  are bounded (+/-20%, `suggestAdjustment`). Workouts get a carb suggestion,
  never an insulin change. Glucose for dosing: typed override > value
  stated in the message > live CGM reading (`getLiveGlucose`, only if
  <=20 min old); with none, no correction is added. It also answers
  "what's my blood sugar?". Needs `GEMINI_API_KEY` (optional `GEMINI_MODEL`,
  default `gemini-3.8-flash`) in `backend/.env`.
- Insulin settings are saved per meal slot (breakfast/lunch/dinner/snack) in
  AsyncStorage (`mobile/settings.js`), shared by Insulin Calc and the
  assistant.
- Light/dark theme: `mobile/theme.js` (`useTheme()`); screens build styles
  with `makeStyles(colors)`. Toggle (Auto/Light/Dark) is on the Dashboard.
- Past windows: `ensureMealWindowsCached` / `ensureWorkoutWindowsCached` pull
  the "after" readings from Dexcom once a window has finished.
- Long-acting insulin reminders: card on the Insulin Calc tab
  (`components/InsulinReminders.js`, logic in `mobile/reminders.js`). Daily
  local notifications via `expo-notifications`, list kept in AsyncStorage.
  Reminder only - never suggests or changes a dose. `expo-notifications` is
  loaded in a try/catch, so the rest of the app runs without it.
