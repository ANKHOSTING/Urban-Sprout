import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ProProvider } from '@/lib/pro';
import { initPurchases, isPro } from '@/lib/purchases';
import { ADS_ENABLED, AdsReadyContext } from '@/lib/ads';
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
  const [adsReady, setAdsReady] = useState(false);
  useEffect(() => {
    if (!ADS_ENABLED) return;
    let cancelled = false;
    (async () => {
      if (await isPro().catch(() => false)) return; // Pro users never see ads: no consent form, no SDK init
      // UMP consent first (shows the consent form where required). Default is "no ad requests"; if the request fails we
      // only proceed when the last known consent info already allows ads. Banners are always non-personalized (AdBanner).
      let canRequestAds = false;
      try {
        canRequestAds = (await AdsConsent.gatherConsent()).canRequestAds;
      } catch (e) {
        console.warn('UMP consent request failed; falling back to last known consent info', e);
        try { canRequestAds = (await AdsConsent.getConsentInfo()).canRequestAds; } catch { canRequestAds = false; }
      }
      if (cancelled || !canRequestAds) return;
      try { await mobileAds().initialize(); } catch (e) { console.warn('mobileAds().initialize() failed', e); }
      if (!cancelled) setAdsReady(true);
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <AdsReadyContext.Provider value={adsReady}>
      <AuthProvider>
        <ProProvider>
          <StatusBar style="dark" />
          <Gate />
        </ProProvider>
      </AuthProvider>
    </AdsReadyContext.Provider>
  );
}
