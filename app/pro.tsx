import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { buyPackage, getProPackages, purchasesAvailable, restorePurchases } from '@/lib/purchases';
import { usePro } from '@/lib/pro';
import { Button, Card, s } from '@/components/ui';

export default function Pro() {
  const router = useRouter();
  const { pro, refresh } = usePro();
  const [pkgs, setPkgs] = useState<PurchasesPackage[] | null>(null);
  useEffect(() => { getProPackages().then(setPkgs).catch(() => setPkgs([])); }, []);
  const buy = async (p: PurchasesPackage) => {
    try { if (await buyPackage(p)) { await refresh(); Alert.alert('Welcome to Sprout Pro! 🌟'); router.back(); } }
    catch (e: any) { if (!e?.userCancelled) Alert.alert('Purchase failed', e?.message ?? String(e)); }
  };
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Text style={s.h1}>🌟 Sprout Pro</Text>
      <Card>
        <Text>✅ Unlimited AI plant advice</Text>
        <Text>✅ No ads</Text>
        <Text>✅ Support an indie gardening app</Text>
      </Card>
      {pro && <Text style={s.h2}>You're already a Pro member. Thank you!</Text>}
      {!purchasesAvailable() && <Text style={s.muted}>Subscriptions are not configured in this build (set EXPO_PUBLIC_REVENUECAT_ANDROID_KEY).</Text>}
      {pkgs === null && purchasesAvailable() && <ActivityIndicator />}
      {pkgs?.map((p) => (
        <Button key={p.identifier} title={`${p.product.title || 'Sprout Pro'} · ${p.product.priceString}`} onPress={() => buy(p)} />
      ))}
      <Button title="Restore purchases" variant="secondary" onPress={async () => { await restorePurchases(); await refresh(); }} />
      <Text style={s.muted}>Subscriptions renew automatically until cancelled in Google Play. Pro status is synced to our server for AI limits.</Text>
    </ScrollView>
  );
}
