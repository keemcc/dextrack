import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useTheme } from '../theme';
import PredictabilityBadge from '../components/PredictabilityBadge';

export default function WorkoutsScreen({ userId, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [workouts, setWorkouts] = useState([]);
  const [predict, setPredict] = useState({});

  const load = useCallback(async () => {
    const data = await api.getWorkouts(userId);
    setWorkouts(data);
    const scores = {};
    await Promise.all(
      data.map(async (w) => {
        try { scores[w.id] = await api.getWorkoutPredictability(w.id, userId); } catch (e) {}
      })
    );
    setPredict(scores);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddWorkout')}>
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('WorkoutDetail', { workout: item })}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <PredictabilityBadge data={predict[item.id]} />
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.note}>No workouts saved yet. Tap "+ New" to add one.</Text>
        }
      />
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: c.text, fontSize: 22, fontWeight: '700' },
  addButton: { backgroundColor: c.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addButtonText: { color: c.onAccent, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    backgroundColor: c.card,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { color: c.text, fontSize: 16, fontWeight: '600' },
  chevron: { color: c.faint, fontSize: 22 },
  note: { color: c.faint, textAlign: 'center', marginTop: 20 },
});
