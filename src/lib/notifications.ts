import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Plant } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
  }),
});

const key = (plantId: string) => `reminder:${plantId}`;

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('watering', {
      name: 'Watering reminders', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  return (await Notifications.requestPermissionsAsync()).status === 'granted';
}

/** Schedule a repeating local reminder every N days at 9am-ish (from now). */
export async function scheduleWatering(plant: Plant): Promise<void> {
  await cancelWatering(plant.id);
  if (!(await ensurePermission())) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: `Time to water ${plant.name} 💧`, body: plant.location ? `In: ${plant.location}` : 'Your plant is thirsty.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: plant.water_every_days * 24 * 60 * 60,
      repeats: true,
      channelId: 'watering',
    },
  });
  await AsyncStorage.setItem(key(plant.id), id);
}

export async function cancelWatering(plantId: string): Promise<void> {
  const id = await AsyncStorage.getItem(key(plantId));
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await AsyncStorage.removeItem(key(plantId));
}

export async function hasReminder(plantId: string) {
  return !!(await AsyncStorage.getItem(key(plantId)));
}
