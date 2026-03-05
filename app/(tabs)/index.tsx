import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { MapPressEvent, Polygon, Polyline } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useSQLiteContext } from 'expo-sqlite';
import * as Location from 'expo-location';

import { getAllGraves } from '@/db/graves';
import { GravePolygonComponent } from '@/components/GravePolygon';
import { QuickCreateSheet } from '@/components/QuickCreateSheet';
import { GraveDetailSheet } from '@/components/GraveDetailSheet';
import { FAB } from '@/components/FAB';
import { SyncStatusOverlay } from '@/components/SyncStatusOverlay';
import { computeGravePolygon, isCircleType } from '@/utils/polygon';
import { snapToGrid } from '@/utils/snap';
import { AppColors, DEFAULT_ROTATION } from '@/constants/theme';
import type { LocalGrave, GraveType } from '@/db/types';

const STOJANIV_CENTER = {
  latitude: 50.370998,
  longitude: 24.628260,
};

const INITIAL_CAMERA = {
  center: STOJANIV_CENTER,
  zoom: 18,
  heading: 0,
  pitch: 0,
};

export default function MapScreen() {
  const db = useSQLiteContext();
  const mapRef = useRef<MapView>(null);
  const quickCreateRef = useRef<BottomSheetModal>(null);
  const detailRef = useRef<BottomSheetModal>(null);

  const [graves, setGraves] = useState<LocalGrave[]>([]);
  const [tapCoords, setTapCoords] = useState({ latitude: 0, longitude: 0 });
  const [selectedGraveId, setSelectedGraveId] = useState<string | null>(null);

  // Preview state — lifted from QuickCreateSheet so map can render preview polygon
  const [showPreview, setShowPreview] = useState(false);
  const [previewType, setPreviewType] = useState<GraveType>('REGULAR');
  const [previewRotation, setPreviewRotation] = useState(DEFAULT_ROTATION);

  const loadGraves = useCallback(async () => {
    const data = await getAllGraves(db);
    setGraves(data);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadGraves();
    }, [loadGraves])
  );

  const handleMapPress = useCallback((e: MapPressEvent) => {
    const snapped = snapToGrid(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude);
    setTapCoords(snapped);
    setPreviewType('REGULAR');
    setPreviewRotation(DEFAULT_ROTATION);
    setShowPreview(true);
    quickCreateRef.current?.present();
  }, []);

  const handleGravePress = useCallback((grave: LocalGrave) => {
    setSelectedGraveId(grave.local_id);
    detailRef.current?.present();
  }, []);

  const handleAddAtMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setTapCoords(snapToGrid(loc.coords.latitude, loc.coords.longitude));
    setPreviewType('REGULAR');
    setPreviewRotation(DEFAULT_ROTATION);
    setShowPreview(true);
    quickCreateRef.current?.present();
  }, []);

  const handleGoToMyLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const location = await Location.getCurrentPositionAsync({});
    mapRef.current?.animateCamera({
      center: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      zoom: 20,
    }, { duration: 1000 });
  }, []);

  const handleSheetDismiss = useCallback(() => {
    setShowPreview(false);
  }, []);

  const handleCreated = useCallback(() => {
    setShowPreview(false);
    loadGraves();
  }, [loadGraves]);

  const handleCoordsFromGPS = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({});
    setTapCoords(snapToGrid(loc.coords.latitude, loc.coords.longitude));
    setPreviewRotation(DEFAULT_ROTATION);
  }, []);

  // Compute preview polygon coordinates
  const previewCoords = showPreview
    ? computeGravePolygon(tapCoords.latitude, tapCoords.longitude, previewType, previewRotation)
    : null;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        camera={INITIAL_CAMERA}
        mapType="satellite"
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {graves.map((grave) => (
          <GravePolygonComponent
            key={`${grave.local_id}-${grave.sync_status}`}
            grave={grave}
            selected={grave.local_id === selectedGraveId}
            onPress={() => handleGravePress(grave)}
          />
        ))}

        {/* Preview polygon for new grave placement */}
        {previewCoords && (
          <>
            <Polygon
              coordinates={previewCoords}
              fillColor={AppColors.gravePolygonPreview.fill}
              strokeColor={AppColors.gravePolygonPreview.stroke}
              strokeWidth={AppColors.gravePolygonPreview.strokeWidth}
            />
            {!isCircleType(previewType) && (
              <Polyline
                coordinates={[previewCoords[3], previewCoords[2]]}
                strokeColor={AppColors.graveHead}
                strokeWidth={4}
              />
            )}
          </>
        )}
      </MapView>

      <FAB
        icon="add"
        onPress={handleAddAtMyLocation}
        style={styles.addFab}
      />

      <FAB
        icon="my-location"
        onPress={handleGoToMyLocation}
        style={styles.locationFab}
      />

      <SyncStatusOverlay />

      <QuickCreateSheet
        bottomSheetRef={quickCreateRef}
        latitude={tapCoords.latitude}
        longitude={tapCoords.longitude}
        type={previewType}
        rotation={previewRotation}
        onTypeChange={setPreviewType}
        onRotationChange={setPreviewRotation}
        onCoordsFromGPS={handleCoordsFromGPS}
        onCoordsChange={(lat, lng) => { const s = snapToGrid(lat, lng); setTapCoords(s); }}
        onCreated={handleCreated}
        onDismiss={handleSheetDismiss}
      />

      <GraveDetailSheet
        bottomSheetRef={detailRef}
        graveLocalId={selectedGraveId}
        onDismiss={loadGraves}
        onCoordsChanged={loadGraves}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  addFab: {
    bottom: 92,
    right: 16,
  },
  locationFab: {
    bottom: 24,
    right: 16,
  },
});
