import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppColors } from '@/constants/theme';

// ~20cm in degrees (matching snap grid size)
const LAT_STEP = 0.0000018;
const LNG_STEP = 0.0000028;

interface NudgeControlsProps {
  onNudge: (dlat: number, dlng: number) => void;
}

export function NudgeControls({ onNudge }: NudgeControlsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => onNudge(LAT_STEP, 0)}>
          <MaterialIcons name="arrow-upward" size={22} color="#fff" />
          <Text style={styles.label}>Пн</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => onNudge(0, -LNG_STEP)}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
          <Text style={styles.label}>Зх</Text>
        </TouchableOpacity>
        <View style={styles.spacer} />
        <TouchableOpacity style={styles.btn} onPress={() => onNudge(0, LNG_STEP)}>
          <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          <Text style={styles.label}>Сх</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => onNudge(-LAT_STEP, 0)}>
          <MaterialIcons name="arrow-downward" size={22} color="#fff" />
          <Text style={styles.label}>Пд</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.fab.background,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 3,
  },
  label: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    marginTop: -2,
  },
  spacer: {
    width: 48,
    height: 48,
    margin: 3,
  },
});
