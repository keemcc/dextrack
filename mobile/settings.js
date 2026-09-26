import AsyncStorage from '@react-native-async-storage/async-storage';

// Insulin settings, kept separately for each meal slot since ratios often differ
// (breakfast vs dinner). Shared by the Insulin Calc tab and the chatbot.
// Values are strings so they can go straight into text inputs.
const KEY = 'insulinSettingsByType';
const OLD_KEY = 'insulinSettings'; // single set of settings from an earlier version

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const MEAL_TYPE_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

export const DEFAULT_SETTINGS = {
  ratioUnits: '1',
  ratioCarbs: '8',
  target: '120',
  correctionStepAmount: '50',
  correctionStepUnits: '1',
};

// Best guess at the current meal slot from the time of day
export function guessMealType(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 21) return 'dinner';
  return 'snack';
}

const fill = (base) => {
  const out = {};
  MEAL_TYPES.forEach((t) => (out[t] = { ...DEFAULT_SETTINGS, ...(base && base[t]) }));
  return out;
};

// Returns { all: {breakfast, lunch, dinner, snack}, isCustom }
export async function loadAllSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { all: fill(JSON.parse(raw)), isCustom: true };

    // migrate: apply the old single set to every meal slot
    const old = await AsyncStorage.getItem(OLD_KEY);
    if (old) {
      const one = JSON.parse(old);
      return { all: fill({ breakfast: one, lunch: one, dinner: one, snack: one }), isCustom: true };
    }
  } catch (e) {}
  return { all: fill(null), isCustom: false };
}

export async function saveAllSettings(all) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch (e) {}
}
