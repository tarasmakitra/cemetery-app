import type { GraveType } from '@/db/types';

interface LatLng {
  latitude: number;
  longitude: number;
}

const GRAVE_DIMENSIONS: Record<GraveType, { width: number; height: number }> = {
  REGULAR: { width: 1.2, height: 2.4 },
  SMALL: { width: 0.8, height: 1.6 },
  DOUBLE: { width: 2.4, height: 2.4 },
  TRIPLE: { width: 3.6, height: 2.4 },
  TREE: { width: 1.0, height: 1.0 },
  OTHER: { width: 1.0, height: 1.0 },
};

const METERS_PER_DEGREE_LAT = 111320;

function metersPerDegreeLon(lat: number): number {
  return 111320 * Math.cos((lat * Math.PI) / 180);
}

const CIRCLE_TYPES: GraveType[] = ['TREE', 'OTHER'];
const CIRCLE_SEGMENTS = 16;

/**
 * Compute grave polygon vertices.
 * lat/lng is the BASE (bottom center / foot) of the grave.
 * For rectangular graves: extends upward (toward head) from that point.
 *   Vertices order: [bottom-left, bottom-right, top-right, top-left]
 *   Head edge = [3] → [2] (top side).
 * For circular graves (TREE, OTHER): circle centered on the point.
 */
export function computeGravePolygon(
  lat: number,
  lng: number,
  type: GraveType,
  rotationDeg: number = 0
): LatLng[] {
  const dim = GRAVE_DIMENSIONS[type] ?? GRAVE_DIMENSIONS.REGULAR;
  const mPerDegLon = metersPerDegreeLon(lat);

  if (CIRCLE_TYPES.includes(type)) {
    const radius = dim.width / 2;
    const points: LatLng[] = [];
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      const angle = (2 * Math.PI * i) / CIRCLE_SEGMENTS;
      const dx = radius * Math.cos(angle);
      const dy = radius * Math.sin(angle);
      points.push({
        latitude: lat + dy / METERS_PER_DEGREE_LAT,
        longitude: lng + dx / mPerDegLon,
      });
    }
    return points;
  }

  const halfW = dim.width / 2;
  const height = dim.height;

  // Base at (0,0), grave extends upward to (0, height)
  const corners = [
    { x: -halfW, y: 0 },       // bottom-left
    { x: halfW, y: 0 },        // bottom-right
    { x: halfW, y: height },   // top-right (head)
    { x: -halfW, y: height },  // top-left (head)
  ];

  const rad = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  return corners.map(({ x, y }) => {
    const rx = x * cosR - y * sinR;
    const ry = x * sinR + y * cosR;

    return {
      latitude: lat + ry / METERS_PER_DEGREE_LAT,
      longitude: lng + rx / mPerDegLon,
    };
  });
}

export function isCircleType(type: GraveType): boolean {
  return CIRCLE_TYPES.includes(type);
}
