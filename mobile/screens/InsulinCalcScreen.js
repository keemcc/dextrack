import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { api } from '../api';

export default function InsulinCalcScreen() {
  const [carbs, setCarbs] = useState('');
  const [currentGlucose, setCurrentGlucose] = useState('');
  // ratio entered like "1:8" -> 1 unit per 8g carbs
  const [ratioUnits, setRatioUnits] = useState('1');
  const [ratioCarbs, setRatioCarbs] = useState('8');
  // step correction: "every 50 over 120 = +1 unit"
  const [correctionStepAmount, setCorrectionStepAmount] = useState('50');
  const [correctionStepUnits, setCorrectionStepUnits] = useState('1');
  const [target, setTarget] = useState('120');

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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.title}>Insulin Dose Calculator</Text>
      <Text style={styles.warning}>
        For learning purposes only. Not medical advice - always confirm doses with a doctor or
        diabetes care team.
      </Text>

      <Text style={styles.section}>This meal</Text>
      <Field label="Carbs in this meal (g)" value={carbs} onChangeText={setCarbs} />
      <Field label="Current blood glucose (mg/dL)" value={currentGlucose} onChangeText={setCurrentGlucose} />

      <Text style={styles.section}>Your insulin ratio</Text>
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
    </ScrollView>
  );
}

function Field({ label, value, onChangeText }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={value}
        onChangeText={onChangeText}
        placeholder="0"
        placeholderTextColor="#64748b"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  title: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  warning: { color: '#fbbf24', fontSize: 12, marginBottom: 16, lineHeight: 18 },
  section: { color: '#22c55e', fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 8, textTransform: 'uppercase' },
  helper: { color: '#64748b', fontSize: 12, marginBottom: 10 },
  ratioRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  colon: { color: 'white', fontSize: 20, fontWeight: '700', marginBottom: 26, paddingHorizontal: 4 },
  label: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#1e293b', color: 'white', borderRadius: 10, padding: 12 },
  button: { backgroundColor: '#22c55e', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontWeight: '700' },
  error: { color: '#f87171', marginTop: 12 },
  resultBox: { backgroundColor: '#1e293b', borderRadius: 12, padding: 18, marginTop: 20 },
  resultTotal: { color: '#22c55e', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  resultLine: { color: '#cbd5e1', fontSize: 14, marginBottom: 4 },
  disclaimer: { color: '#64748b', fontSize: 11, marginTop: 10, lineHeight: 16 },
});
