import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Alert } from './alert';

async function shrink(uri) {
  const width = Platform.OS === 'web' ? 900 : 1280;
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: Platform.OS === 'web' ? 0.5 : 0.65, format: SaveFormat.JPEG, base64: Platform.OS === 'web' });
  if (Platform.OS === 'web') return `data:image/jpeg;base64,${out.base64}`;
  const { File, Directory, Paths } = require('expo-file-system');
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `p-${Date.now()}.jpg`);
  await new File(out.uri).copy(dest);
  return dest.uri;
}

async function pick(fromCamera) {
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera not allowed', 'Allow camera access for Sinop in your phone settings.');
      return null;
    }
  }
  const opts = { mediaTypes: ['images'], quality: 0.8, allowsEditing: false };
  const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  return shrink(res.assets[0].uri);
}

export function choosePhoto() {
  if (Platform.OS === 'web') return pick(false);
  return new Promise((resolve) => {
    Alert.alert('Add a photo 📸', 'Receipt, GCash screenshot, proof of payment…', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      { text: 'Gallery', onPress: () => pick(false).then(resolve).catch(() => resolve(null)) },
      { text: 'Camera', onPress: () => pick(true).then(resolve).catch(() => resolve(null)) },
    ]);
  });
}

export function deletePhotoFile(uri) {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try {
    const { File } = require('expo-file-system');
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
  }
}
