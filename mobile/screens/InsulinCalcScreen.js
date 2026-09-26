import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { api } from '../api';
import { useTheme } from '../theme';
import { KeyboardAvoid } from '../components/KeyboardAvoid';
import InsulinReminders from '../components/InsulinReminders';

import { loadAllSettings, saveAllSettings, DEFAULT_SETTINGS, MEAL_TYPES, MEAL_TYPE_LABELS, guessMealType } from '../settings';

export default function InsulinCalcScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [carbs, setCarbs] = useState('');
  const [currentGlucose, setCurrentGlucose] = useState('');
  // ratio entered like "1:8" -> 1 unit per 8g carbs
  // one saved set of ratios per meal slot (breakfast/lunch/dinner/snack)
  const [mealType, setMealType] = useState(guessMealType());
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS });
  const [saved, setSaved] = useState(false);
  const allRef = useRef(null);

  useEffect(() => {
    loadAllSettings().then(({ all }) => {
      allRef.current = all;
      setForm(all[mealType]);
    });
  }, []);

  const pickMealType = (t) => {
    setMealType(t);
    if (allRef.current) setForm(allRef.current[t]);
  };

  // every edit is saved straight away for the selected meal slot
  const update = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (allRef.current) {
        allRef.current = { ...allRef.current, [mealType]: next };
        saveAllSettings(allRef.current);
        setSaved(true);
      }
      return next;
    });
  };

  const copyToAll = () => {
    if (!allRef.current) return;
    const all = {};
    MEAL_TYPES.forEach((t) => (all[t] = { ...form }));
    allRef.current = all;
    saveAllSettings(all);
    setSaved(true);
  };

  const { ratioUnits, ratioCarbs, target, correctionStepAmount, correctionStepUnits } = form;
  const setRatioUnits = (v) => update('ratioUnits', v);
  const setRatioCarbs = (v) => update('ratioCarbs', v);
  const setTarget = (v) => update('target', v);
  const setCorrectionStepAmount = (v) => update('correctionStepAmount', v);
  const setCorrectionStepUnits = (v) => update('correctionStepUnits', v);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const calculate = async () => {
    setError(null);
    setResult(null);
    try {
      const data = await api.calculateDose({
        carbs: Number(carbs),
        currentGlucose: Number(currentGlucose),
        ratioUnits: Number(ratioUnits),
        ratioCarbs: Number(ratioCarbs),
        correctionStepAmount: Number(correctionStepAmount),
        correctionStepUnits: Number(correctionStepUnits),
        target: Number(target),
      });
      setResult(data);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <KeyboardAvoid>
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={styles.title}>Insulin Dose Calculator</Text>
      <Text style={styles.warning}>
        For learning purposes only. Not medical advice - always confirm doses with a doctor or
        diabetes care team.
      </Text>

      <View style={styles.chipRow}>
        {MEAL_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, mealType === t && styles.chipActive]}
            onPress={() => pickMealType(t)}
          >
            <Text style={[styles.chipText, mealType === t && styles.chipTextActive]}>{MEAL_TYPE_LABELS[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.section}>This meal</Text>
      <Field label="Carbs in this meal (g)" value={carbs} onChangeText={setCarbs} />
      <Field label="Current blood glucose (mg/dL)" value={currentGlucose} onChangeText={setCurrentGlucose} />

      <Text style={styles.section}>Your {MEAL_TYPE_LABELS[mealType].toLowerCase()} ratio</Text>
      <Text style={styles.helper}>
        {saved
          ? 'Saved on this phone for each meal - the Assistant tab uses the matching one.'
          : 'Enter your numbers once - they are saved and the Assistant tab uses them too.'}
      </Text>
      <View style={styles.ratioRow}>
        <View style={{ flex: 1 }}>
          <Field label="Units" value={ratioUnits} onChangeText={setRatioUnits} />
        </View>
        <Text style={styles.colon}>:</Text>
        <View style={{ flex: 1 }}>
          <Field label="grams of carbs" value={ratioCarbs} onChangeText={setRatioCarbs} />
        </View>
      </View>
      <Text style={styles.helper}>
        e.g. 1 : 8 means 1 unit covers every 8g of carbs
      </Text>

      <Text style={styles.section}>Your correction rule</Text>
      <Text style={styles.helper}>
        e.g. "every 50 over target, add 1 unit"
      </Text>
      <View style={styles.ratioRow}>
        <View style={{ flex: 1 }}>
          <Field label="Target BG" value={target} onChangeText={setTarget} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Every X over" value={correctionStepAmount} onChangeText={setCorrectionStepAmount} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="+ units" value={correctionStepUnits} onChangeText={setCorrectionStepUnits} />
        </View>
      </View>

      <TouchableOpacity onPress={copyToAll}>
        <Text style={styles.copyLink}>Use these numbers for every meal</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={calculate}>
        <Text style={styles.buttonText}>Calculate</Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      {result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultTotal}>{result.totalDose} units</Text>
          <Text style={styles.resultLine}>Carb dose: {result.carbDose} units</Text>
          <Text style={styles.resultLine}>Correction dose: {result.correctionDose} units</Text>
          <Text style={styles.disclaimer}>{result.disclaimer}</Text>
        </View>
      )}

      <InsulinReminders />
    </ScrollView>
    </KeyboardAvoid>
  );
}

function Field({ label, value, onChangeText }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={value}
        onChangeText={onChangeText}
        placeholder="0"
        placeholderTextColor={colors.faint}
      />
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: c.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  chipActive: { backgroundColor: c.accent },
  chipText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: c.onAccent },
  copyLink: { color: c.accentText, fontSize: 12, fontWeight: '600', marginTop: 4, marginBottom: 4 },
  title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  warning: { color: c.warn, fontSize: 12, marginBottom: 16, lineHeight: 18 },
  section: { color: c.accentText, fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 8, textTransform: 'uppercase' },
  helper: { color: c.faint, fontSize: 12, marginBottom: 10 },
  ratioRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  colon: { color: c.text, fontSize: 20, fontWeight: '700', marginBottom: 26, paddingHorizontal: 4 },
  label: { color: c.textSoft, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: c.card, color: c.text, borderRadius: 10, padding: 12 },
  button: { backgroundColor: c.accent, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: c.onAccent, fontWeight: '700' },
  error: { color: c.danger, marginTop: 12 },
  resultBox: { backgroundColor: c.card, borderRadius: 12, padding: 18, marginTop: 20 },
  resultTotal: { color: c.accentText, fontSize: 32, fontWeight: '800', marginBottom: 8 },
  resultLine: { color: c.textSoft, fontSize: 14, marginBottom: 4 },
  disclaimer: { color: c.faint, fontSize: 11, marginTop: 10, lineHeight: 16 },
});
