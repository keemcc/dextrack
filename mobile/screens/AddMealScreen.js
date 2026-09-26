import React, { useState, useMemo } from 'react';
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
import { useTheme } from '../theme';
import FoodListEditor, { sumCarbs, newFoodId } from '../components/FoodListEditor';

export default function AddMealScreen({ userId, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [foods, setFoods] = useState([]);
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
    setFoods((prev) => [
      ...prev,
      { id: newFoodId(), name: food.description, carbs: food.carbsPer100g != null ? Math.round(food.carbsPer100g) : 0 },
    ]);
    setResults([]);
    setQuery('');
  };

  const save = async () => {
    if (!name.trim() || foods.length === 0) return;
    await api.addMeal(userId, name.trim(), sumCarbs(foods), foods);
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
          placeholderTextColor={colors.faint}
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
        placeholderTextColor={colors.faint}
        value={name}
        onChangeText={setName}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>Foods in this meal</Text>
      <FoodListEditor foods={foods} onChange={setFoods} />
      <Text style={styles.helper}>
        Search above to add a food, or type one in. USDA carb values are per 100g - adjust each item's grams of carbs for your actual portion.
      </Text>

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.buttonText}>Save Meal</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, padding: 20 },
  title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { color: c.textSoft, fontSize: 13, marginBottom: 6 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: c.card, color: c.text, borderRadius: 10, padding: 12 },
  searchButton: { backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  buttonText: { color: c.onAccent, fontWeight: '700' },
  error: { color: c.warn, fontSize: 12, marginTop: 6 },
  resultsList: { maxHeight: 220, marginTop: 10 },
  resultRow: {
    backgroundColor: c.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: { color: c.text, flex: 1, marginRight: 10 },
  resultCarbs: { color: c.accentText, fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: c.card, marginVertical: 20 },
  helper: { color: c.faint, fontSize: 11, marginTop: 6 },
  saveButton: { backgroundColor: c.accent, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 24 },
});
