import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { normalizeBase, type Connection } from './api';
const KEY = 'octoshelf.connection.v1';
export async function readConnection(): Promise<Connection | null> {
  if (Platform.OS === 'web') return null;
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as Connection;
  if (typeof value.base !== 'string' || typeof value.token !== 'string') return null;
  return { base: normalizeBase(value.base), token: value.token };
}
export async function saveConnection(value: Connection): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(KEY, JSON.stringify(value));
}
export async function deleteConnection(): Promise<void> {
  if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY);
}
