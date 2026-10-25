import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewProps } from 'react-native';

export const colors = { green: '#2E7D32', light: '#E8F5E9', text: '#1B2E1C', muted: '#5F6F60', danger: '#C62828', white: '#fff' };

export function Button({ title, onPress, variant = 'primary', disabled }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean;
}) {
  const bg = variant === 'primary' ? colors.green : variant === 'danger' ? colors.danger : colors.light;
  const fg = variant === 'secondary' ? colors.green : colors.white;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }]}>
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}
export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[s.input, props.style]} />;
}
export function Card(props: ViewProps) {
  return <View {...props} style={[s.card, props.style]} />;
}
export function Empty({ text }: { text: string }) {
  return <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24 }}>{text}</Text>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6FBF6' },
  pad: { padding: 16, gap: 12 },
  h1: { fontSize: 24, fontWeight: '700', color: colors.text },
  h2: { fontSize: 18, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' },
  btnText: { fontWeight: '600', fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#C8E6C9', backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 16, color: colors.text },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 6, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: colors.green, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
