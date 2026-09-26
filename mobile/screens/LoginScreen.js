import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api';

export default function LoginScreen({ onLoggedIn }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [userId, setUserId] = useState('');

  const openDexcomLogin = () => {
    Linking.openURL(`${API_BASE_URL}/auth/login`);
  };

  const saveUserId = async () => {
    if (!userId.trim()) return;
    await AsyncStorage.setItem('userId', userId.trim());
    onLoggedIn(userId.trim());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect your Dexcom</Text>
      <Text style={styles.body}>
        1. Tap the button below - it opens Dexcom's login in your browser.{'\n'}
        2. Log in with your Dexcom (or sandbox test) account and approve access.{'\n'}
        3. Copy the userId shown on the confirmation page and paste it below.
      </Text>

      <TouchableOpacity style={styles.button} onPress={openDexcomLogin}>
        <Text style={styles.buttonText}>Connect Dexcom Account</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="Paste your userId here"
        placeholderTextColor={colors.textMuted}
        value={userId}
        onChangeText={setUserId}
        autoCapitalize="none"
      />

      <TouchableOpacity style={[styles.button, styles.secondary]} onPress={saveUserId}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        Note: this paste-the-userId step is just for early dev/testing. Swap it for a proper
        deep link (Dexcom redirects straight back into the app) once the basics work.
      </Text>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, padding: 24, justifyContent: 'center' },
  title: { color: c.text, fontSize: 24, fontWeight: '700', marginBottom: 12 },
  body: { color: c.textSoft, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  button: {
    backgroundColor: c.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondary: { backgroundColor: '#3b82f6' },
  buttonText: { color: c.onAccent, fontWeight: '700', fontSize: 15 },
  input: {
    backgroundColor: c.card,
    color: c.text,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  note: { color: c.faint, fontSize: 12, marginTop: 8 },
});
