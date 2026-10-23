import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, type Plant } from '@/lib/supabase';
import { lookupCare, nextWaterDate } from '@/lib/plantCare';
import { cancelWatering, hasReminder, scheduleWatering } from '@/lib/notifications';
import { Button, Card, s } from '@/components/ui';

export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [reminder, setReminder] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from('plants').select('*').eq('id', id).single();
    setPlant(data as Plant);
    setReminder(await hasReminder(id));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!plant) return null;
  const care = lookupCare(plant.species);
  const next = nextWaterDate(plant.last_watered_at, plant.water_every_days);
  const water = async () => {
    const { data } = await supabase.from('plants').update({ last_watered_at: new Date().toISOString() }).eq('id', plant.id).select().single();
    if (data) { setPlant(data as Plant); await scheduleWatering(data as Plant); setReminder(true); }
  };
  const toggleReminder = async () => {
    if (reminder) { await cancelWatering(plant.id); setReminder(false); }
    else { await scheduleWatering(plant); setReminder(await hasReminder(plant.id)); }
  };
  const remove = () => Alert.alert('Delete plant?', plant.name, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      await cancelWatering(plant.id); await supabase.from('plants').delete().eq('id', plant.id); router.back();
    } },
  ]);
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Stack.Screen options={{ title: plant.name }} />
      <Card>
        <Text style={s.h1}>{plant.name}</Text>
        {!!plant.species && <Text style={s.muted}>{plant.species}</Text>}
        {!!plant.location && <Text>📍 {plant.location}</Text>}
        {!!plant.sunlight && <Text>☀️ {plant.sunlight}</Text>}
        <Text>💧 Every {plant.water_every_days} days{next ? ` · next ${next.toLocaleDateString()}` : ''}</Text>
        {!!plant.notes && <Text style={s.muted}>{plant.notes}</Text>}
        {care && <Text style={s.muted}>Tip: {care.tips}</Text>}
      </Card>
      <Button title="I watered it" onPress={water} />
      <Button title={reminder ? 'Turn off reminders' : 'Turn on reminders'} variant="secondary" onPress={toggleReminder} />
      <Button title="Ask AI about this plant" variant="secondary"
        onPress={() => router.push({ pathname: '/advice', params: { q: `How do I care for my ${plant.species || plant.name}?` } })} />
      <Button title="Delete plant" variant="danger" onPress={remove} />
    </ScrollView>
  );
}
