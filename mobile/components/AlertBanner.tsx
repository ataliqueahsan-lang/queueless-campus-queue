import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { onAlert, type InAppAlert } from '@/services/alerts';

/** Slide-down in-app notification. Works everywhere, no push setup needed. */
export function AlertBanner() {
  const [alert, setAlert] = useState<InAppAlert | null>(null);
  const y = useRef(new Animated.Value(-140)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }).start(() => setAlert(null));
  useEffect(() => onAlert((a) => {
    setAlert(a);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(hide, 4500);
  }), []);

  if (!alert) return null;
  return (
    <SafeAreaView pointerEvents="box-none" edges={['top']} style={st.wrap}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        <Pressable onPress={hide} style={st.box} accessibilityRole="alert">
          <Text style={st.title}>🔔 {alert.title}</Text>
          <Text style={st.body}>{alert.body}</Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}
const st = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 14, zIndex: 99 },
  box: { backgroundColor: colors.ink, borderRadius: 18, padding: 14, marginTop: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
  title: { color: colors.white, fontWeight: '800', fontSize: 15 }, body: { color: '#D7DDF5', marginTop: 3, fontSize: 14 },
});
