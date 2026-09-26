import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { api } from '../api';

export default function AddMealScreen({ userId, navigation }) {
  const [name, setName] = useState('');
  const [usualCarbs, setUsualCarbs] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const { results } = await api.searchFood(query.trim());
      setResults(results);
    } catch (e) {
      setError('Food lookup failed - you can still enter carbs manually below.');
    } finally {
      setSearching(false);
    }
  };

  const pickFood = (food) => {
    setName((prev) => prev || food.description);
    if (food.carbsPer100g != null) {
      setUsualCarbs(String(Math.round(food.carbsPer100g)));
    }
    setResults([]);
    setQuery('');
  };

  const save = async () => {
    if (!name.trim() || !usualCarbs) return;
    await api.addMeal(userId, name.trim(), Number(usualCarbs));
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Meal</Text>

      <Text style={styles.label}>Look up carbs (USDA food database)</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="e.g. banana, grilled chicken breast"
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
        />
        <TouchableOpacity style={styles.searchButton} onPress={search}>
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>
      </View>
      {searching && <ActivityIndicator color="#22c55e" style={{ marginVertical: 10 }} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {results.length > 0 && (
        <FlatList
          style={styles.resultsList}
          data={results}
          keyExtractor={(item) => String(item.fdcId)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultRow} onPress={() => pickFood(item)}>
              <Text style={styles.resultName} numberOfLines={1}>
                {item.description}
              </Text>
              <Text style={styles.resultCarbs}>
                {item.carbsPer100g != null ? `${Math.round(item.carbsPer100g)}g / 100g` : 'no carb data'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={styles.divider} />

      <Text style={styles.label}>Meal name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Chicken Alfredo"
        placeholderTextColor="#64748b"
        value={name}
        onChangeText={setName}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>Usual carbs (g)</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor="#64748b"
        keyboardType="numeric"
        value={usualCarbs}
        onChangeText={setUsualCarbs}
      />
      <Text style={styles.helper}>
        USDA carb values are per 100g - adjust this number for your actual portion size.
      </Text>

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.buttonText}>Save Meal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  title: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#1e293b', color: 'white', borderRadius: 10, padding: 12 },
  searchButton: { backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '700' },
  error: { color: '#fbbf24', fontSize: 12, marginTop: 6 },
  resultsList: { maxHeight: 220, marginTop: 10 },
  resultRow: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: { color: 'white', flex: 1, marginRight: 10 },
  resultCarbs: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#1e293b', marginVertical: 20 },
  helper: { color: '#64748b', fontSize: 11, marginTop: 6 },
  saveButton: { backgroundColor: '#22c55e', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 24 },
});
