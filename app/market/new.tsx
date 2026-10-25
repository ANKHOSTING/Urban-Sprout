import React, { useState } from 'react';
import { Alert, Image, ScrollView, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, uploadPhoto } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { pickImage } from '@/lib/pickImage';
import { Button, Input, s } from '@/components/ui';

export default function NewListing() {
  const router = useRouter();
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [trade, setTrade] = useState(false);
  const [location, setLocation] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!title.trim() || !session) return Alert.alert('Title required');
    setBusy(true);
    try {
      const photo_path = uri ? await uploadPhoto(session.user.id, uri) : null;
      const cents = price ? Math.round(parseFloat(price) * 100) : null;
      const { error } = await supabase.from('listings').insert({
        title: title.trim(), description: description || null, is_trade: trade,
        price_cents: trade || cents == null || isNaN(cents) ? null : cents, location: location || null, photo_path,
      });
      if (error) throw error;
      router.back();
    } catch (e: any) { Alert.alert('Could not post', e.message); } finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Input placeholder="Title (e.g. Pothos cuttings)" value={title} onChangeText={setTitle} />
      <Input placeholder="Description" multiline style={{ minHeight: 90, textAlignVertical: 'top' }} value={description} onChangeText={setDescription} />
      <View style={s.row}><Switch value={trade} onValueChange={setTrade} /><Text>Trade / swap only</Text></View>
      {!trade && <Input placeholder="Price in USD (blank = free)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />}
      <Input placeholder="Neighborhood (no exact address)" value={location} onChangeText={setLocation} />
      {uri && <Image source={{ uri }} style={{ width: '100%', height: 200, borderRadius: 8 }} />}
      <Button title="Add photo" variant="secondary" onPress={async () => setUri(await pickImage(false))} />
      <Text style={s.muted}>Be kind and honest. Listings that break the community rules will be removed.</Text>
      <Button title="Post listing" onPress={save} disabled={busy} />
    </ScrollView>
  );
}
