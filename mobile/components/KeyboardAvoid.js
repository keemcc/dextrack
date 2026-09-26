import React from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';
import { useTheme } from '../theme';

// Header height so the keyboard offset is right on screens that have a stack header.
// Tab screens without a header have none, so fall back to 0.
let useHeaderHeight = () => 0;
try {
  useHeaderHeight = require('@react-navigation/elements').useHeaderHeight;
} catch (e) {}

function useOffset() {
  try {
    return useHeaderHeight();
  } catch (e) {
    return 0;
  }
}

// Lifts its content above the keyboard so text boxes are never covered.
export function KeyboardAvoid({ children, style }) {
  const { colors } = useTheme();
  const offset = useOffset();
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: colors.bg }, style]}
      behavior="padding"
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

// Same, but the content also scrolls (forms that can be taller than the screen).
export default function KeyboardScrollScreen({ children, contentStyle }) {
  return (
    <KeyboardAvoid>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={contentStyle}
      >
        {children}
      </ScrollView>
    </KeyboardAvoid>
  );
}
