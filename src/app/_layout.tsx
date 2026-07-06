import { Stack, useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getCurrentUser, initDemo } from '../store';
import { ThemeProvider, useAppTheme } from '../context/ThemeContext';

// Gère la redirection automatique vers /auth ou /map selon la session
function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { C } = useAppTheme();

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
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

// Point d'entrée de l'app : englobe tout dans le ThemeProvider
export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}
