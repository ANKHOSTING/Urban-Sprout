import React from 'react';
import { Alert, Linking, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { usePro } from '@/lib/pro';
import { restorePurchases } from '@/lib/purchases';
import { Button, Card, s } from '@/components/ui';

export const PRIVACY_URL = 'https://github.com/ANKHOSTING/Urban-Sprout/blob/main/PRIVACY_POLICY.md';

export default function Account() {
  const { session } = useAuth();
  const { pro, refresh } = usePro();
  const router = useRouter();
  const deleteAccount = () => Alert.alert(
    'Delete account?',
    'This permanently deletes your account, plants, journal, photos, and listings. This cannot be undone. Cancel any Sprout Pro subscription in Google Play separately.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete forever', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('delete_my_account');
        if (error) return Alert.alert('Could not delete', error.message);
        await supabase.auth.signOut();
      } },
    ],
  );
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Card>
        <Text style={s.h2}>{session?.user.email}</Text>
        <Text style={s.muted}>{pro ? '🌟 Sprout Pro member' : 'Free plan'}</Text>
      </Card>
      {!pro && <Button title="Upgrade to Sprout Pro" onPress={() => router.push('/pro')} />}
      <Button title="Restore purchases" variant="secondary" onPress={async () => { await restorePurchases(); await refresh(); }} />
      <Button title="Manage subscription" variant="secondary"
        onPress={() => Linking.openURL('https://play.google.com/store/account/subscriptions?package=com.ankhosting.urbansprout')} />
      <Button title="Privacy policy" variant="secondary" onPress={() => Linking.openURL(PRIVACY_URL)} />
      <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      <Button title="Delete account" variant="danger" onPress={deleteAccount} />
    </ScrollView>
  );
}
