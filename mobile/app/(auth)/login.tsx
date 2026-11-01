import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Banner, Button, Field, Screen } from '@/components/ui';
import { BRAND, DEMO_STUDENT_EMAIL, colors } from '@/constants/theme';
import { repo } from '@/services/repo';
import { friendlyError } from '@/utils/errors';

export default function Login() {
  const demo = repo.mode === 'demo';
  const [email, setEmail] = useState(demo ? DEMO_STUDENT_EMAIL : '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || (!demo && !password)) return setError('Please enter your email and password.');
    setBusy(true);
    try { await repo.signIn(email.trim(), password); }
    catch (e) { setError(friendlyError(e, 'Unable to log in right now. Please try again.')); }
    finally { setBusy(false); }
  }
  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ alignItems: 'center', marginTop: 28, marginBottom: 28 }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 40, fontWeight: '900' }}>Q</Text>
          </View>
          <Text style={{ fontSize: 30, fontWeight: '900', color: colors.ink, marginTop: 12 }}>{BRAND.name}</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{BRAND.tagline}</Text>
        </View>
        {demo && <Banner tone="blue" text="Demo mode: sample data, no account needed. Any password works." />}
        {error && <Banner tone="red" text={error} />}
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@university.edu" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder={demo ? 'Any password' : 'Your password'} />
        <Button title="Log in" onPress={submit} loading={busy} />
        <Text style={{ textAlign: 'center', marginTop: 22, color: colors.muted }}>
          New to QueueLess? <Link href="/(auth)/register" style={{ color: colors.primary, fontWeight: '800' }}>Register</Link>
        </Text>
        <Text style={{ textAlign: 'center', marginTop: 40, color: colors.muted, fontWeight: '600' }}>{BRAND.secondary}</Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}
