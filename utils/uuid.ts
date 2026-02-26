import uuid from 'react-native-uuid';

export function generateUUID(): string {
  return uuid.v4() as string;
}
