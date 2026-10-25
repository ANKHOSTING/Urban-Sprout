import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { formatPrice, photoUrl, supabase, type Listing } from '@/lib/supabase';
import { AdBanner } from '@/components/AdBanner';
import { Card, Empty, s } from '@/components/ui';

export default function Market() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const load = useCallback(async () => {
    setLoading(true);
    // RLS hides listings from blocked users and hidden (moderated) listings.
    const { data } = await supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(100);
    setItems((data as Listing[]) ?? []);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.pad}
        data={items}
        keyExtractor={(l) => l.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Empty text="No listings yet. Share cuttings, seeds, or produce with neighbors." />}
        renderItem={({ item }) => {
          const url = photoUrl(item.photo_path);
          return (
            <Pressable onPress={() => router.push({ pathname: '/market/[id]', params: { id: item.id } })}>
              <Card style={[s.row, { alignItems: 'flex-start' }]}>
                {url && <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 8 }} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.h2}>{item.title}</Text>
                  <Text style={{ color: '#2E7D32', fontWeight: '600' }}>{formatPrice(item)}</Text>
                  {!!item.location && <Text style={s.muted}>📍 {item.location}</Text>}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      <AdBanner />
      <Link href="/market/new" asChild>
        <Pressable style={[s.fab, { bottom: 80 }]} accessibilityLabel="New listing"><Text style={{ color: '#fff', fontSize: 28 }}>+</Text></Pressable>
      </Link>
    </View>
  );
}
