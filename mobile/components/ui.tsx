import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius } from '@/constants/theme';

export function Screen({ children, scroll = true, pad = true }: { children: ReactNode; scroll?: boolean; pad?: boolean }) {
  const body = scroll
    ? <ScrollView contentContainerStyle={[pad && s.pad, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={[{ flex: 1 }, pad && s.pad]}>{children}</View>;
  return <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>{body}</SafeAreaView>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const inner = [s.card, style];
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [...inner, pressed && { opacity: 0.85 }]}>{children}</Pressable> : <View style={inner}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; loading?: boolean;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.redBg : variant === 'secondary' ? colors.primarySoft : 'transparent';
  const fg = variant === 'primary' ? colors.white : variant === 'danger' ? colors.red : colors.primaryDark;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#9AA3C4" style={[s.input, !!error && { borderColor: colors.red }]} {...props} />
      {!!error && <Text style={s.err}>{error}</Text>}
    </View>
  );
}

export function Pill({ text, tone }: { text: string; tone: 'green' | 'amber' | 'red' | 'grey' | 'blue' }) {
  const map = {
    green: [colors.greenBg, colors.green], amber: [colors.amberBg, colors.amber], red: [colors.redBg, colors.red],
    grey: [colors.greyBg, colors.grey], blue: [colors.primarySoft, colors.primaryDark],
  } as const;
  return <View style={[s.pill, { backgroundColor: map[tone][0] }]}><Text style={[s.pillText, { color: map[tone][1] }]}>{text}</Text></View>;
}

export function Banner({ text, tone = 'amber' }: { text: string; tone?: 'amber' | 'red' | 'blue' }) {
  const bg = tone === 'red' ? colors.redBg : tone === 'blue' ? colors.primarySoft : colors.amberBg;
  const fg = tone === 'red' ? colors.red : tone === 'blue' ? colors.primaryDark : colors.amber;
  return <View style={[s.banner, { backgroundColor: bg }]}><Text style={{ color: fg, fontWeight: '600' }}>{text}</Text></View>;
}

export function Empty({ emoji, title, body }: { emoji: string; title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Text style={{ fontSize: 42 }}>{emoji}</Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink, marginTop: 10 }}>{title}</Text>
      {!!body && <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'center' }}>{body}</Text>}
    </View>
  );
}

export function BackHeader({ title }: { title?: string }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'))} hitSlop={12} accessibilityLabel="Go back">
        <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700' }}>‹ Back</Text>
      </Pressable>
      {!!title && <Text style={{ marginLeft: 12, fontSize: 17, fontWeight: '700', color: colors.ink }}>{title}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: 18, borderWidth: 1, borderColor: colors.border },
  btn: { minHeight: 52, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnText: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.ink },
  err: { color: colors.red, fontSize: 12, marginTop: 4 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800' },
  banner: { padding: 12, borderRadius: 14, marginBottom: 14 },
});
