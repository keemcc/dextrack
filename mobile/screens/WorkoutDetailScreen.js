import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import MiniGlucoseChart from '../components/MiniGlucoseChart';

export default function WorkoutDetailScreen({ route, userId }) {
  const { workout } = route.params;
  const [logs, setLogs] = useState([]);
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [logging, setLogging] = useState(false);

  const load = useCallback(async () => {
    const data = await api.getWorkoutLogs(workout.id, userId);
    setLogs(data);
  }, [workout.id, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const logNow = async () => {
    setLogging(true);
    try {
      await api.logWorkout(workout.id, userId, Number(duration) || null, notes.trim());
      setNotes('');
      await load();
    } finally {
      setLogging(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{workout.name}</Text>

      <View style={styles.logBox}>
        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={duration}
          onChangeText={setDuration}
        />
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="how it felt, intensity, etc."
          placeholderTextColor="#64748b"
          value={notes}
          onChangeText={setNotes}
        />
        <TouchableOpacity style={styles.logButton} onPress={logNow} disabled={logging}>
          <Text style={styles.buttonText}>{logging ? 'Logging...' : "I just did this"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Past sessions</Text>
      <Text style={styles.hint}>
        Blood sugar from 30 min before to 4 hours after - workouts can drop it for a while.
      </Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.logDate}>{new Date(item.loggedAt).toLocaleString()}</Text>
              {item.durationMinutes ? (
                <Text style={styles.logDuration}>{item.durationMinutes} min</Text>
              ) : null}
            </View>
            {!!item.notes && <Text style={styles.logNotes}>{item.notes}</Text>}
            <MiniGlucoseChart glucose={item.glucose} loggedAt={item.loggedAt} />
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.note}>No sessions logged yet - tap "I just did this" above.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  title: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  logBox: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 24 },
  label: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#0f172a', color: 'white', borderRadius: 10, padding: 12, marginBottom: 12 },
  logButton: { backgroundColor: '#22c55e', padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700' },
  sectionTitle: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  hint: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  logCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logDate: { color: '#cbd5e1', fontSize: 13 },
  logDuration: { color: '#22c55e', fontSize: 13, fontWeight: '600' },
  logNotes: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  note: { color: '#64748b', textAlign: 'center', marginTop: 20 },
});
