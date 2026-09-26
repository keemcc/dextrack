import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import MiniGlucoseChart from '../components/MiniGlucoseChart';

export default function MealDetailScreen({ route, userId }) {
  const { meal } = route.params;
  const [logs, setLogs] = useState([]);
  const [carbsOverride, setCarbsOverride] = useState(String(meal.usualCarbs));
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    const data = await api.getMealLogs(meal.id, userId);
    setLogs(data);
  }, [meal.id, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const logNow = async () => {
    setLogging(true);
    try {
      await api.logMeal(meal.id, userId, Number(carbsOverride) || meal.usualCarbs);
      // The 3-hour "after" window won't have data yet since it just happened -
      // refresh the list so it shows up, then remind the user to check back later.
      await load();
    } finally {
      setLogging(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{meal.name}</Text>
      <Text style={styles.subtitle}>Usually ~{meal.usualCarbs}g carbs</Text>

      <View style={styles.logBox}>
        <Text style={styles.label}>Carbs this time (g)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={carbsOverride}
          onChangeText={setCarbsOverride}
        />
        <TouchableOpacity style={styles.logButton} onPress={logNow} disabled={logging}>
          <Text style={styles.buttonText}>{logging ? 'Logging...' : "I'm eating this now"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Past times you've eaten this</Text>
      <Text style={styles.hint}>
        Each curve is your blood sugar from 30 min before eating to 3 hours after.
      </Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.logDate}>{new Date(item.loggedAt).toLocaleString()}</Text>
              <Text style={styles.logCarbs}>{item.carbs}g carbs</Text>
            </View>
            <MiniGlucoseChart glucose={item.glucose} loggedAt={item.loggedAt} />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.note}>
            No logged instances yet - tap "I'm eating this now" above to start tracking.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginBottom: 16 },
  logBox: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 24 },
  label: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#0f172a', color: 'white', borderRadius: 10, padding: 12, marginBottom: 12 },
  logButton: { backgroundColor: '#22c55e', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700' },
  sectionTitle: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  hint: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  logCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  logDate: { color: '#cbd5e1', fontSize: 13 },
  logCarbs: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  note: { color: '#64748b', textAlign: 'center', marginTop: 20 },
});
