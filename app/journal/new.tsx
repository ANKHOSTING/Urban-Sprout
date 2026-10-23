import React, { useState } from 'react';
import { Alert, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase, uploadPhoto } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { pickImage } from '@/lib/pickImage';
import { Button, Input, s } from '@/components/ui';

export default function NewEntry() {
  const router = useRouter();
  const { session } = useAuth();
  const [body, setBody] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!body.trim() || !session) return Alert.alert('Write something first');
    setBusy(true);
    try {
      const photo_path = uri ? await uploadPhoto(session.user.id, uri) : null;
      const { error } = await supabase.from('journal_entries').insert({ body: body.trim(), photo_path });
      if (error) throw error;
      router.back();
    } catch (e: any) { Alert.alert('Could not save', e.message); } finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={s.pad}>
      <Input placeholder="What's growing on?" multiline style={{ minHeight: 120, textAlignVertical: 'top' }} value={body} onChangeText={setBody} />
      {uri && <Image source={{ uri }} style={{ width: '100%', height: 220, borderRadius: 8 }} />}
      <Button title="Take photo" variant="secondary" onPress={async () => setUri(await pickImage(true))} />
      <Button title="Choose from gallery" variant="secondary" onPress={async () => setUri(await pickImage(false))} />
      <Button title="Save entry" onPress={save} disabled={busy} />
    </ScrollView>
  );
}
