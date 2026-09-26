import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../api';

export default function AddWorkoutScreen({ userId, navigation }) {
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
        placeholderTextColor="#64748b"
        value={name}
        onChangeText={setName}
      />

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.buttonText}>Save Workout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  title: { color: 'white', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  label: { color: '#cbd5e1', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#1e293b', color: 'white', borderRadius: 10, padding: 12 },
  buttonText: { color: 'white', fontWeight: '700' },
  saveButton: { backgroundColor: '#22c55e', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 24 },
});
