import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Banner, Button, Card, Field, Screen } from '@/components/ui';
import { BRAND, colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePrefs } from '@/services/prefs';
import { repo } from '@/services/repo';
import { friendlyError } from '@/utils/errors';

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: 2 }}>{value || '—'}</Text>
  </View>
);

export default function Profile() {
  const { user } = useAuth();
  const { prefs, set } = usePrefs();
  const [editing, setEditing] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [sid, setSid] = useState(user?.studentId ?? '');
  const [msg, setMsg] = useState<{ t: 'red' | 'blue'; s: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function save() {
    if (name.trim().length < 2 || sid.trim().length < 3) return setMsg({ t: 'red', s: 'Please enter a valid name and student ID.' });
    setBusy(true);
    try {
      await repo.updateProfile(user!.uid, { name: name.trim(), studentId: sid.trim() });
      setEditing(false); setMsg({ t: 'blue', s: 'Profile updated.' });
    } catch (e) { setMsg({ t: 'red', s: friendlyError(e, 'Unable to update your profile right now.') }); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 38, fontWeight: '900' }}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink, marginTop: 10 }}>{user.name}</Text>
      </View>
      {msg && <Banner tone={msg.t} text={msg.s} />}

      <Card>
        {editing ? (
          <>
            <Field label="Full name" value={name} onChangeText={setName} />
            <Field label="Student ID" value={sid} onChangeText={setSid} autoCapitalize="characters" />
            <View style={{ gap: 8 }}>
              <Button title="Save changes" onPress={save} loading={busy} />
              <Button title="Cancel" variant="ghost" onPress={() => { setEditing(false); setName(user.name); setSid(user.studentId); }} />
            </View>
          </>
        ) : (
          <>
            <Row label="NAME" value={user.name} /><Row label="STUDENT ID" value={user.studentId} /><Row label="EMAIL" value={user.email} />
          </>
        )}
      </Card>

      <View style={{ gap: 10, marginTop: 16 }}>
        {!editing && <Button title="Edit Profile" variant="secondary" onPress={() => { setName(user.name); setSid(user.studentId); setMsg(null); setEditing(true); }} />}
        <Button title={showPrefs ? 'Hide Notification Settings' : 'Notification Settings'} variant="secondary" onPress={() => setShowPrefs((v) => !v)} />
      </View>

      {showPrefs && (
        <Card style={{ marginTop: 12, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.ink }}>In-app alerts</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Show a banner when your queue changes</Text></View>
            <Switch value={prefs.banners} onValueChange={(v) => set({ banners: v })} trackColor={{ true: colors.primary }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.ink }}>Vibration</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Vibrate when it’s your turn</Text></View>
            <Switch value={prefs.vibrate} onValueChange={(v) => set({ vibrate: v })} trackColor={{ true: colors.primary }} />
          </View>
        </Card>
      )}

      <View style={{ marginTop: 22 }}><Button title="Logout" variant="danger" onPress={() => repo.signOut()} /></View>
      <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 26, fontWeight: '600' }}>{BRAND.name} · {BRAND.secondary}</Text>
      {repo.mode === 'demo' && <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 4, fontSize: 12 }}>Running in demo mode</Text>}
    </Screen>
  );
}
