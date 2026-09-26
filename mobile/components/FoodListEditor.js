import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

// A meal's food items: edit carbs, remove an item, or add another one.
// foods = [{ id, name, carbs }]; onChange(newFoods) is called after each change.
export const sumCarbs = (foods) => Math.round(foods.reduce((a, f) => a + (Number(f.carbs) || 0), 0));
export const newFoodId = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

function FoodRow({ food, onCarbsCommit, onRemove, styles, colors }) {
  const [carbsText, setCarbsText] = useState(String(food.carbs));
  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={2}>{food.name}</Text>
      <TextInput
        style={styles.carbsInput}
        keyboardType="numeric"
        value={carbsText}
        onChangeText={setCarbsText}
        onEndEditing={() => onCarbsCommit(Number(carbsText) || 0)}
        placeholderTextColor={colors.faint}
      />
      <Text style={styles.unit}>g</Text>
      <TouchableOpacity onPress={onRemove} style={styles.remove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.removeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function FoodListEditor({ foods, onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState('');
  const [carbs, setCarbs] = useState('');

  const add = () => {
    if (!name.trim()) return;
    onChange([...foods, { id: newFoodId(), name: name.trim(), carbs: Number(carbs) || 0 }]);
    setName('');
    setCarbs('');
  };

  return (
    <View>
      {foods.length === 0 ? <Text style={styles.empty}>No items yet - add the foods in this meal.</Text> : null}
      {foods.map((f) => (
        <FoodRow
          key={f.id}
          food={f}
          styles={styles}
          colors={colors}
          onCarbsCommit={(c) => onChange(foods.map((x) => (x.id === f.id ? { ...x, carbs: c } : x)))}
          onRemove={() => onChange(foods.filter((x) => x.id !== f.id))}
        />
      ))}

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Add a food (e.g. rice)"
          placeholderTextColor={colors.faint}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={[styles.input, { width: 64, marginLeft: 6 }]}
          placeholder="g"
          placeholderTextColor={colors.faint}
          keyboardType="numeric"
          value={carbs}
          onChangeText={setCarbs}
          onSubmitEditing={add}
        />
        <TouchableOpacity style={styles.addButton} onPress={add}>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.total}>Total: {sumCarbs(foods)}g carbs</Text>
    </View>
  );
}

const makeStyles = (c) =>
  StyleSheet.create({
    empty: { color: c.faint, fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, borderRadius: 10, padding: 10, marginBottom: 6 },
    name: { color: c.text, flex: 1, fontSize: 14 },
    carbsInput: { backgroundColor: c.card, color: c.text, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, width: 58, textAlign: 'center' },
    unit: { color: c.textMuted, marginLeft: 4, marginRight: 8 },
    remove: { padding: 4 },
    removeText: { color: c.danger, fontSize: 16, fontWeight: '700' },
    addRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    input: { backgroundColor: c.bg, color: c.text, borderRadius: 10, padding: 10 },
    addButton: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, marginLeft: 6 },
    addText: { color: c.onAccent, fontWeight: '700' },
    total: { color: c.accentText, fontWeight: '700', marginTop: 10 },
  });
