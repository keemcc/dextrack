require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// ---- tiny local "database" (JSON file) ----
// Good enough for a school project. Swap for a real DB before this ever touches real patient data.
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({
  tokens: {},
  meals: [],        // meal templates: {id, userId, name, usualCarbs, createdAt}
  mealLogs: [],      // instances of eating a meal: {id, mealId, userId, carbs, loggedAt}
  workouts: [],      // workout templates: {id, userId, name, createdAt}
  workoutLogs: [],   // instances of doing a workout: {id, workoutId, userId, durationMinutes, notes, loggedAt}
  glucoseHistory: [], // cached readings so the app has local history, not just live pulls: {userId, systemTime, value, trend}
}).write();

const {
  DEXCOM_CLIENT_ID,
  DEXCOM_CLIENT_SECRET,
  DEXCOM_REDIRECT_URI,
  DEXCOM_API_BASE,
  USDA_API_KEY,
  PORT,
  GEMINI_API_KEY,
  GEMINI_MODEL,
} = process.env;

// =====================================================================
// AUTH - Dexcom OAuth2 authorization code flow
// =====================================================================

app.get('/auth/login', (req, res) => {
  const authUrl =
    `${DEXCOM_API_BASE}/v2/oauth2/login` +
    `?client_id=${DEXCOM_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(DEXCOM_REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=offline_access`;
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing authorization code');

  try {
    const tokenRes = await axios.post(
      `${DEXCOM_API_BASE}/v2/oauth2/token`,
      new URLSearchParams({
        client_id: DEXCOM_CLIENT_ID,
        client_secret: DEXCOM_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: DEXCOM_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userId = uuidv4();
    const { access_token, refresh_token, expires_in } = tokenRes.data;

    db.get('tokens')
      .set(userId, { access_token, refresh_token, expires_at: Date.now() + expires_in * 1000 })
      .write();

    res.send(`
      <h2>Connected to Dexcom!</h2>
      <p>Your app userId is:</p>
      <code style="font-size:1.2em">${userId}</code>
      <p>Paste this into the mobile app's login screen (dev mode) or wire up a deep link.</p>
    `);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('Token exchange failed');
  }
});

async function ensureFreshToken(userId) {
  const record = db.get('tokens').get(userId).value();
  if (!record) throw new Error('Unknown userId - log in again');

  if (Date.now() < record.expires_at - 60000) {
    return record.access_token;
  }

  const refreshRes = await axios.post(
    `${DEXCOM_API_BASE}/v2/oauth2/token`,
    new URLSearchParams({
      client_id: DEXCOM_CLIENT_ID,
      client_secret: DEXCOM_CLIENT_SECRET,
      refresh_token: record.refresh_token,
      grant_type: 'refresh_token',
      redirect_uri: DEXCOM_REDIRECT_URI,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token, expires_in } = refreshRes.data;
  db.get('tokens')
    .set(userId, { access_token, refresh_token, expires_at: Date.now() + expires_in * 1000 })
    .write();

  return access_token;
}

// =====================================================================
// CGM DATA - fetches + locally caches Dexcom glucose readings
// =====================================================================

// Pulls a window of readings from Dexcom and saves them into glucoseHistory
// so the app has a running local history, not just whatever's live right now.
async function fetchAndCacheGlucose(userId, startDate, endDate) {
  const token = await ensureFreshToken(userId);
  const dexRes = await axios.get(`${DEXCOM_API_BASE}/v3/users/self/egvs`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { startDate, endDate },
  });

  const records = dexRes.data.records || dexRes.data.egvs || [];
  const history = db.get('glucoseHistory');

  records.forEach((r) => {
    const exists = history
      .find({ userId, systemTime: r.systemTime })
      .value();
    if (!exists) {
      history.push({
        userId,
        systemTime: r.systemTime,
        value: r.value,
        trend: r.trend || r.trendDirection || null,
      }).write();
    }
  });

  return records;
}

// GET /glucose?userId=...&startDate=...&endDate=...  (live dashboard use)
app.get('/glucose', async (req, res) => {
  const { userId, startDate, endDate } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const records = await fetchAndCacheGlucose(userId, startDate, endDate);
    res.json({ records });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch glucose data' });
  }
});

// GET /glucose/history?userId=&hours=24  - local cached history, refreshing recent data first
app.get('/glucose/history', async (req, res) => {
  const { userId, hours } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const windowHours = Number(hours) || 24;
  const end = new Date();
  const start = new Date(end.getTime() - windowHours * 60 * 60 * 1000);

  try {
    await fetchAndCacheGlucose(userId, start.toISOString(), end.toISOString());
  } catch (err) {
    console.warn('Live refresh failed, falling back to cached history only:', err.message);
  }

  const cached = db
    .get('glucoseHistory')
    .filter((r) => r.userId === userId && new Date(r.systemTime) >= start)
    .sortBy('systemTime')
    .value();

  res.json({ records: cached });
});

// Internal helper: get glucose readings around a specific timestamp
// (used by meal/workout logging to show "what happened to my blood sugar")
async function getGlucoseWindow(userId, centerTime, minutesBefore, minutesAfter) {
  const center = new Date(centerTime);
  const start = new Date(center.getTime() - minutesBefore * 60 * 1000);
  const end = new Date(center.getTime() - -minutesAfter * 60 * 1000); // +minutesAfter

  // Refresh the cache from Dexcom if we can, then always answer from the
  // cache - it holds everything Dexcom returned plus seeded demo readings.
  try {
    await fetchAndCacheGlucose(userId, start.toISOString(), end.toISOString());
  } catch (err) {
    // Dexcom unreachable - whatever's cached for the window will have to do
  }

  return db
    .get('glucoseHistory')
    .filter(
      (r) =>
        r.userId === userId &&
        new Date(r.systemTime) >= start &&
        new Date(r.systemTime) <= end
    )
    .sortBy('systemTime')
    .value();
}

// Pull in the Dexcom data for any past windows that were logged before they had
// finished (so the "after" part was not cached yet). Each log is fetched once
// after its window ends, then flagged `windowCached` so later calls skip Dexcom.
async function ensureWindowsCached(collection, idField, id, userId, afterMinutes) {
  const logs = db.get(collection).filter({ [idField]: id, userId }).value();
  await Promise.all(
    logs
      .filter((l) => !l.windowCached && new Date(l.loggedAt).getTime() + afterMinutes * 60000 < Date.now())
      .map(async (l) => {
        const center = new Date(l.loggedAt).getTime();
        try {
          await fetchAndCacheGlucose(
            userId,
            new Date(center - 30 * 60000).toISOString(),
            new Date(center + afterMinutes * 60000).toISOString()
          );
          db.get(collection).find({ id: l.id }).assign({ windowCached: true }).write();
        } catch (err) {
          // Dexcom unreachable - try again next time, answer from the cache for now
        }
      })
  );
}

const ensureMealWindowsCached = (mealId, userId) => ensureWindowsCached('mealLogs', 'mealId', mealId, userId, 180);
const ensureWorkoutWindowsCached = (workoutId, userId) =>
  ensureWindowsCached('workoutLogs', 'workoutId', workoutId, userId, 240);

// Cache-only version of the meal window, with each reading tagged by minutes
// from the meal time. Used by the prediction/predictability endpoints.
function getCachedCurves(collection, idField, id, userId, afterMinutes) {
  const logs = db.get(collection).filter({ [idField]: id, userId }).value();
  return logs
    .map((log) => {
      const center = new Date(log.loggedAt).getTime();
      const points = db
        .get('glucoseHistory')
        .filter(
          (r) =>
            r.userId === userId &&
            new Date(r.systemTime).getTime() >= center - 30 * 60000 &&
            new Date(r.systemTime).getTime() <= center + afterMinutes * 60000
        )
        .value()
        .map((r) => ({
          offsetMin: (new Date(r.systemTime).getTime() - center) / 60000,
          value: r.value,
        }));
      return { log, points };
    })
    .filter((c) => c.points.length >= 2);
}

const getCachedMealCurves = (mealId, userId) => getCachedCurves('mealLogs', 'mealId', mealId, userId, 180);
const getCachedWorkoutCurves = (workoutId, userId) => getCachedCurves('workoutLogs', 'workoutId', workoutId, userId, 240);

// average several curves, aligned by minutes from the event (5 min buckets)
function averageCurves(curves) {
  const buckets = {};
  curves.forEach(({ points }) => {
    points.forEach((p) => {
      const key = Math.round(p.offsetMin / 5) * 5;
      (buckets[key] = buckets[key] || []).push(p.value);
    });
  });
  return Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b)
    .map((offsetMin) => {
      const vals = buckets[offsetMin];
      return { offsetMin, value: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) };
    });
}

function stdevLabel(values) {
  if (values.length < 2) return { label: null, stdev: null, count: values.length, note: 'not enough data' };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  const stdev = Math.round(Math.sqrt(variance) * 10) / 10;
  return { label: stdev < 20 ? 'Consistent' : 'Unpredictable', stdev, count: values.length, mean: Math.round(mean) };
}

// =====================================================================
// FOOD / CARB LOOKUP - USDA FoodData Central
// =====================================================================

// GET /food/search?query=banana
app.get('/food/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const usdaRes = await axios.get('https://api.nal.usda.gov/fdc/v1/foods/search', {
      params: {
        query,
        pageSize: 15,
        api_key: USDA_API_KEY || 'DEMO_KEY',
      },
    });

    const results = (usdaRes.data.foods || []).map((food) => {
      const carbNutrient = (food.foodNutrients || []).find((n) =>
        (n.nutrientName || '').toLowerCase().includes('carbohydrate')
      );
      return {
        fdcId: food.fdcId,
        description: food.description,
        brandName: food.brandOwner || null,
        // USDA generic/foundation foods report per 100g; branded foods often report per serving.
        carbsPer100g: carbNutrient ? carbNutrient.value : null,
        servingSize: food.servingSize || null,
        servingSizeUnit: food.servingSizeUnit || null,
      };
    });

    res.json({ results });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Food lookup failed' });
  }
});

// =====================================================================
// MEALS - templates + a log of every time you actually ate one
// =====================================================================

// Create a meal template ("Chicken Alfredo", usual carbs ~65g)
// foods = [{ id?, name, carbs }] - a meal can have several food items; usualCarbs is their sum
function normalizeFoods(foods) {
  if (!Array.isArray(foods)) return [];
  return foods
    .filter((f) => f && String(f.name || '').trim())
    .map((f) => ({ id: f.id || uuidv4(), name: String(f.name).trim(), carbs: Math.max(0, Number(f.carbs) || 0) }));
}
const sumFoodCarbs = (foods) => Math.round(foods.reduce((a, f) => a + f.carbs, 0));

app.post('/meals', (req, res) => {
  const { userId, name, usualCarbs } = req.body;
  const foods = normalizeFoods(req.body.foods);
  const carbsTotal = foods.length ? sumFoodCarbs(foods) : usualCarbs;
  if (!userId || !name || carbsTotal == null) {
    return res.status(400).json({ error: 'userId, name, and foods (or usualCarbs) are required' });
  }
  const meal = { id: uuidv4(), userId, name, usualCarbs: carbsTotal, foods, createdAt: Date.now() };
  db.get('meals').push(meal).write();
  res.status(201).json(meal);
});

app.get('/meals', (req, res) => {
  const { userId } = req.query;
  res.json(db.get('meals').filter({ userId }).value());
});

// Edit a meal: rename and/or replace its food list (add/remove items). usualCarbs follows the foods.
app.put('/meals/:id', (req, res) => {
  const meal = db.get('meals').find({ id: req.params.id }).value();
  if (!meal) return res.status(404).json({ error: 'Meal not found' });

  const updates = {};
  if (req.body.name && String(req.body.name).trim()) updates.name = String(req.body.name).trim();
  if (Array.isArray(req.body.foods)) {
    updates.foods = normalizeFoods(req.body.foods);
    if (updates.foods.length) updates.usualCarbs = sumFoodCarbs(updates.foods);
  }
  db.get('meals').find({ id: req.params.id }).assign(updates).write();
  res.json(db.get('meals').find({ id: req.params.id }).value());
});

app.delete('/meals/:id', (req, res) => {
  db.get('meals').remove({ id: req.params.id }).write();
  db.get('mealLogs').remove({ mealId: req.params.id }).write();
  res.status(204).end();
});

// Log an instance of eating this meal "just now" (or at a given time), and
// capture the glucose window around it: 30 min before -> 3 hours after.
app.post('/meals/:id/log', async (req, res) => {
  const { userId, carbs, loggedAt } = req.body;
  const meal = db.get('meals').find({ id: req.params.id }).value();
  if (!meal) return res.status(404).json({ error: 'Meal not found' });

  const timestamp = loggedAt || new Date().toISOString();
  const log = {
    id: uuidv4(),
    mealId: req.params.id,
    userId,
    carbs: carbs != null ? carbs : meal.usualCarbs,
    loggedAt: timestamp,
  };
  db.get('mealLogs').push(log).write();

  // Kick off caching the glucose window in the background - don't make the
  // user wait on it, especially for a meal logged just now (data won't
  // exist for the "after" part yet anyway).
  getGlucoseWindow(userId, timestamp, 30, 180).catch(() => {});

  res.status(201).json(log);
});

// Get the recent history of times this meal was eaten, each with its glucose curve
app.get('/meals/:id/logs', async (req, res) => {
  const { userId, limit } = req.query;
  const logs = db
    .get('mealLogs')
    .filter({ mealId: req.params.id, userId })
    .sortBy('loggedAt')
    .takeRight(Number(limit) || 5)
    .reverse()
    .value();

  const withGlucose = await Promise.all(
    logs.map(async (log) => ({
      ...log,
      glucose: await getGlucoseWindow(userId, log.loggedAt, 30, 180),
    }))
  );

  res.json(withGlucose);
});

// GET /meals/:id/predicted-curve?userId=  - average of past curves, aligned by minutes from meal time
app.get('/meals/:id/predicted-curve', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  await ensureMealWindowsCached(req.params.id, userId);

  const curves = getCachedMealCurves(req.params.id, userId);
  if (curves.length < 2) {
    return res.json({ curve: null, count: curves.length, note: 'Need at least 2 logged instances with glucose data.' });
  }

  res.json({ curve: averageCurves(curves), count: curves.length });
});

// GET /meals/:id/predictability?userId=  - stdev of peak glucose across past instances
app.get('/meals/:id/predictability', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  await ensureMealWindowsCached(req.params.id, userId);

  const peaks = getCachedMealCurves(req.params.id, userId)
    .map(({ points }) => Math.max(...points.filter((p) => p.offsetMin >= 0).map((p) => p.value)))
    .filter(Number.isFinite);

  const r = stdevLabel(peaks);
  res.json({ ...r, avgPeak: r.mean });
});

// =====================================================================
// WORKOUTS - same pattern as meals: templates + logged instances + glucose effect
// =====================================================================

app.post('/workouts', (req, res) => {
  const { userId, name } = req.body;
  if (!userId || !name) return res.status(400).json({ error: 'userId and name are required' });
  const workout = { id: uuidv4(), userId, name, createdAt: Date.now() };
  db.get('workouts').push(workout).write();
  res.status(201).json(workout);
});

app.get('/workouts', (req, res) => {
  const { userId } = req.query;
  res.json(db.get('workouts').filter({ userId }).value());
});

app.delete('/workouts/:id', (req, res) => {
  db.get('workouts').remove({ id: req.params.id }).write();
  db.get('workoutLogs').remove({ workoutId: req.params.id }).write();
  res.status(204).end();
});

app.post('/workouts/:id/log', async (req, res) => {
  const { userId, durationMinutes, notes, loggedAt } = req.body;
  const workout = db.get('workouts').find({ id: req.params.id }).value();
  if (!workout) return res.status(404).json({ error: 'Workout not found' });

  const timestamp = loggedAt || new Date().toISOString();
  const log = {
    id: uuidv4(),
    workoutId: req.params.id,
    userId,
    durationMinutes: durationMinutes || null,
    notes: notes || '',
    loggedAt: timestamp,
  };
  db.get('workoutLogs').push(log).write();

  // Workouts can drop blood sugar for hours afterward, so use a longer window than meals.
  getGlucoseWindow(userId, timestamp, 30, 240).catch(() => {});

  res.status(201).json(log);
});

app.get('/workouts/:id/logs', async (req, res) => {
  const { userId, limit } = req.query;
  const logs = db
    .get('workoutLogs')
    .filter({ workoutId: req.params.id, userId })
    .sortBy('loggedAt')
    .takeRight(Number(limit) || 5)
    .reverse()
    .value();

  const withGlucose = await Promise.all(
    logs.map(async (log) => ({
      ...log,
      glucose: await getGlucoseWindow(userId, log.loggedAt, 30, 240),
    }))
  );

  res.json(withGlucose);
});

// GET /workouts/:id/predicted-curve?userId=
app.get('/workouts/:id/predicted-curve', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  await ensureWorkoutWindowsCached(req.params.id, userId);

  const curves = getCachedWorkoutCurves(req.params.id, userId);
  if (curves.length < 2) {
    return res.json({ curve: null, count: curves.length, note: 'Need at least 2 logged sessions with glucose data.' });
  }
  res.json({ curve: averageCurves(curves), count: curves.length });
});

// GET /workouts/:id/predictability?userId=  - stdev of the glucose drop (baseline minus lowest point after)
app.get('/workouts/:id/predictability', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  await ensureWorkoutWindowsCached(req.params.id, userId);

  const drops = getCachedWorkoutCurves(req.params.id, userId)
    .map(({ points }) => {
      const before = points.filter((p) => p.offsetMin <= 0).map((p) => p.value);
      const after = points.filter((p) => p.offsetMin > 0).map((p) => p.value);
      if (!before.length || !after.length) return null;
      const baseline = before.reduce((a, b) => a + b, 0) / before.length;
      return baseline - Math.min(...after);
    })
    .filter((d) => d != null);

  const r = stdevLabel(drops);
  res.json({ ...r, avgDrop: r.mean });
});

// =====================================================================
// INSULIN CALCULATOR - ratio-style input ("1 unit per 8g carbs") + step-based correction
// =====================================================================

// Body shape:
// {
//   carbs: 60,
//   currentGlucose: 220,
//   ratioUnits: 1, ratioCarbs: 8,           // "1:8"
//   correctionStepAmount: 50,               // every 50 mg/dL over target...
//   correctionStepUnits: 1,                 // ...add 1 unit
//   target: 120
// }
function computeDose({ carbs, currentGlucose, ratioUnits, ratioCarbs, correctionStepAmount, correctionStepUnits, target }) {
  // carb dose scales normally (60g at a 1:8 ratio = 7.5 units)
  const carbDose = (carbs / ratioCarbs) * ratioUnits;

  // correction dose is a STEP function, not continuous: only whole steps over target count.
  // e.g. 220 current, target 120, step of 50/1unit -> (220-120)/50 = 2 steps -> +2 units
  const over = Math.max(0, currentGlucose - target);
  const steps = Math.floor(over / correctionStepAmount);
  const correctionDose = steps * correctionStepUnits;

  return {
    carbDose: Math.round(carbDose * 10) / 10,
    correctionDose,
    totalDose: Math.round((carbDose + correctionDose) * 10) / 10,
  };
}

app.post('/calculate-dose', (req, res) => {
  const {
    carbs,
    currentGlucose,
    ratioUnits,
    ratioCarbs,
    correctionStepAmount,
    correctionStepUnits,
    target,
  } = req.body;

  const required = { carbs, currentGlucose, ratioUnits, ratioCarbs, correctionStepAmount, correctionStepUnits, target };
  const missing = Object.entries(required).filter(([, v]) => v == null);
  if (missing.length) {
    return res.status(400).json({ error: `Missing fields: ${missing.map(([k]) => k).join(', ')}` });
  }

  const { carbDose, correctionDose, totalDose } = computeDose(req.body);

  res.json({
    carbDose,
    correctionDose,
    totalDose,
    disclaimer:
      'This is a school-project calculation, not medical advice. Always confirm doses with a doctor or diabetes care team.',
  });
});

// =====================================================================
// CHATBOT - Gemini parses what you're eating; the dose math stays deterministic
// =====================================================================

async function callGemini(prompt, { json = false } = {}) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set in backend/.env');
  const model = GEMINI_MODEL || 'gemini-3.8-flash';
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: json ? { responseMimeType: 'application/json', temperature: 0.2 } : { temperature: 0.5 },
  };

  // Retry a couple of times on temporary overload (503) / rate limit (429)
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        body,
        { headers: { 'x-goog-api-key': GEMINI_API_KEY }, timeout: 20000 }
      );
      return r.data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    } catch (err) {
      const status = err.response?.status;
      if ((status === 503 || status === 429) && attempt < 2) {
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// Summarize past instances of a saved meal from cached glucose data.
function summarizeMealHistory(mealId, userId) {
  const curves = getCachedMealCurves(mealId, userId);
  if (curves.length < 2) return null;
  const stats = curves.map(({ points }) => {
    const before = points.filter((p) => p.offsetMin <= 0);
    const after = points.filter((p) => p.offsetMin > 0);
    const baseline = before.length ? before.reduce((a, p) => a + p.value, 0) / before.length : points[0].value;
    return {
      baseline,
      peak: Math.max(...after.map((p) => p.value)),
      low: Math.min(...after.filter((p) => p.offsetMin >= 90).map((p) => p.value), Infinity),
    };
  });
  const avg = (k) => Math.round(stats.reduce((a, s) => a + s[k], 0) / stats.length);
  const lows = stats.map((s) => s.low).filter(Number.isFinite);
  return {
    count: curves.length,
    avgBaseline: avg('baseline'),
    avgPeak: avg('peak'),
    lowestLateValue: lows.length ? Math.min(...lows) : null,
  };
}

// Deterministic, bounded adjustment (max +/-20%). Gemini only explains it.
function suggestAdjustment(history) {
  if (!history) return { percent: 0, reason: 'no history' };
  if (history.lowestLateValue != null && history.lowestLateValue < 75) {
    return { percent: -15, reason: `glucose dropped as low as ${history.lowestLateValue} mg/dL 1.5-3h after this meal before` };
  }
  if (history.avgPeak > 200) return { percent: 15, reason: `glucose averaged a peak of ${history.avgPeak} mg/dL after this meal` };
  if (history.avgPeak > 180) return { percent: 10, reason: `glucose averaged a peak of ${history.avgPeak} mg/dL after this meal` };
  return { percent: 0, reason: `glucose averaged a peak of ${history.avgPeak} mg/dL, within a reasonable range` };
}

// Summarize past sessions of a saved workout from cached glucose data.
function summarizeWorkoutHistory(workoutId, userId) {
  const curves = getCachedWorkoutCurves(workoutId, userId);
  const stats = curves
    .map(({ points }) => {
      const before = points.filter((p) => p.offsetMin <= 0).map((p) => p.value);
      const after = points.filter((p) => p.offsetMin > 0).map((p) => p.value);
      if (!before.length || !after.length) return null;
      const baseline = before.reduce((a, b) => a + b, 0) / before.length;
      return { baseline, low: Math.min(...after) };
    })
    .filter(Boolean);
  if (stats.length < 2) return null;
  const avg = (k) => Math.round(stats.reduce((a, x) => a + x[k], 0) / stats.length);
  return {
    count: stats.length,
    avgBaseline: avg('baseline'),
    avgLow: avg('low'),
    avgDrop: avg('baseline') - avg('low'),
    lowestEver: Math.min(...stats.map((x) => x.low)),
  };
}

// Deterministic carb suggestion for exercise. Never suggests changing insulin - that's for the care team.
function suggestWorkoutCarbs(history, currentGlucose) {
  const reasons = [];
  let carbs = 0;
  if (history && (history.lowestEver < 70 || history.avgLow < 80)) {
    carbs = 30;
    reasons.push(`glucose has dropped as low as ${history.lowestEver} mg/dL after this workout`);
  } else if (history && history.avgDrop > 50) {
    carbs = 15;
    reasons.push(`glucose drops about ${history.avgDrop} mg/dL on average after this workout`);
  }
  if (currentGlucose != null && currentGlucose < 100) {
    carbs = Math.max(carbs, 15);
    reasons.push(`your current glucose is ${currentGlucose} mg/dL`);
  }
  return { carbs, reasons };
}

function normalizeSettings(src = {}) {
  return {
    ratioUnits: Number(src.ratioUnits) || 1,
    ratioCarbs: Number(src.ratioCarbs) || 8,
    correctionStepAmount: Number(src.correctionStepAmount) || 50,
    correctionStepUnits: Number(src.correctionStepUnits) || 1,
    target: Number(src.target) || 120,
  };
}

const guessMealType = (hour) => (hour >= 4 && hour < 11 ? 'breakfast' : hour < 16 && hour >= 11 ? 'lunch' : hour >= 16 && hour < 21 ? 'dinner' : 'snack');

// POST /chat { userId, message, currentGlucose, ratioUnits?, ratioCarbs?, correctionStepAmount?, correctionStepUnits?, target? }
app.post('/chat', async (req, res) => {
  const { userId, message, currentGlucose } = req.body;
  if (!userId || !message) return res.status(400).json({ error: 'userId and message required' });

  let settings = normalizeSettings(req.body); // replaced by the meal slot's settings once we know the slot

  const meals = db.get('meals').filter({ userId }).value();
  const workouts = db.get('workouts').filter({ userId }).value();

  try {
    // Step 1: Gemini turns free text into structured data + matches a saved meal
    const parsed = JSON.parse(
      await callGemini(
        `You help a person with diabetes log meals. From their message, estimate total carbohydrates in grams and ` +
          `check whether it matches one of their saved meals.\n` +
          `Saved meals: ${JSON.stringify(meals.map((m) => ({ id: m.id, name: m.name, usualCarbs: m.usualCarbs })))}\n` +
          `Saved workouts: ${JSON.stringify(workouts.map((w) => ({ id: w.id, name: w.name })))}\n` +
          `Message: "${String(message).replace(/"/g, "'")}"\n` +
          `Reply ONLY with JSON: {"kind": "meal"|"workout"|"other", "foods": string, "carbs": number, "matchedMealId": string|null, ` +
          `"workoutName": string, "matchedWorkoutId": string|null, "durationMinutes": number|null, "mealType": "breakfast"|"lunch"|"dinner"|"snack"|null}. ` +
          `kind is "meal" if they are about to eat, "workout" if they are about to exercise, otherwise "other". ` +
          `If the message states a carb amount, use it. Matched ids must come from the saved lists or be null. mealType is the meal slot if stated or implied, else null.`,
        { json: true }
      )
    );

    if (parsed.kind === 'workout') {
      const workout = workouts.find((w) => w.id === parsed.matchedWorkoutId) || null;
      if (workout) await ensureWorkoutWindowsCached(workout.id, userId);
      const history = workout ? summarizeWorkoutHistory(workout.id, userId) : null;
      const glucoseNow = currentGlucose != null && currentGlucose !== '' ? Number(currentGlucose) : null;
      const sug = suggestWorkoutCarbs(history, glucoseNow);

      let reply;
      try {
        reply = await callGemini(
          `You are a friendly diabetes companion in a school hackathon app. Write a short (3-5 sentences) reply.\n` +
            `Facts (do not change any numbers):\n` +
            `- Planned workout: ${parsed.workoutName || 'exercise'}${parsed.durationMinutes ? `, about ${parsed.durationMinutes} min` : ''}\n` +
            (glucoseNow != null ? `- Current glucose: ${glucoseNow} mg/dL\n` : '') +
            (history
              ? `- The user has done the saved workout "${workout.name}" ${history.count} times. Glucose averaged ${history.avgBaseline} before and ${history.avgLow} at its lowest afterward (a drop of ${history.avgDrop}).\n`
              : `- No past history for this workout.\n`) +
            (sug.carbs
              ? `- Suggestion: have about ${sug.carbs}g of carbs before starting because ${sug.reasons.join(' and ')}.\n`
              : `- No extra carbs suggested.\n`) +
            `Do NOT suggest any insulin dose change; say adjustments to insulin are a question for their care team. ` +
            `Remind them to check glucose during and after exercise. Do not invent other numbers.`
        );
      } catch (e) {
        reply =
          (sug.carbs ? `Consider about ${sug.carbs}g of carbs before this workout (${sug.reasons.join(', ')}). ` : 'No extra carbs suggested. ') +
          'Check your glucose during and after, and ask your care team about insulin adjustments.';
      }

      return res.json({
        reply,
        kind: 'workout',
        matchedWorkout: workout ? { id: workout.id, name: workout.name } : null,
        history,
        carbSuggestion: sug.carbs ? { carbs: sug.carbs, reasons: sug.reasons } : null,
      });
    }

    if (parsed.kind !== 'meal' || !(parsed.carbs >= 0)) {
      const reply = await callGemini(
        `You are a friendly diabetes companion in a school hackathon app. Reply briefly. Tell the user to describe what they plan to eat so you can estimate carbs and insulin. Never give medical advice beyond the app's calculator. User said: "${message}"`
      );
      return res.json({ reply });
    }

    const validTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    const mealType = validTypes.includes(parsed.mealType)
      ? parsed.mealType
      : validTypes.includes(req.body.mealType)
      ? req.body.mealType
      : guessMealType(Number.isFinite(Number(req.body.localHour)) ? Number(req.body.localHour) : new Date().getHours());
    settings = normalizeSettings((req.body.settingsByType && req.body.settingsByType[mealType]) || req.body);

    const meal = meals.find((m) => m.id === parsed.matchedMealId) || null;
    const glucose = currentGlucose != null && currentGlucose !== '' ? Number(currentGlucose) : settings.target;
    const dose = computeDose({ carbs: parsed.carbs, currentGlucose: glucose, ...settings });

    if (meal) await ensureMealWindowsCached(meal.id, userId);
    const history = meal ? summarizeMealHistory(meal.id, userId) : null;
    const adj = suggestAdjustment(history);
    const adjustedDose = Math.round(dose.totalDose * (1 + adj.percent / 100) * 2) / 2; // nearest 0.5 unit

    // Step 2: Gemini explains the numbers we computed. It is not allowed to change them.
    let reply;
    try {
      reply = await callGemini(
        `You are a friendly diabetes companion in a school hackathon app. Write a short (3-5 sentences) reply.\n` +
          `Facts (do not change any numbers):\n` +
          `- Meal: ${parsed.foods}, about ${parsed.carbs}g carbs\n` +
          `- Meal slot: ${mealType} (dose uses that slot's saved ratio)\n` + `- Current glucose used: ${glucose} mg/dL\n` +
          `- Calculated dose: ${dose.totalDose} units (${dose.carbDose} for carbs + ${dose.correctionDose} correction)\n` +
          (history
            ? `- The user has eaten the saved meal "${meal.name}" ${history.count} times. ${adj.reason}. ` +
              (adj.percent !== 0
                ? `Suggested adjusted dose: ${adjustedDose} units (${adj.percent > 0 ? '+' : ''}${adj.percent}%).\n`
                : `No dose change suggested.\n`)
            : `- No past history for this meal, so no adjustment.\n`) +
          `End by reminding them to confirm with their doctor or care team. Do not invent other numbers.`
      );
    } catch (e) {
      reply =
        `${parsed.foods} (~${parsed.carbs}g carbs): calculated dose is ${dose.totalDose} units.` +
        (adj.percent !== 0 ? ` Based on ${history.count} past times, consider ${adjustedDose} units (${adj.reason}).` : '') +
        ' Please confirm with your doctor or care team.';
    }

    res.json({
      reply,
      foods: parsed.foods,
      carbs: parsed.carbs,
      matchedMeal: meal ? { id: meal.id, name: meal.name } : null,
      mealType,
      settingsUsed: settings,
      dose,
      history,
      adjustment: adj.percent !== 0 ? { percent: adj.percent, reason: adj.reason, adjustedDose } : null,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: err.message.includes('GEMINI_API_KEY') ? err.message : 'Chat failed' });
  }
});

// =====================================================================
// A1C ESTIMATE - from average glucose over a period (standard eAG formula)
// =====================================================================

// GET /a1c?userId=&days=90
app.get('/a1c', async (req, res) => {
  const { userId, days } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const windowDays = Number(days) || 90;
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);

  try {
    // Dexcom caps how far back a single query can go, so for long windows we
    // rely on whatever's already cached locally plus a fresh pull of the last 24h.
    await fetchAndCacheGlucose(
      userId,
      new Date(end.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      end.toISOString()
    ).catch(() => {});

    const readings = db
      .get('glucoseHistory')
      .filter((r) => r.userId === userId && new Date(r.systemTime) >= start)
      .value();

    if (!readings.length) {
      return res.json({ a1c: null, avgGlucose: null, readingCount: 0, note: 'Not enough cached data yet - the more you use the app, the more accurate this gets.' });
    }

    const avgGlucose = readings.reduce((sum, r) => sum + r.value, 0) / readings.length;
    // ADA-standard eAG-to-A1C formula
    const a1c = (avgGlucose + 46.7) / 28.7;

    res.json({
      a1c: Math.round(a1c * 10) / 10,
      avgGlucose: Math.round(avgGlucose),
      readingCount: readings.length,
      windowDays,
      note: 'Estimated from cached readings, not a lab test. Talk to your doctor for an actual A1C.',
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Failed to calculate A1C estimate' });
  }
});

// =====================================================================
// DAWN PHENOMENON - early-morning glucose rise pattern
// =====================================================================

// GET /dawn-phenomenon?userId=&days=14
// Looks at readings between 3am-8am (server local time) each day and reports
// how much glucose tends to rise across that window.
app.get('/dawn-phenomenon', (req, res) => {
  const { userId, days } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const windowDays = Number(days) || 14;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const readings = db
    .get('glucoseHistory')
    .filter((r) => r.userId === userId && new Date(r.systemTime) >= cutoff)
    .value();

  const byDay = {};
  readings.forEach((r) => {
    const t = new Date(r.systemTime);
    const hour = t.getHours();
    if (hour >= 3 && hour < 8) {
      const dayKey = t.toISOString().slice(0, 10);
      if (!byDay[dayKey]) byDay[dayKey] = [];
      byDay[dayKey].push({ hour, value: r.value });
    }
  });

  const dailyRises = Object.entries(byDay)
    .map(([day, points]) => {
      if (points.length < 2) return null;
      points.sort((a, b) => a.hour - b.hour);
      const rise = points[points.length - 1].value - points[0].value;
      return { day, rise, startValue: points[0].value, endValue: points[points.length - 1].value };
    })
    .filter(Boolean);

  const avgRise = dailyRises.length
    ? dailyRises.reduce((sum, d) => sum + d.rise, 0) / dailyRises.length
    : null;

  res.json({
    avgRise: avgRise != null ? Math.round(avgRise) : null,
    daysAnalyzed: dailyRises.length,
    dailyRises,
    note:
      avgRise == null
        ? 'Not enough overnight/early-morning readings cached yet.'
        : avgRise > 15
        ? "There's a noticeable rise in this window most days - could be worth mentioning to your doctor."
        : 'No strong early-morning rise pattern in the cached data right now.',
  });
});

app.listen(PORT || 4000, () => {
  console.log(`Backend running on http://localhost:${PORT || 4000}`);
});
