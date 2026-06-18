import { Stack, useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getCurrentUser, initDemo } from '../store';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Load store + check session once on mount
  useEffect(() => {
    initDemo()
      .then(() => getCurrentUser())
      .then(user => setAuthed(!!user))
      .catch(() => setAuthed(false));
  }, []);

  // Navigate only once the navigator is mounted and auth state is known
  useEffect(() => {
    if (!navState?.key || authed === null) return;
    const inAuth = segments[0] === 'auth';
    if (!authed && !inAuth) router.replace('/auth');
    else if (authed && inAuth) router.replace('/map');
  }, [authed, navState?.key]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0C0C14' }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
