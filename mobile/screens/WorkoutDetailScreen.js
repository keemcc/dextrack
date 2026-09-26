import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useTheme } from '../theme';
import MiniGlucoseChart from '../components/MiniGlucoseChart';
import PredictabilityBadge from '../components/PredictabilityBadge';

export default function WorkoutDetailScreen({ route, userId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { workout } = route.params;
  const [logs, setLogs] = useState([]);
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');
  const [logging, setLogging] = useState(false);
  const [predicted, setPredicted] = useState(null);
  const [predictability, setPredictability] = useState(null);

  const load = useCallback(async () => {
    const data = await api.getWorkoutLogs(workout.id, userId);
    setLogs(data);
    try {
      setPredicted(await api.getWorkoutPredictedCurve(workout.id, userId));
      setPredictability(await api.getWorkoutPredictability(workout.id, userId));
    } catch (e) {}
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
      <PredictabilityBadge data={predictability} />

      {predicted && predicted.curve ? (
        <View style={styles.predictBox}>
          <Text style={styles.predictLabel}>Predicted based on past {predicted.count} times</Text>
          <MiniGlucoseChart glucose={predicted.curve} color="148, 163, 184" />
        </View>
      ) : null}

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
          placeholderTextColor={colors.faint}
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

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, padding: 20 },
  title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  predictBox: { backgroundColor: c.card, borderRadius: 12, padding: 14, marginTop: 12, marginBottom: 12 },
  predictLabel: { color: c.textMuted, fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  logBox: { backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 24 },
  label: { color: c.textSoft, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: c.bg, color: c.text, borderRadius: 10, padding: 12, marginBottom: 12 },
  logButton: { backgroundColor: c.accent, padding: 14, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: c.onAccent, fontWeight: '700' },
  sectionTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  hint: { color: c.faint, fontSize: 12, marginBottom: 12 },
  logCard: { backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logDate: { color: c.textSoft, fontSize: 13 },
  logDuration: { color: c.accentText, fontSize: 13, fontWeight: '600' },
  logNotes: { color: c.textMuted, fontSize: 12, marginBottom: 8 },
  note: { color: c.faint, textAlign: 'center', marginTop: 20 },
});
