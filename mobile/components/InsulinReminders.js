import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';
import { loadReminders, addReminder, removeReminder, formatTime, remindersAvailable } from '../reminders';

// Card on the Insulin tab: set daily reminders for long-acting insulin.
export default function InsulinReminders() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [reminders, setReminders] = useState([]);
  const [label, setLabel] = useState('Long-acting insulin');
  const [hour, setHour] = useState('9');
  const [minute, setMinute] = useState('00');
  const [pm, setPm] = useState(true);
  const [units, setUnits] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadReminders().then(setReminders);
  }, []);

  const add = async () => {
    setError(null);
    const h = Number(hour);
    const m = Number(minute);
    if (!(h >= 1 && h <= 12) || !(m >= 0 && m <= 59)) {
      setError('Enter an hour from 1-12 and minutes from 0-59.');
      return;
    }
    const hour24 = (h % 12) + (pm ? 12 : 0);
    try {
      setReminders(await addReminder({ hour: hour24, minute: m, label, units: units.trim() }));
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => setReminders(await removeReminder(id));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Long-acting insulin reminders</Text>
      <Text style={styles.helper}>
        Get a notification every day at the time you take your long-acting insulin. It only
        reminds you - the app never decides your dose.
      </Text>

      {!remindersAvailable() ? (
        <Text style={styles.warn}>
          Reminders need the notifications package. Run "npx expo install expo-notifications" in the
          mobile folder, restart, and open the app on a phone.
        </Text>
      ) : null}

      {reminders.map((r) => (
        <View key={r.id} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTime}>{formatTime(r.hour, r.minute)} daily</Text>
            <Text style={styles.itemLabel}>
              {r.label}
              {r.units ? ` · ${r.units} units` : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => remove(r.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Lantus, Basaglar, Tresiba"
        placeholderTextColor={colors.faint}
      />

      <Text style={styles.label}>Time</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={[styles.input, styles.timeInput]}
          keyboardType="numeric"
          value={hour}
          onChangeText={setHour}
          maxLength={2}
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          style={[styles.input, styles.timeInput]}
          keyboardType="numeric"
          value={minute}
          onChangeText={setMinute}
          maxLength={2}
        />
        <TouchableOpacity style={[styles.chip, !pm && styles.chipActive]} onPress={() => setPm(false)}>
          <Text style={[styles.chipText, !pm && styles.chipTextActive]}>AM</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, pm && styles.chipActive]} onPress={() => setPm(true)}>
          <Text style={[styles.chipText, pm && styles.chipTextActive]}>PM</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Units (optional, shown in the reminder)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={units}
        onChangeText={setUnits}
        placeholder="e.g. 20"
        placeholderTextColor={colors.faint}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.addButton} onPress={add}>
        <Text style={styles.addText}>Add reminder</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    card: { backgroundColor: c.card, borderRadius: 12, padding: 16, marginTop: 24 },
    title: { color: c.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
    helper: { color: c.faint, fontSize: 12, lineHeight: 17, marginBottom: 12 },
    warn: { color: c.warn, fontSize: 12, lineHeight: 17, marginBottom: 12 },
    item: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, borderRadius: 10, padding: 12, marginBottom: 8 },
    itemTime: { color: c.accentText, fontSize: 16, fontWeight: '700' },
    itemLabel: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    remove: { color: c.danger, fontSize: 16, fontWeight: '700', paddingHorizontal: 6 },
    label: { color: c.textSoft, fontSize: 13, marginTop: 10, marginBottom: 6 },
    input: { backgroundColor: c.bg, color: c.text, borderRadius: 10, padding: 12 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    timeInput: { width: 60, textAlign: 'center' },
    colon: { color: c.text, fontSize: 20, fontWeight: '700' },
    chip: { backgroundColor: c.bg, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10 },
    chipActive: { backgroundColor: c.accent },
    chipText: { color: c.textMuted, fontWeight: '700' },
    chipTextActive: { color: c.onAccent },
    error: { color: c.danger, fontSize: 12, marginTop: 10 },
    addButton: { backgroundColor: c.accent, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 14 },
    addText: { color: c.onAccent, fontWeight: '700' },
  });
