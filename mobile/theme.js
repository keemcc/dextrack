import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dark = the original app palette. Light = soft gray page with white cards (like the Dexcom app).
export const palettes = {
  dark: {
    mode: 'dark',
    bg: '#0f172a',
    card: '#1e293b',
    accent: '#22c55e', // buttons, fills
    accentText: '#22c55e', // green text/numbers
    onAccent: 'white', // text on green buttons
    text: 'white',
    textSoft: '#cbd5e1',
    textMuted: '#94a3b8',
    faint: '#64748b',
    faintest: '#475569',
    warn: '#fbbf24',
    danger: '#f87171',
    okBg: '#14532d',
    warnBg: '#78350f',
    border: '#1e293b',
  },
  light: {
    mode: 'light',
    bg: '#eeeeee',
    card: '#ffffff',
    accent: '#22c55e',
    accentText: '#15803d',
    onAccent: 'white',
    text: '#111827',
    textSoft: '#374151',
    textMuted: '#6b7280',
    faint: '#6b7280',
    faintest: '#9ca3af',
    warn: '#b45309',
    danger: '#dc2626',
    okBg: '#dcfce7',
    warnBg: '#fef3c7',
    border: '#e5e7eb',
  },
};

const KEY = 'themePreference'; // 'system' | 'light' | 'dark'
const ThemeContext = createContext({ colors: palettes.dark, preference: 'system', cyclePreference: () => {} });

export function ThemeProvider({ children }) {
  const system = useColorScheme(); // follows the phone's setting
  const [preference, setPreference] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setPreference(v))
      .catch(() => {});
  }, []);

  const cyclePreference = () => {
    const next = preference === 'system' ? 'light' : preference === 'light' ? 'dark' : 'system';
    setPreference(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };

  const mode = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const value = useMemo(() => ({ colors: palettes[mode], preference, cyclePreference }), [mode, preference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
