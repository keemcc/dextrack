import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { api } from '../api';
import { useTheme } from '../theme';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen({ userId, onLogOut }) {
  const { colors, preference, cyclePreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [readings, setReadings] = useState([]);
  const [a1c, setA1c] = useState(null);
  const [dawn, setDawn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [historyRes, a1cRes, dawnRes] = await Promise.all([
        api.getGlucoseHistory(userId, 6),
        api.getA1C(userId, 90),
        api.getDawnPhenomenon(userId, 14),
      ]);
      setReadings(historyRes.records || []);
      setA1c(a1cRes);
      setDawn(dawnRes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const values = readings.map((r) => r.value);
  const latest = readings[readings.length - 1];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.titleRow}>
        <Text style={styles.title}>Glucose Trend</Text>
        <TouchableOpacity style={styles.themeButton} onPress={cyclePreference}>
          <Text style={styles.themeButtonText}>
            {preference === 'system' ? 'Auto' : preference === 'light' ? 'Light' : 'Dark'}
          </Text>
        </TouchableOpacity>
      </View>

      {latest && (
        <View style={styles.latestBox}>
          <Text style={styles.latestValue}>{latest.value} mg/dL</Text>
          <Text style={styles.latestTrend}>{latest.trend || ''}</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {values.length > 1 ? (
        <LineChart
          data={{ labels: [], datasets: [{ data: values }] }}
          width={screenWidth - 40}
          height={220}
          withDots={false}
          withInnerLines={false}
          chartConfig={{
            backgroundGradientFrom: colors.bg,
            backgroundGradientTo: colors.bg,
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
            labelColor: () => colors.textMuted,
            strokeWidth: 2,
          }}
          bezier
          style={{ borderRadius: 12 }}
        />
      ) : (
        !error && <Text style={styles.note}>Not enough readings yet to draw a trend.</Text>
      )}

      <View style={styles.cardsRow}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Estimated A1C</Text>
          {a1c?.a1c != null ? (
            <>
              <Text style={styles.cardValue}>{a1c.a1c}%</Text>
              <Text style={styles.cardSub}>avg {a1c.avgGlucose} mg/dL · {a1c.readingCount} readings</Text>
            </>
          ) : (
            <Text style={styles.cardSub}>{a1c?.note || 'Not enough data yet'}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Dawn Phenomenon</Text>
          {dawn?.avgRise != null ? (
            <>
              <Text style={styles.cardValue}>+{dawn.avgRise} mg/dL</Text>
              <Text style={styles.cardSub}>avg 3-8am rise · {dawn.daysAnalyzed} days</Text>
            </>
          ) : (
            <Text style={styles.cardSub}>{dawn?.note || 'Not enough data yet'}</Text>
          )}
        </View>
      </View>

      <Text style={styles.hint}>
        Pull down to refresh. Using Dexcom sandbox data unless you've been approved for
        production access. A1C and dawn phenomenon get more accurate the more the app is used,
        since they're built from your cached readings over time.
      </Text>

      <TouchableOpacity style={styles.logOutButton} onPress={onLogOut}>
        <Text style={styles.logOutText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: c.text, fontSize: 22, fontWeight: '700' },
  themeButton: { backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  themeButtonText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  latestBox: { marginBottom: 20 },
  latestValue: { color: c.accentText, fontSize: 40, fontWeight: '800' },
  latestTrend: { color: c.textMuted, fontSize: 14 },
  error: { color: c.danger, marginBottom: 12 },
  note: { color: c.faint },
  cardsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  card: { flex: 1, backgroundColor: c.card, borderRadius: 12, padding: 14 },
  cardLabel: { color: c.textMuted, fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  cardValue: { color: c.accentText, fontSize: 22, fontWeight: '800' },
  cardSub: { color: c.faint, fontSize: 11, marginTop: 4 },
  hint: { color: c.faintest, fontSize: 12, marginTop: 24, lineHeight: 17 },
  logOutButton: {
    marginTop: 24,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.faintest,
    alignItems: 'center',
  },
  logOutText: { color: c.textMuted, fontWeight: '600' },
});
