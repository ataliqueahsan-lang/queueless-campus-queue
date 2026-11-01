import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AlertBanner } from '@/components/AlertBanner';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { DataProvider } from '@/hooks/useData';

function Shell() {
  const { user, loading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  // Route guard: signed-out users go to login, signed-in users leave the auth screens.
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const atSplash = segments.length === 0 || segments[0] === 'index';
    if (!user && !inAuth && !atSplash) router.replace('/(auth)/login');
    if (user && inAuth) router.replace('/(tabs)/home');
  }, [user, loading, segments.join('/')]);

  return (
    <DataProvider user={user}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
      <AlertBanner />
    </DataProvider>
  );
}
export default function Root() { return <AuthProvider><Shell /></AuthProvider>; }
