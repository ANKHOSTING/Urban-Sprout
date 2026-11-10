import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, type Plant } from '@/lib/supabase';
import { lookupCare } from '@/lib/plantCare';
import { scheduleWatering } from '@/lib/notifications';
import { identifyPlant } from '@/lib/ai';
import { pickPhotoForAI } from '@/lib/pickImage';
import { Button, Input, s } from '@/components/ui';

export default function NewPlant() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [location, setLocation] = useState('');
  const [every, setEvery] = useState('7');
  const [sunlight, setSunlight] = useState('');
  const [notes, setNotes] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const care = lookupCare(species);
  const identify = async (fromCamera: boolean) => {
    if (identifying) return;
    setIdentifying(true);
    try {
      const photo = await pickPhotoForAI(fromCamera);
      if (!photo) return;
      const r = await identifyPlant(photo);
      if (!r.ok) return Alert.alert('Could not identify plant', r.message);
      const p = r.plant;
      if (!p.name && !p.species) return Alert.alert('No plant found', 'Try a clearer, closer photo of the leaves.');
      if (p.name) setName(p.name);
      if (p.species) setSpecies(p.species);
      if (p.location) setLocation(p.location);
      if (p.sunlight) setSunlight(p.sunlight);
      if (p.water_every_days) setEvery(String(p.water_every_days));
      if (p.tips) setNotes(p.tips);
      if (p.confidence === 'low') Alert.alert('Not sure about this one', 'The AI is not confident. Please check the details before saving.');
    } catch (e: any) {
      Alert.alert('Photo problem', e?.message ?? String(e));
    } finally {
      setIdentifying(false);
    }
  };
  const save = async () => {
    if (!name.trim()) return Alert.alert('Name required');
    const { data, error } = await supabase.from('plants').insert({
      name: name.trim(), species: species || null, location: location || null,
      sunlight: sunlight || care?.sunlight || null,
      water_every_days: Math.max(1, Math.min(90, parseInt(every, 10) || care?.water_every_days || 7)),
      notes: notes.trim() || care?.tips || null, last_watered_at: new Date().toISOString(),
    }).select().single();
    if (error) return Alert.alert('Could not save', error.message);
    await scheduleWatering(data as Plant);
    router.back();
  };
  return (
    <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.muted}>Not sure what it is? Snap a photo and AI fills in the details.</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}><Button title="📷 Take photo" onPress={() => identify(true)} disabled={identifying} /></View>
        <View style={{ flex: 1 }}><Button title="🖼️ From gallery" variant="secondary" onPress={() => identify(false)} disabled={identifying} /></View>
      </View>
      {identifying && <View style={s.row}><ActivityIndicator /><Text style={s.muted}>Identifying your plant…</Text></View>}
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
      <Input placeholder="Care notes" value={notes} onChangeText={setNotes} multiline />
      <Button title="Save plant & set reminder" onPress={save} disabled={identifying} />
    </ScrollView>
  );
}
