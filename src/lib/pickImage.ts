import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export async function pickImage(fromCamera = false): Promise<string | null> {
  const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: true };
  const r = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  return r.canceled ? null : r.assets[0].uri;
}

/** Takes or picks a photo and returns it shrunk to a small JPEG (base64) for AI upload, or null if cancelled/denied. */
export async function pickPhotoForAI(fromCamera: boolean, maxSide = 768): Promise<string | null> {
  const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(fromCamera ? 'Camera permission is needed to photograph your plant.' : 'Photo access is needed to pick a picture.');
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: true };
  const r = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const { uri, width, height } = r.assets[0];
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > maxSide) ctx.resize(width >= height ? { width: maxSide } : { height: maxSide });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  return out.base64 ?? null;
}
