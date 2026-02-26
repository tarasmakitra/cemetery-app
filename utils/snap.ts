/**
 * Snap-to-grid utility.
 * Rounds coordinates to the nearest 20cm grid point.
 */

const GRID_SIZE_M = 0.20;
const METERS_PER_DEGREE_LAT = 111320;
// Fixed for Stojaniv area (~50.37°N)
const METERS_PER_DEGREE_LNG = 111320 * Math.cos((50.37 * Math.PI) / 180);

const LAT_STEP = GRID_SIZE_M / METERS_PER_DEGREE_LAT;
const LNG_STEP = GRID_SIZE_M / METERS_PER_DEGREE_LNG;

export function snapToGrid(lat: number, lng: number) {
  return {
    latitude: Math.round(lat / LAT_STEP) * LAT_STEP,
    longitude: Math.round(lng / LNG_STEP) * LNG_STEP,
  };
}
