import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

// Dexcom trend names -> arrow + plain words
const TRENDS = {
  doubleUp: { arrow: '⇈', text: 'Rising quickly' },
  singleUp: { arrow: '↑', text: 'Rising' },
  fortyFiveUp: { arrow: '↗', text: 'Rising slowly' },
  flat: { arrow: '→', text: 'Steady' },
  fortyFiveDown: { arrow: '↘', text: 'Falling slowly' },
  singleDown: { arrow: '↓', text: 'Falling' },
  doubleDown: { arrow: '⇊', text: 'Falling quickly' },
};

// Used when Dexcom doesn't give a usable trend: guess from the change over ~15 min
function trendFromDelta(delta) {
  if (delta == null) return null;
  if (delta > 45) return TRENDS.doubleUp;
  if (delta > 20) return TRENDS.singleUp;
  if (delta > 8) return TRENDS.fortyFiveUp;
  if (delta < -45) return TRENDS.doubleDown;
  if (delta < -20) return TRENDS.singleDown;
  if (delta < -8) return TRENDS.fortyFiveDown;
  return TRENDS.flat;
}

function timeAgo(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
}

// Big current reading with range color, trend arrow, and recent change.
// readings: ascending by time [{ systemTime, value, trend }]
export default function CurrentGlucose({ readings }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!readings || readings.length === 0) return null;
  const latest = readings[readings.length - 1];
  const latestTime = new Date(latest.systemTime).getTime();

  // change vs the reading closest to 15 minutes earlier (within 8-25 min)
  let prev = null;
  readings.forEach((r) => {
    const gap = (latestTime - new Date(r.systemTime).getTime()) / 60000;
    if (gap >= 8 && gap <= 25 && (!prev || Math.abs(gap - 15) < Math.abs(prev.gap - 15))) prev = { r, gap };
  });
  const delta = prev ? latest.value - prev.r.value : null;
  const deltaPer15 = prev ? (delta / prev.gap) * 15 : null;

  const trend = TRENDS[latest.trend] || trendFromDelta(deltaPer15);

  const v = latest.value;
  let range;
  if (v < 55) range = { label: 'Urgent low', color: colors.danger };
  else if (v < 70) range = { label: 'Low', color: colors.danger };
  else if (v <= 180) range = { label: 'In range', color: colors.accentText };
  else if (v <= 250) range = { label: 'High', color: colors.warn };
  else range = { label: 'Very high', color: colors.warn };

  const ageMin = (Date.now() - latestTime) / 60000;
  const old = ageMin > 30;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.circle, { borderColor: range.color }]}>
          <Text style={styles.value}>{v}</Text>
          <Text style={styles.unit}>mg/dL</Text>
        </View>

        <View style={styles.info}>
          <Text style={[styles.rangeLabel, { color: range.color }]}>{range.label}</Text>
          {trend ? (
            <Text style={styles.trend}>
              <Text style={styles.arrow}>{trend.arrow} </Text>
              {trend.text}
            </Text>
          ) : null}
          {delta != null ? (
            <Text style={styles.delta}>
              {delta > 0 ? '+' : ''}
              {delta} mg/dL in {Math.round(prev.gap)} min
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={[styles.updated, old && { color: colors.warn }]}>
        Updated {timeAgo(latest.systemTime)}
        {old ? ' - not a live reading' : ''}
      </Text>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: 16, padding: 18, marginBottom: 20 },
    row: { flexDirection: 'row', alignItems: 'center' },
    circle: { width: 118, height: 118, borderRadius: 59, borderWidth: 7, alignItems: 'center', justifyContent: 'center' },
    value: { color: c.text, fontSize: 38, fontWeight: '800' },
    unit: { color: c.textMuted, fontSize: 12, marginTop: -2 },
    info: { flex: 1, marginLeft: 18 },
    rangeLabel: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
    trend: { color: c.text, fontSize: 16, fontWeight: '600' },
    arrow: { fontSize: 22, fontWeight: '800' },
    delta: { color: c.textMuted, fontSize: 13, marginTop: 4 },
    updated: { color: c.faint, fontSize: 12, marginTop: 14 },
  });
