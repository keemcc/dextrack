import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../theme';

const screenWidth = Dimensions.get('window').width;

// Shows a small glucose curve for one logged meal/workout instance,
// with a marker line where the meal/workout happened.
export default function MiniGlucoseChart({ glucose, loggedAt, width, color = '34, 197, 94' }) {
  const { colors } = useTheme();
  if (!glucose || glucose.length < 2) {
    return <Text style={[styles.empty, { color: colors.faint }]}>Not enough glucose data yet for this window.</Text>;
  }

  const values = glucose.map((g) => g.value);
  const low = Math.min(...values);
  const high = Math.max(...values);

  return (
    <View>
      <LineChart
        data={{ labels: [], datasets: [{ data: values }] }}
        width={width || screenWidth - 60}
        height={140}
        withDots={false}
        withInnerLines={false}
        withVerticalLabels={false}
        chartConfig={{
          backgroundGradientFrom: colors.card,
          backgroundGradientTo: colors.card,
          color: (opacity = 1) => `rgba(${color}, ${opacity})`,
          labelColor: () => colors.faint,
          strokeWidth: 2,
        }}
        bezier
        style={{ borderRadius: 10 }}
      />
      <View style={styles.rangeRow}>
        <Text style={[styles.rangeText, { color: colors.textMuted }]}>Low: {low} mg/dL</Text>
        <Text style={[styles.rangeText, { color: colors.textMuted }]}>High: {high} mg/dL</Text>
        <Text style={[styles.rangeText, { color: colors.textMuted }]}>Swing: {high - low} mg/dL</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: '#64748b', fontSize: 12, fontStyle: 'italic', paddingVertical: 10 },
  rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  rangeText: { color: '#94a3b8', fontSize: 11 },
});
