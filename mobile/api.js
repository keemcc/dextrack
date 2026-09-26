// Point this at your backend. If testing on a physical phone with Expo Go,
// "localhost" won't reach your computer - use your computer's LAN IP instead,
// e.g. "http://192.168.1.42:4000" (find it with `ipconfig`/`ifconfig`).
export const API_BASE_URL = 'http://192.168.56.1:4000';

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
  addMeal: (userId, name, usualCarbs) =>
    request('/meals', { method: 'POST', body: JSON.stringify({ userId, name, usualCarbs }) }),
  deleteMeal: (id) => request(`/meals/${id}`, { method: 'DELETE' }),
  logMeal: (mealId, userId, carbs) =>
    request(`/meals/${mealId}/log`, { method: 'POST', body: JSON.stringify({ userId, carbs }) }),
  getMealLogs: (mealId, userId) => request(`/meals/${mealId}/logs?userId=${userId}`),

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

  // --- insulin calc ---
  calculateDose: (payload) =>
    request('/calculate-dose', { method: 'POST', body: JSON.stringify(payload) }),

  // --- A1C + dawn phenomenon ---
  getA1C: (userId, days = 90) => request(`/a1c?userId=${userId}&days=${days}`),
  getDawnPhenomenon: (userId, days = 14) =>
    request(`/dawn-phenomenon?userId=${userId}&days=${days}`),
};
