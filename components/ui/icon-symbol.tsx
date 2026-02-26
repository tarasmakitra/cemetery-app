import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const MAPPING: Record<string, MaterialIconName> = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'map.fill': 'map',
  'map': 'map',
  'list.bullet': 'list',
  'list': 'list',
  'arrow.triangle.2.circlepath': 'sync',
  'sync': 'sync',
  'plus': 'add',
  'location.fill': 'my-location',
  'trash': 'delete',
  'pencil': 'edit',
  'camera': 'camera-alt',
  'photo': 'photo-library',
  'xmark': 'close',
  'checkmark': 'check',
  'magnifyingglass': 'search',
  'arrow.up.arrow.down': 'swap-vert',
  'person': 'person',
  'person.fill': 'person',
  'gear': 'settings',
  'arrow.clockwise': 'refresh',
  'exclamationmark.triangle': 'warning',
  'navigation': 'navigation',
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name] ?? 'help-outline'} style={style} />;
}
