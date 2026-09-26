// Seeds demo meals, logged instances, and synthetic glucose curves into
// db.json for a user who's already connected via sandbox OAuth, so a fresh
// account has history to show in a live demo.
//
//   node seed-demo.js [userId]
//
// With no userId, uses the most recently logged-in user. Stop the backend
// first - it keeps db.json in memory and would overwrite the seeded data on
// its next write. Safe to re-run: previous demo data for the user is
// replaced, real data is left alone.
const { v4: uuidv4 } = require('uuid');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const db = low(new FileSync('db.json'));
db.defaults({
  tokens: {},
  meals: [],
  mealLogs: [],
  workouts: [],
  workoutLogs: [],
  glucoseHistory: [],
}).write();

// Each meal gets a rise (mg/dL above baseline at peak) and peak time drawn
// from these ranges per instance. Pizza is deliberately all over the place
// so the predictability score has something to contrast against.
const DEMO_MEALS = [
  {
    name: 'Oatmeal with berries',
    usualCarbs: 45,
    hour: 7.5,
    days: [1, 4, 6, 9, 12],
    rise: [55, 65],
    peakMinutes: [45, 50],
  },
  {
    name: 'Chicken burrito bowl',
    usualCarbs: 75,
    hour: 12.5,
    days: [2, 5, 8, 11],
    rise: [80, 95],
    peakMinutes: [50, 60],
  },
  {
    name: 'Pepperoni pizza (3 slices)',
    usualCarbs: 90,
    hour: 19,
    days: [3, 7, 10, 13],
    rise: [45, 130],
    peakMinutes: [50, 75],
  },
];

const between = (min, max) => min + Math.random() * (max - min);

// Rise-and-fall shape: 0 at mealtime, 1 at the peak, ~15% left at 3x the
// peak time (back near baseline by 2-3hr for a 45-60min peak).
function mealResponse(minutes, peakMinutes) {
  if (minutes <= 0) return 0;
  const x = minutes / peakMinutes;
  return x * x * Math.exp(2 * (1 - x));
}

function trendFor(ratePerMinute) {
  const size = Math.abs(ratePerMinute);
  if (size < 1) return 'flat';
  const dir = ratePerMinute > 0 ? 'Up' : 'Down';
  if (size < 2) return `fortyFive${dir}`;
  if (size < 3) return `single${dir}`;
  return `double${dir}`;
}

// EGV-shaped readings every 5 minutes covering the -30min..+3hr window
// the app shows, with sensor noise and a small drift in baseline.
function syntheticCurve(userId, loggedAt, meal) {
  const baseline = between(95, 125);
  const drift = between(-10, 10);
  const rise = between(...meal.rise);
  const peakMinutes = between(...meal.peakMinutes);
  // Real sensor readings don't line up with the moment you log a meal
  const phase = Math.floor(Math.random() * 5);

  const points = [];
  for (let minutes = -35 + phase; minutes <= 185; minutes += 5) {
    const value =
      baseline +
      drift * (minutes / 180) +
      rise * mealResponse(minutes, peakMinutes) +
      between(-3, 3);
    points.push({ minutes, value: Math.round(value) });
  }

  return points.map((p, i) => {
    const prev = points[Math.max(i - 1, 0)];
    return {
      userId,
      systemTime: new Date(loggedAt.getTime() + p.minutes * 60 * 1000).toISOString(),
      value: p.value,
      trend: trendFor((p.value - prev.value) / 5),
      demo: true,
    };
  });
}

function pickUserId() {
  const tokens = db.get('tokens').value();
  const requested = process.argv[2];
  if (requested) {
    if (!tokens[requested]) {
      console.error(`No connected user ${requested} in db.json - log in via /auth/login first.`);
      process.exit(1);
    }
    return requested;
  }
  const ids = Object.keys(tokens);
  if (ids.length === 0) {
    console.error('No connected users in db.json - log in via /auth/login first.');
    process.exit(1);
  }
  const latest = ids.sort((a, b) => tokens[b].expires_at - tokens[a].expires_at)[0];
  if (ids.length > 1) {
    console.log(`${ids.length} users connected, using the most recent login (pass a userId to pick one).`);
  }
  return latest;
}

const userId = pickUserId();

// Clear out a previous seed for this user so re-running doesn't pile up
const oldMealIds = db.get('meals').filter({ userId, demo: true }).map('id').value();
db.get('mealLogs').remove((l) => oldMealIds.includes(l.mealId)).write();
db.get('meals').remove({ userId, demo: true }).write();
db.get('glucoseHistory').remove({ userId, demo: true }).write();

const now = new Date();
DEMO_MEALS.forEach((demoMeal) => {
  const meal = {
    id: uuidv4(),
    userId,
    name: demoMeal.name,
    usualCarbs: demoMeal.usualCarbs,
    createdAt: now.getTime() - 14 * 24 * 60 * 60 * 1000,
    demo: true,
  };
  db.get('meals').push(meal).write();

  demoMeal.days.forEach((daysAgo) => {
    const loggedAt = new Date(now);
    loggedAt.setDate(loggedAt.getDate() - daysAgo);
    loggedAt.setHours(0, Math.round(demoMeal.hour * 60 + between(-20, 20)), 0, 0);

    db.get('mealLogs')
      .push({
        id: uuidv4(),
        mealId: meal.id,
        userId,
        carbs: demoMeal.usualCarbs + Math.round(between(-5, 5)),
        loggedAt: loggedAt.toISOString(),
      })
      .write();

    // Skip any reading already cached from Dexcom at the same instant
    const readings = syntheticCurve(userId, loggedAt, demoMeal).filter(
      (r) => !db.get('glucoseHistory').find({ userId, systemTime: r.systemTime }).value()
    );
    db.get('glucoseHistory').push(...readings).write();
  });

  console.log(`  ${demoMeal.name}: ${demoMeal.days.length} logged instances`);
});

console.log(`Seeded demo data for ${userId}. Start the backend (npm run dev) to see it.`);
