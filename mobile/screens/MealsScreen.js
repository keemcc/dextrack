import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';

export default function MealsScreen({ userId, navigation }) {
  const [meals, setMeals] = useState([]);

  const load = useCallback(async () => {
    const data = await api.getMeals(userId);
    setMeals(data);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
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
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.mealName}>{item.name}</Text>
              <Text style={styles.mealCarbs}>~{item.usualCarbs}g carbs usually</Text>
            </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },
  addButton: { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addButtonText: { color: 'white', fontWeight: '700' },
  mealRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  mealName: { color: 'white', fontSize: 16, fontWeight: '600' },
  mealCarbs: { color: '#94a3b8', fontSize: 13 },
  chevron: { color: '#64748b', fontSize: 22 },
  note: { color: '#64748b', textAlign: 'center', marginTop: 20 },
});
