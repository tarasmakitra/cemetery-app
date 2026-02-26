import { Polygon, Polyline } from 'react-native-maps';
import { computeGravePolygon, isCircleType } from '@/utils/polygon';
import { AppColors } from '@/constants/theme';
import type { LocalGrave, GraveType } from '@/db/types';

function getGraveColors(type: GraveType, selected: boolean, synced: boolean) {
  const base = selected
    ? AppColors.gravePolygonSelected
    : type === 'TREE'
      ? AppColors.gravePolygonTree
      : type === 'OTHER'
        ? AppColors.gravePolygonOther
        : AppColors.gravePolygon;

  if (!synced && !selected) {
    return { ...base, stroke: AppColors.danger, strokeWidth: 3 };
  }
  return base;
}

interface GravePolygonProps {
  grave: LocalGrave;
  selected?: boolean;
  onPress?: () => void;
}

export function GravePolygonComponent({ grave, selected = false, onPress }: GravePolygonProps) {
  const coordinates = computeGravePolygon(
    grave.latitude,
    grave.longitude,
    grave.type,
    grave.rotation
  );

  const synced = grave.sync_status === 'synced';
  const colors = getGraveColors(grave.type, selected, synced);
  const isCircle = isCircleType(grave.type);

  return (
    <>
      <Polygon
        coordinates={coordinates}
        fillColor={colors.fill}
        strokeColor={colors.stroke}
        strokeWidth={colors.strokeWidth}
        tappable
        onPress={onPress}
      />
      {!isCircle && (
        <Polyline
          coordinates={[coordinates[3], coordinates[2]]}
          strokeColor={AppColors.graveHead}
          strokeWidth={4}
        />
      )}
    </>
  );
}
