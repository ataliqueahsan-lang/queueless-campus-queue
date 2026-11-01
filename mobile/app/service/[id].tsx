import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { BackHeader, Banner, Button, Card, Empty, Pill, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { repo } from '@/services/repo';
import type { Token } from '@/types';
import { friendlyError, JOIN_FAILED } from '@/utils/errors';
import { ordinal } from '@/utils/format';
import { estimateWait, positionOf } from '@/utils/queueLogic';
import { CROWD_EMOJI, CROWD_TEXT } from '@/utils/views';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 4 }}>{value}</Text>
    </View>
  );
}

export default function JoinQueue() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { views, activeTokens, queues, loading } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<Token | null>(null);

  const view = views.find((v) => v.service.id === id);
  if (!view) return <Screen><BackHeader />{loading ? null : <Empty emoji="🤷" title="Service not found" />}</Screen>;
  const { service, queue, waiting, status, crowd } = view;
  const existing = activeTokens.find((t) => t.serviceId === service.id);

  async function join() {
    if (!user) return;
    setBusy(true); setError(null);
    try { setJoined(await repo.joinQueue(user, service.id)); }
    catch (e) { setError(friendlyError(e, JOIN_FAILED)); }
    finally { setBusy(false); }
  }

  // ----- Token confirmation -----
  if (joined) {
    const q = queues.find((x) => x.serviceId === service.id) ?? queue;
    const pos = q ? positionOf(q, joined.tokenNumber) : joined.positionAtJoin;
    return (
      <Screen>
        <View style={{ backgroundColor: colors.primary, borderRadius: 28, padding: 28, alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: '#C9D2FF', fontWeight: '800', letterSpacing: 2 }}>YOUR TOKEN</Text>
          <Text style={{ color: '#fff', fontSize: 92, fontWeight: '900', letterSpacing: -4 }}>#{joined.tokenNumber}</Text>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>{service.name} Queue</Text>
        </View>
        <Card style={{ flexDirection: 'row', marginTop: 16 }}>
          <Stat label="CURRENT POSITION" value={ordinal(pos)} />
          <Stat label="ESTIMATED WAIT" value={`~${estimateWait(pos, q?.estimatedServiceTime ?? 3)} min`} />
        </Card>
        <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 14 }}>You can leave the physical line. We’ll alert you when it’s almost your turn.</Text>
        <Button title="View Live Queue" onPress={() => router.replace(`/token/${joined.id}`)} />
      </Screen>
    );
  }

  const blocked = status === 'CLOSED' || status === 'PAUSED' || !!existing;
  const blockText = existing ? `You already have token #${existing.tokenNumber} for ${service.name}.`
    : status === 'PAUSED' ? 'This queue is paused right now. Please check back soon.'
    : status === 'CLOSED' ? 'This service is closed right now.' : null;

  return (
    <Screen>
      <BackHeader />
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <View style={{ width: 84, height: 84, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 44 }}>{service.icon}</Text>
        </View>
        <Text style={{ fontSize: 30, fontWeight: '900', color: colors.ink, marginTop: 10 }}>{service.name}</Text>
        <Text style={{ color: colors.muted, marginTop: 2, textAlign: 'center' }}>{service.description}</Text>
        <View style={{ marginTop: 10 }}><Pill text={`${CROWD_EMOJI[crowd]} ${CROWD_TEXT[crowd]} crowd`} tone={crowd === 'LOW' ? 'green' : crowd === 'MODERATE' ? 'amber' : 'red'} /></View>
      </View>

      <Card style={{ flexDirection: 'row', paddingVertical: 22 }}>
        <Stat label="NOW SERVING" value={queue && queue.currentToken > 0 ? `#${queue.currentToken}` : '—'} />
        <Stat label="WAITING" value={String(waiting)} />
        <Stat label="EST. WAIT" value={`~${view.estWait} min`} />
      </Card>
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Wait time is an estimate based on the average service time.</Text>

      <View style={{ marginTop: 22 }}>
        {waiting === 0 && !blocked && <Banner tone="blue" text="The queue is empty. You’ll be next in line!" />}
        {blockText && <Banner text={blockText} />}
        {error && <Banner tone="red" text={error} />}
        {existing
          ? <Button title="View My Token" onPress={() => router.replace(`/token/${existing.id}`)} />
          : <Button title="Get Digital Token" onPress={join} loading={busy} disabled={blocked} />}
      </View>
    </Screen>
  );
}
