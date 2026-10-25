import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { supabase, type Plant } from '@/lib/supabase';
import { nextWaterDate } from '@/lib/plantCare';
import { AdBanner } from '@/components/AdBanner';
import { Card, Empty, s } from '@/components/ui';

export default function MyPlants() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('plants').select('*').order('created_at', { ascending: false });
    setPlants((data as Plant[]) ?? []);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <View style={s.screen}>
      <FlatList
        contentContainerStyle={s.pad}
        data={plants}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Empty text="No plants yet. Tap + to add your first plant." />}
        renderItem={({ item }) => {
          const next = nextWaterDate(item.last_watered_at, item.water_every_days);
          const due = !next || next.getTime() <= Date.now();
          return (
            <Pressable onPress={() => router.push({ pathname: '/plant/[id]', params: { id: item.id } })}>
              <Card>
                <Text style={s.h2}>{item.name}</Text>
                {!!item.species && <Text style={s.muted}>{item.species}</Text>}
                <Text style={{ color: due ? '#C62828' : '#2E7D32' }}>
                  {due ? '💧 Needs water' : `Next water: ${next!.toLocaleDateString()}`} · every {item.water_every_days}d
                </Text>
              </Card>
            </Pressable>
          );
        }}
      />
      <AdBanner />
      <Link href="/plant/new" asChild>
        <Pressable style={[s.fab, { bottom: 80 }]} accessibilityLabel="Add plant"><Text style={{ color: '#fff', fontSize: 28 }}>+</Text></Pressable>
      </Link>
    </View>
  );
}
