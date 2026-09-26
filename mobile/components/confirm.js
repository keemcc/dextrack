import { Alert, Platform } from 'react-native';

// Yes/No confirmation that works on phones and on the web preview
// (Alert.alert with buttons does nothing on web).
export function confirmAction(title, message, confirmLabel, onConfirm) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
