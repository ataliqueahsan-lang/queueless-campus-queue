import { useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { ActiveTokenCard } from '@/components/ActiveTokenCard';
import { ServiceCard } from '@/components/ServiceCard';
import { Banner, Card, Empty, Screen } from '@/components/ui';
import { BRAND, colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { repo } from '@/services/repo';
import { greeting } from '@/utils/format';

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { views, activeTokens, loading, error, offline } = useData();
  const first = user?.name?.split(' ')[0] ?? 'Student';

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>{greeting()}, {first} 👋</Text>
      <Text style={{ fontSize: 16, color: colors.muted, marginTop: 4, marginBottom: 18 }}>How can we help you today?</Text>

      {repo.mode === 'demo' && <Banner tone="blue" text="Demo mode: showing sample campus data." />}
      {offline && <Banner text="You appear to be offline. Showing the last known queue status." />}
      {error && <Banner tone="red" text={error} />}

      {activeTokens.length > 0 ? (
        <View style={{ gap: 12, marginBottom: 22 }}>{activeTokens.map((t) => <ActiveTokenCard key={t.id} token={t} />)}</View>
      ) : (
        <Card style={{ marginBottom: 22, alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ fontSize: 30 }}>🎟️</Text>
          <Text style={{ color: colors.ink, fontWeight: '700', marginTop: 6 }}>You’re not currently in a queue.</Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>Pick a service below to get a digital token.</Text>
        </Card>
      )}

      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, marginBottom: 12 }}>Campus services</Text>
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} /> :
        views.length === 0 ? <Empty emoji="🏫" title="No services available yet" body="Ask staff to add campus services from the admin dashboard." /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {views.map((v) => <ServiceCard key={v.service.id} view={v} onPress={() => router.push(`/service/${v.service.id}`)} />)}
          </View>
        )}
      <Text style={{ textAlign: 'center', color: colors.muted, fontWeight: '600', marginTop: 34 }}>{BRAND.secondary}</Text>
    </Screen>
  );
}
