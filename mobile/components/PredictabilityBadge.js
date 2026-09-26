import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

// Small pill: green "Consistent", amber "Unpredictable", nothing if not enough data.
export default function PredictabilityBadge({ data }) {
  const { colors } = useTheme();
  if (!data || !data.label) return null;
  const ok = data.label === 'Consistent';
  return (
    <View style={[styles.badge, { backgroundColor: ok ? colors.okBg : colors.warnBg }]}>
      <Text style={[styles.text, { color: ok ? colors.accentText : colors.warn }]}>
        {data.label} (±{data.stdev})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  text: { fontSize: 11, fontWeight: '700' },
});
