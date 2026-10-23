import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { photoUrl, supabase, type JournalEntry } from '@/lib/supabase';
import { AdBanner } from '@/components/AdBanner';
import { Card, Empty, s } from '@/components/ui';

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('journal_entries').select('*').order('created_at', { ascending: false });
    setEntries((data as JournalEntry[]) ?? []);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const remove = (e: JournalEntry) => Alert.alert('Delete entry?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      if (e.photo_path) await supabase.storage.from('photos').remove([e.photo_path]);
      await supabase.from('journal_entries').delete().eq('id', e.id); load();
    } },
  ]);
  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.pad}
        data={entries}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Empty text="Track your garden's progress with notes and photos. Tap + to start." />}
        renderItem={({ item }) => {
          const url = photoUrl(item.photo_path);
          return (
            <Pressable onLongPress={() => remove(item)}>
              <Card>
                <Text style={s.muted}>{new Date(item.created_at).toLocaleString()}</Text>
                {url && <Image source={{ uri: url }} style={{ width: '100%', height: 200, borderRadius: 8 }} />}
                <Text>{item.body}</Text>
              </Card>
            </Pressable>
          );
        }}
      />
      <AdBanner />
      <Link href="/journal/new" asChild>
        <Pressable style={[s.fab, { bottom: 80 }]} accessibilityLabel="New entry"><Text style={{ color: '#fff', fontSize: 28 }}>+</Text></Pressable>
      </Link>
    </View>
  );
}
