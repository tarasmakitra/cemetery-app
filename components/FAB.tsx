import { StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppColors } from '@/constants/theme';
import { ComponentProps } from 'react';

interface FABProps {
  icon: ComponentProps<typeof MaterialIcons>['name'];
  onPress: () => void;
  style?: ViewStyle;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export function FAB({
  icon,
  onPress,
  style,
  size = 24,
  color = AppColors.fab.foreground,
  backgroundColor = AppColors.fab.background,
}: FABProps) {
  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor }, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MaterialIcons name={icon} size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
});
