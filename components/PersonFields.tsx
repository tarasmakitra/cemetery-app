import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Pressable } from 'react-native';
import { Control, Controller, useFieldArray } from 'react-hook-form';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AppColors, MONTHS } from '@/constants/theme';
import { generateUUID } from '@/utils/uuid';
import type { GraveFormData } from '@/db/schemas';

function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);
  const selected = MONTHS.find((m) => m.value === value);

  return (
    <>
      <TouchableOpacity
        style={[styles.input, styles.dateInput, styles.monthPicker]}
        onPress={() => setVisible(true)}
      >
        <Text style={value ? styles.monthText : styles.monthPlaceholder}>
          {selected?.label || 'Місяць'}
        </Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <ScrollView>
              {MONTHS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.monthOption, m.value === value && styles.monthOptionActive]}
                  onPress={() => {
                    onChange(m.value);
                    setVisible(false);
                  }}
                >
                  <Text style={[styles.monthOptionText, m.value === value && styles.monthOptionTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

interface PersonFieldsProps {
  control: Control<GraveFormData>;
}

export function PersonFields({ control }: PersonFieldsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'persons',
  });

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Поховані</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() =>
            append({
              local_id: generateUUID(),
              name: '',
              birth_day: '',
              birth_month: '',
              birth_year: '',
              death_day: '',
              death_month: '',
              death_year: '',
              notes: '',
            })
          }
        >
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Додати</Text>
        </TouchableOpacity>
      </View>

      {fields.map((field, index) => (
        <View key={field.id} style={styles.personCard}>
          <View style={styles.personHeader}>
            <Text style={styles.personIndex}>Особа {index + 1}</Text>
            <TouchableOpacity onPress={() => remove(index)}>
              <MaterialIcons name="close" size={22} color={AppColors.danger} />
            </TouchableOpacity>
          </View>

          <Controller
            control={control}
            name={`persons.${index}.name`}
            render={({ field: f }) => (
              <TextInput
                style={styles.input}
                value={f.value}
                onChangeText={f.onChange}
                placeholder="Ім'я"
                placeholderTextColor={AppColors.placeholder}
              />
            )}
          />

          <Text style={styles.dateLabel}>Дата народження</Text>
          <View style={styles.dateRow}>
            <Controller
              control={control}
              name={`persons.${index}.birth_day`}
              render={({ field: f }) => (
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  value={f.value}
                  onChangeText={f.onChange}
                  placeholder="День"
                  placeholderTextColor={AppColors.placeholder}
                  keyboardType="numeric"
                  maxLength={2}
                />
              )}
            />
            <Controller
              control={control}
              name={`persons.${index}.birth_month`}
              render={({ field: f }) => (
                <MonthPicker value={f.value} onChange={f.onChange} />
              )}
            />
            <Controller
              control={control}
              name={`persons.${index}.birth_year`}
              render={({ field: f }) => (
                <TextInput
                  style={[styles.input, styles.yearInput]}
                  value={f.value}
                  onChangeText={f.onChange}
                  placeholder="Рік"
                  placeholderTextColor={AppColors.placeholder}
                  keyboardType="numeric"
                  maxLength={4}
                />
              )}
            />
          </View>

          <Text style={styles.dateLabel}>Дата смерті</Text>
          <View style={styles.dateRow}>
            <Controller
              control={control}
              name={`persons.${index}.death_day`}
              render={({ field: f }) => (
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  value={f.value}
                  onChangeText={f.onChange}
                  placeholder="День"
                  placeholderTextColor={AppColors.placeholder}
                  keyboardType="numeric"
                  maxLength={2}
                />
              )}
            />
            <Controller
              control={control}
              name={`persons.${index}.death_month`}
              render={({ field: f }) => (
                <MonthPicker value={f.value} onChange={f.onChange} />
              )}
            />
            <Controller
              control={control}
              name={`persons.${index}.death_year`}
              render={({ field: f }) => (
                <TextInput
                  style={[styles.input, styles.yearInput]}
                  value={f.value}
                  onChangeText={f.onChange}
                  placeholder="Рік"
                  placeholderTextColor={AppColors.placeholder}
                  keyboardType="numeric"
                  maxLength={4}
                />
              )}
            />
          </View>

          <Controller
            control={control}
            name={`persons.${index}.notes`}
            render={({ field: f }) => (
              <TextInput
                style={[styles.input, styles.multiline]}
                value={f.value}
                onChangeText={f.onChange}
                placeholder="Нотатки"
                placeholderTextColor={AppColors.placeholder}
                multiline
              />
            )}
          />
        </View>
      ))}

      {fields.length === 0 && (
        <Text style={styles.emptyText}>Немає похованих. Натисніть &#34;Додати&#34;.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.fab.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  personCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  personHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  personIndex: {
    fontSize: 14,
    fontWeight: '700',
    color: '#555',
  },
  dateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  dateInput: {
    flex: 1,
  },
  yearInput: {
    flex: 1.5,
  },
  input: {
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  multiline: {
    minHeight: 50,
    textAlignVertical: 'top',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  monthPicker: {
    justifyContent: 'center',
  },
  monthText: {
    fontSize: 15,
    color: '#333',
  },
  monthPlaceholder: {
    fontSize: 15,
    color: AppColors.placeholder,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 250,
    maxHeight: 400,
    paddingVertical: 8,
  },
  monthOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  monthOptionActive: {
    backgroundColor: AppColors.fab.background,
  },
  monthOptionText: {
    fontSize: 16,
    color: '#333',
  },
  monthOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
