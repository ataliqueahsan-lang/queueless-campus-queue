import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Banner, Button, Field, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { repo } from '@/services/repo';
import { friendlyError } from '@/utils/errors';

export default function Register() {
  const [f, setF] = useState({ name: '', studentId: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = 'Enter your full name.';
    if (f.studentId.trim().length < 3) e.studentId = 'Enter your university / student ID.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (f.password.length < 6) e.password = 'Use at least 6 characters.';
    if (f.confirm !== f.password) e.confirm = 'Passwords do not match.';
    setErrors(e); setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { await repo.register({ name: f.name.trim(), studentId: f.studentId.trim(), email: f.email.trim(), password: f.password }); }
    catch (x) { setError(friendlyError(x, 'Unable to create your account right now. Please try again.')); }
    finally { setBusy(false); }
  }
  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '900', color: colors.ink, marginTop: 10 }}>Create your account</Text>
      <Text style={{ color: colors.muted, marginBottom: 22, marginTop: 4 }}>Join queues from anywhere on campus.</Text>
      {error && <Banner tone="red" text={error} />}
      <Field label="Full name" value={f.name} onChangeText={set('name')} error={errors.name} autoComplete="name" />
      <Field label="University / Student ID" value={f.studentId} onChangeText={set('studentId')} error={errors.studentId} autoCapitalize="characters" />
      <Field label="Email" value={f.email} onChangeText={set('email')} error={errors.email} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Password" value={f.password} onChangeText={set('password')} error={errors.password} secureTextEntry />
      <Field label="Confirm password" value={f.confirm} onChangeText={set('confirm')} error={errors.confirm} secureTextEntry />
      <Button title="Register" onPress={submit} loading={busy} />
      <Text style={{ textAlign: 'center', marginTop: 20, color: colors.muted }}>
        Already have an account? <Link href="/(auth)/login" style={{ color: colors.primary, fontWeight: '800' }}>Log in</Link>
      </Text>
    </Screen>
  );
}
