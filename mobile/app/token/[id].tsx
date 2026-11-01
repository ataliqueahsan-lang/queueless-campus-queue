import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { TokenProgress } from '@/components/TokenProgress';
import { BackHeader, Banner, Button, Card, Empty, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useData } from '@/hooks/useData';
import { repo } from '@/services/repo';
import { friendlyError } from '@/utils/errors';
import { ordinal } from '@/utils/format';
import { estimateWait, positionOf } from '@/utils/queueLogic';

function Big({ label, value, light }: { label: string; value: string; light?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: light ? '#C9D2FF' : colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ color: light ? '#fff' : colors.ink, fontSize: 28, fontWeight: '900', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

export default function LiveToken() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens, queues, loading, offline } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = tokens.find((t) => t.id === id);
  if (!token) return <Screen><BackHeader />{loading ? null : <Empty emoji="🎟️" title="Token not found" body="It may have been removed." />}</Screen>;
  const q = queues.find((x) => x.serviceId === token.serviceId);

  // Position is computed live from the queue document, never hard-coded.
  const waitingNow = token.status === 'WAITING' && !!q;
  const position = waitingNow ? positionOf(q!, token.tokenNumber) : 0;
  const ahead = q ? q.waitingNumbers.filter((n) => n < token.tokenNumber) : [];
  const wait = waitingNow ? estimateWait(position, q!.estimatedServiceTime) : 0;
  const progress = !waitingNow ? 1 : token.positionAtJoin <= 1 ? 0.9 : Math.max(0.06, (token.positionAtJoin - position) / (token.positionAtJoin - 1));

  const called = token.status === 'CALLED' || token.status === 'SERVING';
  const done = token.status === 'COMPLETED';
  const heroBg = called ? colors.green : done ? colors.ink : token.status === 'SKIPPED' || token.status === 'CANCELLED' ? colors.muted : colors.primary;

  async function doLeave() {
    setBusy(true); setError(null);
    try { await repo.leaveQueue(token!); router.replace('/(tabs)/home'); }
    catch (e) { setError(friendlyError(e, 'Unable to leave the queue right now. Please try again.')); }
    finally { setBusy(false); }
  }
  const leave = () => {
    if (Platform.OS === 'web') { if (confirm('Leave this queue? You will lose your place.')) doLeave(); return; }
    Alert.alert('Leave queue?', 'You will lose your place in line.', [{ text: 'Stay', style: 'cancel' }, { text: 'Leave queue', style: 'destructive', onPress: doLeave }]);
  };

  return (
    <Screen>
      <BackHeader title="QueueLess" />
      {offline && <Banner text="You’re offline. This screen will refresh when the connection returns." />}

      <View style={{ backgroundColor: heroBg, borderRadius: 28, padding: 24, alignItems: 'center' }}>
        <Text style={{ color: '#DCE2FF', fontWeight: '900', letterSpacing: 2 }}>{token.serviceName.toUpperCase()}</Text>
        <Text style={{ color: '#DCE2FF', marginTop: 10, fontWeight: '700' }}>Your Token</Text>
        <Text style={{ color: '#fff', fontSize: 84, fontWeight: '900', letterSpacing: -3 }}>#{token.tokenNumber}</Text>
        {called && <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>🔔 Your turn! Please go to the counter.</Text>}
        {done && <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>✓ Completed. Thank you!</Text>}
        {token.status === 'SKIPPED' && <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>This token was skipped. You can join again.</Text>}
        {token.status === 'CANCELLED' && <Text style={{ color: '#fff', fontWeight: '800' }}>You left this queue.</Text>}
        {waitingNow && position === 1 && <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>You’re next! Please go to the counter.</Text>}
        {waitingNow && position > 1 && position <= 3 && <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>Your turn is coming! Please get ready.</Text>}
      </View>

      <Card style={{ flexDirection: 'row', marginTop: 14, paddingVertical: 20 }}>
        <Big label="CURRENTLY SERVING" value={q && q.currentToken > 0 ? `#${q.currentToken}` : '—'} />
        <Big label="YOUR POSITION" value={waitingNow ? ordinal(position) : called ? 'Now' : '—'} />
        <Big label="EST. WAIT" value={waitingNow ? `~${wait}m` : '—'} />
      </Card>
      {waitingNow && <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 6 }}>Estimate: position × average service time ({q!.estimatedServiceTime} min).</Text>}

      {(waitingNow || called) && (
        <Card style={{ marginTop: 14 }}>
          <Text style={{ fontWeight: '800', color: colors.ink, marginBottom: 12 }}>Queue progress</Text>
          <View style={{ height: 10, borderRadius: 6, backgroundColor: colors.greyBg, overflow: 'hidden', marginBottom: 16 }}>
            <View style={{ height: 10, width: `${Math.round(progress * 100)}%`, backgroundColor: called ? colors.green : colors.primary, borderRadius: 6 }} />
          </View>
          <TokenProgress current={q?.currentToken ?? 0} ahead={ahead} mine={token.tokenNumber} called={called} />
        </Card>
      )}

      {repo.demo && q && (token.status === 'WAITING' || called) && (
        <Card style={{ marginTop: 14, borderStyle: 'dashed', borderColor: colors.primary }}>
          <Text style={{ fontWeight: '800', color: colors.primaryDark }}>🎬 Demo controls (acting as staff)</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginVertical: 6 }}>Only in demo mode. With Firebase, use the admin dashboard instead.</Text>
          <View style={{ gap: 8 }}>
            <Button variant="secondary" title="Call next token" onPress={() => repo.demo!.callNext(token.serviceId)} />
            <Button variant="secondary" title="Complete current token" onPress={() => repo.demo!.completeCurrent(token.serviceId)} />
          </View>
        </Card>
      )}

      {error && <View style={{ marginTop: 14 }}><Banner tone="red" text={error} /></View>}
      <View style={{ gap: 10, marginTop: 18 }}>
        {token.status === 'WAITING' && <Button title="Leave Queue" variant="danger" onPress={leave} loading={busy} />}
        {done && <Button title="View History" variant="secondary" onPress={() => router.replace('/(tabs)/history')} />}
        <Button title="Back to Home" variant={done ? 'primary' : 'ghost'} onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </Screen>
  );
}
