import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { api } from '../api';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen({ userId, onLogOut }) {
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
      <Text style={styles.title}>Glucose Trend</Text>

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
            backgroundGradientFrom: '#0f172a',
            backgroundGradientTo: '#0f172a',
            color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`,
            labelColor: () => '#94a3b8',
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  title: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  latestBox: { marginBottom: 20 },
  latestValue: { color: '#22c55e', fontSize: 40, fontWeight: '800' },
  latestTrend: { color: '#94a3b8', fontSize: 14 },
  error: { color: '#f87171', marginBottom: 12 },
  note: { color: '#64748b' },
  cardsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  card: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 14 },
  cardLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  cardValue: { color: '#22c55e', fontSize: 22, fontWeight: '800' },
  cardSub: { color: '#64748b', fontSize: 11, marginTop: 4 },
  hint: { color: '#475569', fontSize: 12, marginTop: 24, lineHeight: 17 },
  logOutButton: {
    marginTop: 24,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  logOutText: { color: '#94a3b8', fontWeight: '600' },
});
