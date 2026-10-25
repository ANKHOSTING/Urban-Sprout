import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatPrice, photoUrl, supabase, type Listing } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, Card, Input, s } from '@/components/ui';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const [item, setItem] = useState<Listing | null>(null);
  const [seller, setSeller] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('listings').select('*').eq('id', id).single();
      setItem(data as Listing);
      if (data) {
        const { data: p } = await supabase.from('profiles').select('display_name').eq('id', data.user_id).single();
        setSeller(p?.display_name ?? 'Gardener');
      }
    })();
  }, [id]);
  if (!item) return null;
  const mine = item.user_id === session?.user.id;
  const url = photoUrl(item.photo_path);

  const report = async () => {
    const { error } = await supabase.from('reports').insert({
      listing_id: item.id, reported_user_id: item.user_id, reason: reason.trim() || 'Inappropriate',
    });
    if (error) return Alert.alert('Error', error.message);
    Alert.alert('Reported', 'Thanks. Our team will review this listing within 24 hours.');
    setReason('');
  };
  const block = () => Alert.alert(`Block ${seller}?`, "You won't see each other's listings.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Block', style: 'destructive', onPress: async () => {
      await supabase.from('blocks').insert({ blocked_id: item.user_id }); router.back();
    } },
  ]);
  const remove = async () => {
    if (item.photo_path) await supabase.storage.from('photos').remove([item.photo_path]);
    await supabase.from('listings').delete().eq('id', item.id); router.back();
  };
  return (
    <ScrollView contentContainerStyle={s.pad}>
      {url && <Image source={{ uri: url }} style={{ width: '100%', height: 260, borderRadius: 10 }} />}
      <Card>
        <Text style={s.h1}>{item.title}</Text>
        <Text style={{ color: '#2E7D32', fontWeight: '700' }}>{formatPrice(item)}</Text>
        {!!item.location && <Text>📍 {item.location}</Text>}
        <Text style={s.muted}>Posted by {seller} · {new Date(item.created_at).toLocaleDateString()}</Text>
        {!!item.description && <Text>{item.description}</Text>}
      </Card>
      {mine ? (
        <Button title="Delete my listing" variant="danger" onPress={remove} />
      ) : (
        <>
          <Input placeholder="Reason for report (optional)" value={reason} onChangeText={setReason} />
          <Button title="Report listing" variant="secondary" onPress={report} />
          <Button title={`Block ${seller}`} variant="danger" onPress={block} />
        </>
      )}
    </ScrollView>
  );
}
