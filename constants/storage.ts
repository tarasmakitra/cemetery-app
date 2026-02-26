import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImageProcessingMode } from '@/db/types';

export const STORAGE_KEYS = {
  SERVER_URL: 'cemetery_server_url',
  AUTH_TOKEN: 'cemetery_auth_token',
  LAST_SYNC: 'cemetery_last_sync',
  IMAGE_MODE: 'cemetery_image_mode',
};

export async function getImageProcessingMode(): Promise<ImageProcessingMode> {
  const value = await AsyncStorage.getItem(STORAGE_KEYS.IMAGE_MODE);
  if (value === 'store_only' || value === 'store_and_send') return value;
  return 'store_and_send';
}
