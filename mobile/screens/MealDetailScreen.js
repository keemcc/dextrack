import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useTheme } from '../theme';
import { confirmAction } from '../components/confirm';
import KeyboardScrollScreen, { KeyboardAvoid } from '../components/KeyboardAvoid';

import MiniGlucoseChart from '../components/MiniGlucoseChart';
import PredictabilityBadge from '../components/PredictabilityBadge';
import FoodListEditor, { sumCarbs } from '../components/FoodListEditor';

export default function MealDetailScreen({ route, userId, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [meal, setMeal] = useState(route.params.meal);
  const [logs, setLogs] = useState([]);
  const [carbsOverride, setCarbsOverride] = useState(String(meal.usualCarbs));
  const [logging, setLogging] = useState(false);
  const [predicted, setPredicted] = useState(null);
  const [predictability, setPredictability] = useState(null);

  const load = useCallback(async () => {
    const data = await api.getMealLogs(meal.id, userId);
    setLogs(data);
    try {
      setPredicted(await api.getPredictedCurve(meal.id, userId));
      setPredictability(await api.getPredictability(meal.id, userId));
    } catch (e) {}
  }, [meal.id, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Meals saved before food lists existed have no `foods` - start them with one item
  // holding the old carb total, so adding a food adds to it instead of replacing it
  const foodsForEditor =
    meal.foods || (meal.usualCarbs ? [{ id: 'original', name: meal.name, carbs: meal.usualCarbs }] : []);

  // add / remove / edit food items - saved to the backend, carbs follow the total
  const saveFoods = async (foods) => {
    const total = foods.length ? sumCarbs(foods) : meal.usualCarbs;
    setMeal({ ...meal, foods, usualCarbs: total });
    setCarbsOverride(String(total));
    try {
      const updated = await api.updateMeal(meal.id, { foods });
      setMeal(updated);
    } catch (e) {}
  };

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

  const removeMeal = () =>
    confirmAction(
      'Delete this meal?',
      `"${meal.name}" and all of its logged history will be deleted.`,
      'Delete',
      async () => {
        await api.deleteMeal(meal.id);
        navigation.goBack();
      }
    );

  return (
    <KeyboardAvoid style={styles.container}>
      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View>
          <Text style={styles.title}>{meal.name}</Text>
          <Text style={styles.subtitle}>Usually ~{meal.usualCarbs}g carbs</Text>
          <PredictabilityBadge data={predictability} />

          {predicted && predicted.curve ? (
            <View style={styles.predictBox}>
              <Text style={styles.predictLabel}>
                Predicted based on past {predicted.count} times
              </Text>
              <MiniGlucoseChart
                glucose={predicted.curve}
                color="148, 163, 184"
              />
            </View>
          ) : null}

          <View style={styles.foodsBox}>
            <Text style={styles.sectionTitle}>What's in it</Text>
            <FoodListEditor foods={foodsForEditor} onChange={saveFoods} />
          </View>

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

          </View>
        }
        ListFooterComponent={
          <TouchableOpacity style={styles.deleteButton} onPress={removeMeal}>
            <Text style={styles.deleteText}>Delete this meal</Text>
          </TouchableOpacity>
        }
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
    </KeyboardAvoid>
  );
}

const makeStyles = (c) => StyleSheet.create({
  deleteButton: { marginTop: 24, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: c.danger, alignItems: 'center' },
  deleteText: { color: c.danger, fontWeight: '700' },
  container: { flex: 1, padding: 20 },
  title: { color: c.text, fontSize: 22, fontWeight: '700' },
  subtitle: { color: c.textMuted, fontSize: 13, marginBottom: 16 },
  foodsBox: { backgroundColor: c.card, borderRadius: 12, padding: 14, marginBottom: 12 },
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
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  logDate: { color: c.textSoft, fontSize: 13 },
  logCarbs: { color: c.accentText, fontSize: 13, fontWeight: '600' },
  note: { color: c.faint, textAlign: 'center', marginTop: 20 },
});
