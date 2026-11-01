import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { BRAND, colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const fade = useRef(new Animated.Value(0)).current;
  const minTime = useRef(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    const t = setTimeout(() => { minTime.current = true; go(); }, 1600);
    return () => clearTimeout(t);
  }, []);
  const go = () => { if (minTime.current && !loading) router.replace(user ? '/(tabs)/home' : '/(auth)/login'); };
  useEffect(go, [loading, user]);

  return (
    <View style={st.wrap}>
      <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
        <View style={st.logo}><Text style={st.q}>Q</Text></View>
        <Text style={st.name}>{BRAND.name}</Text>
        <Text style={st.tag}>{BRAND.tagline}</Text>
      </Animated.View>
      <Text style={st.foot}>{BRAND.secondary}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 96, height: 96, borderRadius: 28, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  q: { fontSize: 56, fontWeight: '900', color: colors.primary }, name: { fontSize: 40, fontWeight: '900', color: colors.white, letterSpacing: -1 },
  tag: { color: '#DCE2FF', fontSize: 17, marginTop: 8 }, foot: { position: 'absolute', bottom: 48, color: '#B8C3FF', fontWeight: '600' },
});
