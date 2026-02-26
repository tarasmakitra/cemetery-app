import { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';

import { getAllGraves, searchGraves } from '@/db/graves';
import { SyncStatusBadge } from '@/components/SyncStatusBadge';
import { FAB } from '@/components/FAB';
import { AppColors } from '@/constants/theme';
import type { GraveListItem } from '@/db/types';

const TYPE_LABELS: Record<string, string> = {
  REGULAR: 'Звичайна',
  SMALL: 'Мала',
  DOUBLE: 'Подвійна',
  TRIPLE: 'Потрійна',
  TREE: 'Дерево',
  OTHER: 'Інше',
};

export default function GravesListScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [graves, setGraves] = useState<GraveListItem[]>([]);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const data = query.trim()
      ? await searchGraves(db, query.trim())
      : await getAllGraves(db);
    setGraves(data);
  }, [db, query]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const renderItem = useCallback(({ item }: { item: GraveListItem }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/grave/${item.local_id}` as any)}
    >
      {item.first_photo_uri && (
        <Image source={{ uri: item.first_photo_uri }} style={styles.rowThumb} />
      )}
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>
          {item.persons_summary || (TYPE_LABELS[item.type] ?? item.type)}
        </Text>
        <Text style={styles.rowType}>{TYPE_LABELS[item.type] ?? item.type}</Text>
        <Text style={styles.rowCoords}>
          {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
        </Text>
      </View>
      <SyncStatusBadge status={item.sync_status} />
    </TouchableOpacity>
  ), [router]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
        }}
        onSubmitEditing={loadData}
        placeholder="Пошук могил..."
        placeholderTextColor={AppColors.placeholder}
        returnKeyType="search"
      />

      <FlatList
        data={graves}
        keyExtractor={(item) => item.local_id}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {query ? 'Нічого не знайдено' : 'Немає могил. Додайте першу!'}
          </Text>
        }
      />

      <FAB
        icon="add"
        onPress={() => router.push('/grave/new' as any)}
        style={styles.fab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  search: {
    margin: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
    borderRadius: 10,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 80,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
  },
  rowThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#e0e0e0',
  },
  rowMain: {
    flex: 1,
    marginRight: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowType: {
    fontSize: 13,
    color: '#666',
  },
  rowCoords: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
    fontSize: 15,
  },
  fab: {
    bottom: 24,
    right: 16,
  },
});
