import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { askPlantAdvice, type ChatMessage } from '@/lib/ai';
import { usePro } from '@/lib/pro';
import { AdBanner } from '@/components/AdBanner';
import { Button, Input, s, colors } from '@/components/ui';

export default function Advice() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { pro } = usePro();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<string>('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  useEffect(() => { if (q) setInput(q); }, [q]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next); setInput(''); setBusy(true);
    const r = await askPlantAdvice(next);
    setBusy(false);
    if (r.ok) {
      setMessages([...next, { role: 'assistant', content: r.reply }]);
      setQuota(r.limit ? `${Math.max(0, r.limit - r.used)} free questions left today` : 'Unlimited with Sprout Pro');
    } else {
      setMessages([...next, { role: 'assistant', content: r.limitReached ? `${r.message} Upgrade to Sprout Pro for unlimited advice.` : `Error: ${r.message}` }]);
      if (r.limitReached) router.push('/pro');
    }
  };
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        contentContainerStyle={s.pad}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        ListHeaderComponent={<Text style={s.muted}>Ask anything about your plants: pests, yellow leaves, what to grow on a balcony…{pro ? '' : ' Free plan: 5 questions/day.'}</Text>}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%',
            backgroundColor: item.role === 'user' ? colors.green : '#fff', borderRadius: 12, padding: 10 }}>
            <Text style={{ color: item.role === 'user' ? '#fff' : colors.text }}>{item.content}</Text>
          </View>
        )}
      />
      {busy && <ActivityIndicator color={colors.green} />}
      {!!quota && <Text style={[s.muted, { textAlign: 'center' }]}>{quota}</Text>}
      <View style={[s.row, { padding: 12 }]}>
        <Input style={{ flex: 1 }} placeholder="Ask about your plants" value={input} onChangeText={setInput} onSubmitEditing={send} />
        <Button title="Send" onPress={send} disabled={busy} />
      </View>
      <AdBanner />
    </KeyboardAvoidingView>
  );
}
