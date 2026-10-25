import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/components/ui';

const icon = (e: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{e}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.green, headerTintColor: colors.text }}>
      <Tabs.Screen name="index" options={{ title: 'My Plants', tabBarIcon: icon('🪴') }} />
      <Tabs.Screen name="advice" options={{ title: 'Ask AI', tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: icon('📓') }} />
      <Tabs.Screen name="market" options={{ title: 'Market', tabBarIcon: icon('🧺') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
