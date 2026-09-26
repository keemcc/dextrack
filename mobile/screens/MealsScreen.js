import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useTheme } from '../theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { confirmAction } from '../components/confirm';

import PredictabilityBadge from '../components/PredictabilityBadge';

export default function MealsScreen({ userId, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [meals, setMeals] = useState([]);
  const [predict, setPredict] = useState({});

  const load = useCallback(async () => {
    const data = await api.getMeals(userId);
    setMeals(data);
    const scores = {};
    await Promise.all(
      data.map(async (m) => {
        try { scores[m.id] = await api.getPredictability(m.id, userId); } catch (e) {}
      })
    );
    setPredict(scores);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const askDelete = (meal) =>
    confirmAction(
      'Delete this meal?',
      `"${meal.name}" and all of its logged history will be deleted.`,
      'Delete',
      async () => {
        await api.deleteMeal(meal.id);
        load();
      }
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved Meals</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddMeal')}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={meals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.mealRow}
            onPress={() => navigation.navigate('MealDetail', { meal: item })}
            onLongPress={() => askDelete(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.mealName}>{item.name}</Text>
              <Text style={styles.mealCarbs}>~{item.usualCarbs}g carbs usually</Text>
              <PredictabilityBadge data={predict[item.id]} />
            </View>
            <TouchableOpacity onPress={() => askDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={20} color={colors.faint} style={{ marginRight: 14 }} />
            </TouchableOpacity>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.note}>No meals saved yet. Tap "+ New" to add one.</Text>
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
  mealRow: {
    flexDirection: 'row',
    backgroundColor: c.card,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  mealName: { color: c.text, fontSize: 16, fontWeight: '600' },
  mealCarbs: { color: c.textMuted, fontSize: 13 },
  chevron: { color: c.faint, fontSize: 22 },
  note: { color: c.faint, textAlign: 'center', marginTop: 20 },
});
