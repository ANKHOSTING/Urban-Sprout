import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import mobileAds from 'react-native-google-mobile-ads';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ProProvider } from '@/lib/pro';
import { initPurchases } from '@/lib/purchases';
import { ADS_ENABLED } from '@/lib/ads';
import { colors } from '@/components/ui';

initPurchases();

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === 'sign-in';
    if (!session && !inAuth) router.replace('/sign-in');
    else if (session && inAuth) router.replace('/');
  }, [session, loading, segments, router]);
  if (loading) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.green} /></View>;
  return (
    <Stack screenOptions={{ headerTintColor: colors.green }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="plant/new" options={{ title: 'Add plant', presentation: 'modal' }} />
      <Stack.Screen name="plant/[id]" options={{ title: 'Plant' }} />
      <Stack.Screen name="journal/new" options={{ title: 'New journal entry', presentation: 'modal' }} />
      <Stack.Screen name="market/new" options={{ title: 'New listing', presentation: 'modal' }} />
      <Stack.Screen name="market/[id]" options={{ title: 'Listing' }} />
      <Stack.Screen name="pro" options={{ title: 'Sprout Pro', presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => { if (ADS_ENABLED) mobileAds().initialize().catch(() => {}); }, []);
  return (
    <AuthProvider>
      <ProProvider>
        <StatusBar style="dark" />
        <Gate />
      </ProProvider>
    </AuthProvider>
  );
}
