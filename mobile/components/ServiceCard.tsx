import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { CROWD_EMOJI, CROWD_TEXT, type ServiceView } from '@/utils/views';
import { Card, Pill } from './ui';

const TONE = { OPEN: 'green', BUSY: 'amber', PAUSED: 'grey', CLOSED: 'red' } as const;
const LABEL = { OPEN: 'Open', BUSY: 'Busy', PAUSED: 'Paused', CLOSED: 'Closed' } as const;

export function ServiceCard({ view, onPress }: { view: ServiceView; onPress: () => void }) {
  const { service, waiting, estWait, crowd, status } = view;
  return (
    <Card onPress={onPress} style={st.card}>
      <View style={st.top}>
        <View style={st.icon}><Text style={{ fontSize: 26 }}>{service.icon}</Text></View>
        <Pill text={LABEL[status]} tone={TONE[status]} />
      </View>
      <Text style={st.name}>{service.name}</Text>
      <Text style={st.meta}>{waiting} waiting</Text>
      <Text style={st.meta}>~{estWait} min wait</Text>
      <Text style={st.crowd}>{CROWD_EMOJI[crowd]} {CROWD_TEXT[crowd]} crowd</Text>
    </Card>
  );
}
const st = StyleSheet.create({
  card: { flex: 1, minWidth: '46%', padding: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 19, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  meta: { fontSize: 14, color: colors.muted, marginTop: 1 },
  crowd: { marginTop: 8, fontSize: 13, fontWeight: '700', color: colors.ink },
});
