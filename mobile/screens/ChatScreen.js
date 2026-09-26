import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { api } from '../api';
import { useTheme } from '../theme';
import { KeyboardAvoid } from '../components/KeyboardAvoid';
import { loadAllSettings, MEAL_TYPE_LABELS } from '../settings';

// Uses the ratio/correction settings the user saved on the Insulin Calc tab (defaults 1:8, 50/1, target 120).
export default function ChatScreen({ userId }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [messages, setMessages] = useState([
    { id: 'hi', from: 'bot', text: 'Hi! Tell me what you\'re about to eat or do (I'll use your live glucose reading, or you can type one above), e.g. "chicken alfredo".' },
  ]);
  const [input, setInput] = useState('');
  const [glucose, setGlucose] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setMessages((m) => [...m, { id: String(Date.now()), from: 'user', text }]);
    setBusy(true);
    try {
      // read the latest saved settings on every send so edits on the Insulin Calc tab apply immediately
      const { all, isCustom } = await loadAllSettings();
      const data = await api.chat({
        userId,
        message: text,
        currentGlucose: glucose ? Number(glucose) : undefined,
        settingsByType: all,
        localHour: new Date().getHours(),
      });
      data.usingDefaults = !isCustom;
      setMessages((m) => [...m, { id: String(Date.now() + 1), from: 'bot', text: data.reply, data }]);
    } catch (e) {
      setMessages((m) => [...m, { id: String(Date.now() + 1), from: 'bot', text: 'Sorry, something went wrong: ' + e.message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoid style={styles.container}>
      <Text style={styles.title}>Meal Assistant</Text>
      <View style={styles.glucoseRow}>
        <Text style={styles.glucoseLabel}>Glucose override (blank = live reading)</Text>
        <TextInput
          style={styles.glucoseInput}
          keyboardType="numeric"
          value={glucose}
          onChangeText={setGlucose}
          placeholder="live"
          placeholderTextColor={colors.faintest}
        />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ paddingVertical: 10 }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.from === 'user' ? styles.userBubble : styles.botBubble]}>
            <Text style={[styles.bubbleText, item.from === 'user' && { color: colors.onAccent }]}>{item.text}</Text>
            {item.data && item.data.kind === 'workout' && item.data.carbSuggestion ? (
              <View style={styles.doseCard}>
                <Text style={styles.doseMain}>~{item.data.carbSuggestion.carbs}g carbs</Text>
                <Text style={styles.doseSub}>suggested before starting</Text>
              </View>
            ) : null}
            {item.data && item.data.dose ? (
              <View style={styles.doseCard}>
                <Text style={styles.doseMain}>{item.data.dose.totalDose} units</Text>
                <Text style={styles.doseSub}>
                  {item.data.carbs}g carbs: {item.data.dose.carbDose}u + correction {item.data.dose.correctionDose}u
                </Text>
                <Text style={styles.doseSub}>
                  {MEAL_TYPE_LABELS[item.data.mealType]}: 1u:{item.data.settingsUsed.ratioCarbs}g, +{item.data.settingsUsed.correctionStepUnits}u per {item.data.settingsUsed.correctionStepAmount} over {item.data.settingsUsed.target}
                </Text>
                {item.data.glucose ? (
                  <Text style={styles.doseSub}>
                    {item.data.glucose.value != null
                      ? `Glucose used: ${item.data.glucose.value} mg/dL (${item.data.glucose.source === 'live' ? 'live reading' : 'entered'})`
                      : 'No current glucose - no correction added'}
                  </Text>
                ) : null}
                {item.data.usingDefaults ? (
                  <Text style={styles.adjust}>
                    Using default settings - set your own ratio on the Insulin Calc tab for accurate doses.
                  </Text>
                ) : null}
                {item.data.adjustment ? (
                  <Text style={styles.adjust}>
                    Based on {item.data.history.count} past times: suggest {item.data.adjustment.adjustedDose} units (
                    {item.data.adjustment.percent > 0 ? '+' : ''}
                    {item.data.adjustment.percent}%)
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      />

      {busy ? <ActivityIndicator color="#22c55e" style={{ marginBottom: 6 }} /> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="What are you eating?"
          placeholderTextColor={colors.faintest}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.sendButton} onPress={send} disabled={busy}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>School project, not medical advice. Confirm doses with your care team.</Text>
    </KeyboardAvoid>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, padding: 20, paddingTop: 50 },
  title: { color: c.text, fontSize: 22, fontWeight: '700', marginBottom: 10 },
  glucoseRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  glucoseLabel: { color: c.textMuted, fontSize: 13, flex: 1 },
  glucoseInput: { backgroundColor: c.card, color: c.text, borderRadius: 8, padding: 8, width: 80, textAlign: 'center' },
  bubble: { padding: 12, borderRadius: 14, marginBottom: 8, maxWidth: '88%' },
  userBubble: { backgroundColor: c.accent, alignSelf: 'flex-end' },
  botBubble: { backgroundColor: c.card, alignSelf: 'flex-start' },
  bubbleText: { color: c.text, fontSize: 14, lineHeight: 20 },
  doseCard: { backgroundColor: c.bg, borderRadius: 10, padding: 10, marginTop: 8 },
  doseMain: { color: c.accentText, fontSize: 20, fontWeight: '800' },
  doseSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  adjust: { color: c.warn, fontSize: 12, fontWeight: '600', marginTop: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: c.card, color: c.text, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendButton: { backgroundColor: c.accent, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 8 },
  sendText: { color: c.onAccent, fontWeight: '700' },
  disclaimer: { color: c.faintest, fontSize: 10, textAlign: 'center', marginTop: 8 },
});
