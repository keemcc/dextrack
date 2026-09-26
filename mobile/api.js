// Backend URL comes from mobile/.env.local (see .env.example). Must match the host in
// the backend's DEXCOM_REDIRECT_URI for OAuth to work on the phone.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // --- glucose ---
  getGlucose: (userId, startDate, endDate) =>
    request(`/glucose?userId=${userId}&startDate=${startDate}&endDate=${endDate}`),
  getGlucoseHistory: (userId, hours = 24) =>
    request(`/glucose/history?userId=${userId}&hours=${hours}`),

  // --- food lookup ---
  searchFood: (query) => request(`/food/search?query=${encodeURIComponent(query)}`),

  // --- meals (templates + logged instances) ---
  getMeals: (userId) => request(`/meals?userId=${userId}`),
  addMeal: (userId, name, usualCarbs, foods) =>
    request('/meals', { method: 'POST', body: JSON.stringify({ userId, name, usualCarbs, foods }) }),
  updateMeal: (id, updates) => request(`/meals/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteMeal: (id) => request(`/meals/${id}`, { method: 'DELETE' }),
  logMeal: (mealId, userId, carbs) =>
    request(`/meals/${mealId}/log`, { method: 'POST', body: JSON.stringify({ userId, carbs }) }),
  getMealLogs: (mealId, userId) => request(`/meals/${mealId}/logs?userId=${userId}`),
  getPredictedCurve: (mealId, userId) => request(`/meals/${mealId}/predicted-curve?userId=${userId}`),
  getPredictability: (mealId, userId) => request(`/meals/${mealId}/predictability?userId=${userId}`),

  // --- workouts (templates + logged instances) ---
  getWorkouts: (userId) => request(`/workouts?userId=${userId}`),
  addWorkout: (userId, name) =>
    request('/workouts', { method: 'POST', body: JSON.stringify({ userId, name }) }),
  deleteWorkout: (id) => request(`/workouts/${id}`, { method: 'DELETE' }),
  logWorkout: (workoutId, userId, durationMinutes, notes) =>
    request(`/workouts/${workoutId}/log`, {
      method: 'POST',
      body: JSON.stringify({ userId, durationMinutes, notes }),
    }),
  getWorkoutLogs: (workoutId, userId) => request(`/workouts/${workoutId}/logs?userId=${userId}`),
  getWorkoutPredictedCurve: (workoutId, userId) => request(`/workouts/${workoutId}/predicted-curve?userId=${userId}`),
  getWorkoutPredictability: (workoutId, userId) => request(`/workouts/${workoutId}/predictability?userId=${userId}`),

  // --- chatbot ---
  chat: (payload) => request('/chat', { method: 'POST', body: JSON.stringify(payload) }),

  // --- insulin calc ---
  calculateDose: (payload) =>
    request('/calculate-dose', { method: 'POST', body: JSON.stringify(payload) }),

  // --- A1C + dawn phenomenon ---
  getA1C: (userId, days = 90) => request(`/a1c?userId=${userId}&days=${days}`),
  getDawnPhenomenon: (userId, days = 14) =>
    request(`/dawn-phenomenon?userId=${userId}&days=${days}`),
};
