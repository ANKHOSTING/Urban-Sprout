import React from 'react';
import { Alert, Linking, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { usePro } from '@/lib/pro';
import { restorePurchases } from '@/lib/purchases';
import { Button, Card, s } from '@/components/ui';

export const PRIVACY_URL = 'https://ankhosting.github.io/urban-sprout/privacy.html';

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
        // Remove stored photos through the Storage API first (SQL deletes leave the underlying files behind).
        const uid = session?.user.id;
        if (uid) {
          try {
            for (let i = 0; i < 20; i++) { // up to 20 pages of 100 files
              const { data: files, error: listErr } = await supabase.storage.from('photos').list(uid, { limit: 100 });
              if (listErr) throw listErr;
              if (!files || files.length === 0) break;
              const { error: rmErr } = await supabase.storage.from('photos').remove(files.map((f) => `${uid}/${f.name}`));
              if (rmErr) throw rmErr;
            }
          } catch (e: any) {
            return Alert.alert('Could not delete photos', e?.message ?? 'Please try again.');
          }
        }
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
