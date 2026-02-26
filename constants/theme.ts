import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const DEFAULT_ROTATION = 90;

export const AppColors = {
  gravePolygon: {
    fill: 'rgba(76, 175, 80, 0.35)',
    stroke: '#ffffff',
    strokeWidth: 2,
  },
  gravePolygonSelected: {
    fill: 'rgba(33, 150, 243, 0.45)',
    stroke: '#2196F3',
    strokeWidth: 3,
  },
  gravePolygonPreview: {
    fill: 'rgba(255, 152, 0, 0.4)',
    stroke: '#FF9800',
    strokeWidth: 2,
  },
  gravePolygonTree: {
    fill: 'rgba(76, 175, 80, 0.45)',
    stroke: '#4CAF50',
    strokeWidth: 2,
  },
  gravePolygonOther: {
    fill: 'rgba(33, 150, 243, 0.45)',
    stroke: '#2196F3',
    strokeWidth: 2,
  },
  graveHead: '#FFEB3B',
  syncStatus: {
    pending: '#FF9800',
    synced: '#4CAF50',
    error: '#F44336',
    modified: '#2196F3',
    deleted: '#9E9E9E',
  } as Record<string, string>,
  fab: {
    background: '#2196F3',
    foreground: '#ffffff',
  },
  danger: '#F44336',
  success: '#4CAF50',
  warning: '#FF9800',
  inputBorder: '#ccc',
  inputBorderFocus: '#2196F3',
  placeholder: '#999',
};

export const MONTHS = [
  { label: '—', value: '' },
  { label: 'Січень', value: '1' },
  { label: 'Лютий', value: '2' },
  { label: 'Березень', value: '3' },
  { label: 'Квітень', value: '4' },
  { label: 'Травень', value: '5' },
  { label: 'Червень', value: '6' },
  { label: 'Липень', value: '7' },
  { label: 'Серпень', value: '8' },
  { label: 'Вересень', value: '9' },
  { label: 'Жовтень', value: '10' },
  { label: 'Листопад', value: '11' },
  { label: 'Грудень', value: '12' },
];

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
