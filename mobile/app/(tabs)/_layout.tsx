import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/constants/theme';
import { useData } from '@/hooks/useData';

const icon = (e: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{e}</Text>;

export default function TabsLayout() {
  const { unread } = useData();
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontWeight: '700', fontSize: 12 }, tabBarStyle: { height: 62, paddingTop: 6, borderTopColor: colors.border },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('🧾') }} />
      <Tabs.Screen name="notifications" options={{ title: 'Alerts', tabBarIcon: icon('🔔'), tabBarBadge: unread > 0 ? unread : undefined }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
