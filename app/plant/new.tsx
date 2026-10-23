import React, { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, type Plant } from '@/lib/supabase';
import { lookupCare } from '@/lib/plantCare';
import { scheduleWatering } from '@/lib/notifications';
import { Button, Input, s } from '@/components/ui';

export default function NewPlant() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [location, setLocation] = useState('');
  const [every, setEvery] = useState('7');
  const [sunlight, setSunlight] = useState('');
  const care = lookupCare(species);
  const save = async () => {
    if (!name.trim()) return Alert.alert('Name required');
    const { data, error } = await supabase.from('plants').insert({
      name: name.trim(), species: species || null, location: location || null,
      sunlight: sunlight || care?.sunlight || null,
      water_every_days: Math.max(1, Math.min(90, parseInt(every, 10) || care?.water_every_days || 7)),
      notes: care?.tips ?? null, last_watered_at: new Date().toISOString(),
    }).select().single();
    if (error) return Alert.alert('Could not save', error.message);
    await scheduleWatering(data as Plant);
    router.back();
  };
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Input placeholder="Nickname (e.g. Balcony Basil)" value={name} onChangeText={setName} />
      <Input placeholder="Species (e.g. basil, tomato, pothos)" value={species} onChangeText={setSpecies} />
      {care && (
        <Text style={s.muted} onPress={() => { setEvery(String(care.water_every_days)); setSunlight(care.sunlight); }}>
          Care guide: {care.sunlight}, water every {care.water_every_days} days. {care.tips} (tap to apply)
        </Text>
      )}
      <Input placeholder="Location (e.g. south window)" value={location} onChangeText={setLocation} />
      <Input placeholder="Sunlight" value={sunlight} onChangeText={setSunlight} />
      <Input placeholder="Water every N days" keyboardType="number-pad" value={every} onChangeText={setEvery} />
      <Button title="Save plant & set reminder" onPress={save} />
    </ScrollView>
  );
}
