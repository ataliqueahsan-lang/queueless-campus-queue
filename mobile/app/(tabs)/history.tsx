import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Card, Empty, Pill, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useData } from '@/hooks/useData';
import { whenLabel } from '@/utils/format';
import { isActive } from '@/utils/queueLogic';

const TONE = { COMPLETED: 'green', SKIPPED: 'amber', CANCELLED: 'grey' } as const;
const shortName = (n: string) => (n === 'Laboratory' ? 'Lab' : n);

export default function History() {
  const { tokens, services } = useData();
  const [filter, setFilter] = useState<string>('all');
  const past = tokens.filter((t) => !isActive(t.status)).sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt));
  const shown = filter === 'all' ? past : past.filter((t) => t.serviceId === filter);
  const chips = [{ id: 'all', name: 'All' }, ...services.map((s) => ({ id: s.id, name: shortName(s.name) }))];

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '900', color: colors.ink }}>Past Tokens</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {chips.map((c) => (
          <Pressable key={c.id} onPress={() => setFilter(c.id)} accessibilityRole="button"
            style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: filter === c.id ? colors.ink : colors.white, borderWidth: 1, borderColor: filter === c.id ? colors.ink : colors.border }}>
            <Text style={{ fontWeight: '700', color: filter === c.id ? '#fff' : colors.ink }}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {shown.length === 0 ? <Empty emoji="🧾" title="No past tokens yet" body="Completed, skipped and cancelled tokens will appear here." /> : (
        <View style={{ gap: 10 }}>
          {shown.map((t) => (
            <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: colors.ink, minWidth: 64 }}>#{t.tokenNumber}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>{t.serviceName}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>{whenLabel(t.completedAt ?? t.createdAt)}</Text>
              </View>
              <Pill text={t.status.charAt(0) + t.status.slice(1).toLowerCase()} tone={TONE[t.status as keyof typeof TONE] ?? 'grey'} />
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
