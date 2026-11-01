import { Pressable, Text, View } from 'react-native';
import { Card, Empty, Screen } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useData } from '@/hooks/useData';
import { repo } from '@/services/repo';
import { whenLabel } from '@/utils/format';

const EMOJI: Record<string, string> = { joined: '🎟️', soon: '⏳', next: '🏃', called: '🔔', completed: '✅', skipped: '⏭️' };

export default function Notifications() {
  const { user } = useAuth();
  const { notifications, unread } = useData();
  const markAll = () => user && repo.markRead(user.uid, notifications.filter((n) => !n.read).map((n) => n.id)).catch(() => {});
  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: colors.ink }}>Alerts</Text>
        {unread > 0 && <Pressable onPress={markAll} hitSlop={10}><Text style={{ color: colors.primary, fontWeight: '800' }}>Mark all read</Text></Pressable>}
      </View>
      {notifications.length === 0 ? <Empty emoji="🔔" title="No notifications yet" body="Queue updates will show up here." /> : (
        <View style={{ gap: 10, marginTop: 16 }}>
          {notifications.map((n) => (
            <Card key={n.id} style={{ flexDirection: 'row', gap: 12, backgroundColor: n.read ? colors.white : colors.primarySoft }}>
              <Text style={{ fontSize: 26 }}>{EMOJI[n.type] ?? '🔔'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: colors.ink, fontSize: 15 }}>{n.title}</Text>
                <Text style={{ color: colors.ink, marginTop: 2 }}>{n.body}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>{whenLabel(n.createdAt)}</Text>
              </View>
              {!n.read && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 }} />}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
