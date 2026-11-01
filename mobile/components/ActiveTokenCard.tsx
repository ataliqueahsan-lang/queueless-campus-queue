import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useData } from '@/hooks/useData';
import type { Token } from '@/types';
import { ordinal } from '@/utils/format';
import { estimateWait, positionOf } from '@/utils/queueLogic';
import { Button } from './ui';

export function ActiveTokenCard({ token }: { token: Token }) {
  const router = useRouter();
  const { queues } = useData();
  const q = queues.find((x) => x.serviceId === token.serviceId);
  const waiting = token.status === 'WAITING' && q;
  const pos = waiting ? positionOf(q!, token.tokenNumber) : 0;
  return (
    <View style={st.card}>
      <Text style={st.kicker}>YOUR ACTIVE TOKEN</Text>
      <View style={st.row}>
        <Text style={st.num}>#{token.tokenNumber}</Text>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={st.svc}>{token.serviceName}</Text>
          {waiting ? (
            <Text style={st.meta}>{ordinal(pos)} in line · ~{estimateWait(pos, q!.estimatedServiceTime)} min (estimate)</Text>
          ) : <Text style={st.meta}>{token.status === 'CALLED' ? '🔔 Your turn! Go to the counter' : 'Being served'}</Text>}
        </View>
      </View>
      <Button title="View Token" variant="secondary" onPress={() => router.push(`/token/${token.id}`)} />
    </View>
  );
}
const st = StyleSheet.create({
  card: { backgroundColor: colors.primary, borderRadius: 24, padding: 18, gap: 14 },
  kicker: { color: '#C9D2FF', fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  num: { fontSize: 52, fontWeight: '900', color: colors.white, letterSpacing: -2 },
  svc: { color: colors.white, fontSize: 20, fontWeight: '800' }, meta: { color: '#DCE2FF', marginTop: 2, fontSize: 14 },
});
