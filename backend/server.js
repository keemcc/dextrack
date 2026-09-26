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

  try {
    const records = await fetchAndCacheGlucose(userId, start.toISOString(), end.toISOString());
    return records;
  } catch (err) {
    // fall back to whatever's cached locally for that window
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
app.post('/meals', (req, res) => {
  const { userId, name, usualCarbs } = req.body;
  if (!userId || !name || usualCarbs == null) {
    return res.status(400).json({ error: 'userId, name, and usualCarbs are required' });
  }
  const meal = { id: uuidv4(), userId, name, usualCarbs, createdAt: Date.now() };
  db.get('meals').push(meal).write();
  res.status(201).json(meal);
});

app.get('/meals', (req, res) => {
  const { userId } = req.query;
  res.json(db.get('meals').filter({ userId }).value());
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

  // carb dose scales normally (60g at a 1:8 ratio = 7.5 units)
  const carbDose = (carbs / ratioCarbs) * ratioUnits;

  // correction dose is a STEP function, not continuous: only whole steps over target count.
  // e.g. 220 current, target 120, step of 50/1unit -> (220-120)/50 = 2 steps -> +2 units
  const over = Math.max(0, currentGlucose - target);
  const steps = Math.floor(over / correctionStepAmount);
  const correctionDose = steps * correctionStepUnits;

  const totalDose = Math.round((carbDose + correctionDose) * 10) / 10;

  res.json({
    carbDose: Math.round(carbDose * 10) / 10,
    correctionDose,
    totalDose,
    disclaimer:
      'This is a school-project calculation, not medical advice. Always confirm doses with a doctor or diabetes care team.',
  });
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
