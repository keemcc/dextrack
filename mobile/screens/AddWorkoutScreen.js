import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../api';
import { useTheme } from '../theme';

export default function AddWorkoutScreen({ userId, navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState('');

  const save = async () => {
    if (!name.trim()) return;
    await api.addWorkout(userId, name.trim());
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Workout</Text>

      <Text style={styles.label}>Workout name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Leg day, 5k run, basketball"
        placeholderTextColor={colors.faint}
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.buttonText}>Save Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, padding: 20 },
  title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { color: c.textSoft, fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: c.card, color: c.text, borderRadius: 10, padding: 12 },
  buttonText: { color: c.onAccent, fontWeight: '700' },
  saveButton: { backgroundColor: c.accent, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 24 },
});
