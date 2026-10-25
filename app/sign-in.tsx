import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { Button, Input, s, colors } from '@/components/ui';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (mode: 'in' | 'up') => {
    setBusy(true);
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) Alert.alert('Sign in failed', error.message);
    else if (mode === 'up') Alert.alert('Check your email', 'Confirm your address if email confirmation is enabled, then sign in.');
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.screen, { justifyContent: 'center' }]}>
      <View style={s.pad}>
        <Text style={{ fontSize: 48, textAlign: 'center' }}>🌱</Text>
        <Text style={[s.h1, { textAlign: 'center' }]}>Urban Sprout</Text>
        <Text style={[s.muted, { textAlign: 'center' }]}>Grow more in small spaces.</Text>
        {!supabaseConfigured && (
          <Text style={{ color: colors.danger, textAlign: 'center' }}>
            Supabase is not configured. Copy .env.example to .env and add your project keys.
          </Text>
        )}
        <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button title="Sign in" onPress={() => go('in')} disabled={busy} />
        <Button title="Create account" variant="secondary" onPress={() => go('up')} disabled={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}
