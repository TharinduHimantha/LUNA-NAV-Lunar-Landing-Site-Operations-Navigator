import type { LunarSite, TerrainGridData } from '../types/mission';
import type { MeasurePoint3D, ProfileSamplePoint } from '../types/workbench';

export const R_MOON_KM = 1737.4;

/**
 * Sample bilinearly interpolated elevation (m) and local slope (deg) at scene coordinates (sceneX, sceneZ).
 * Scene X spans [-10..10] West->East; Scene Z spans [-10..10] North->South.
 */
export function sampleDemAtScene(
  terrainGrid: TerrainGridData,
  sceneX: number,
  sceneZ: number
): { elevM: number; slopeDeg: number } {
  const N = terrainGrid.grid_size;
  const u = Math.max(0, Math.min(1, (sceneX + 10.0) / 20.0));
  const vNorth = Math.max(0, Math.min(1, (-sceneZ + 10.0) / 20.0));

  const fx = u * (N - 1);
  const fy = vNorth * (N - 1);
  const c0 = Math.min(N - 1, Math.floor(fx));
  const r0 = Math.min(N - 1, Math.floor(fy));
  const c1 = Math.min(N - 1, c0 + 1);
  const r1 = Math.min(N - 1, r0 + 1);
  const tx = fx - c0;
  const ty = fy - r0;

  const baseZ = terrainGrid.lander_pos.z_m;
  const z00 = terrainGrid.elevations_m[r0]?.[c0] ?? baseZ;
  const z10 = terrainGrid.elevations_m[r0]?.[c1] ?? baseZ;
  const z01 = terrainGrid.elevations_m[r1]?.[c0] ?? baseZ;
  const z11 = terrainGrid.elevations_m[r1]?.[c1] ?? baseZ;

  const elevM =
    z00 * (1 - tx) * (1 - ty) +
    z10 * tx * (1 - ty) +
    z01 * (1 - tx) * ty +
    z11 * tx * ty;

  // Local gradient in meters per grid cell
  const cellSpanM = (terrainGrid.patch_size_km * 1000.0) / Math.max(1, N - 1);
  const cLeft = Math.max(0, c0 - 1);
  const cRight = Math.min(N - 1, c0 + 1);
  const rDown = Math.max(0, r0 - 1);
  const rUp = Math.min(N - 1, r0 + 1);

  const dzDx =
    ((terrainGrid.elevations_m[r0]?.[cRight] ?? elevM) -
      (terrainGrid.elevations_m[r0]?.[cLeft] ?? elevM)) /
    (Math.max(1, cRight - cLeft) * cellSpanM);
  const dzDy =
    ((terrainGrid.elevations_m[rUp]?.[c0] ?? elevM) -
      (terrainGrid.elevations_m[rDown]?.[c0] ?? elevM)) /
    (Math.max(1, rUp - rDown) * cellSpanM);

  const slopeDeg = (Math.atan(Math.hypot(dzDx, dzDy)) * 180.0) / Math.PI;
  return { elevM, slopeDeg };
}

/**
 * Convert scene coordinates (sceneX, sceneZ) to selenographic latitude/longitude (IAU Mean Earth).
 */
export function sceneToSelenographic(
  site: LunarSite,
  terrainGrid: TerrainGridData,
  sceneX: number,
  sceneZ: number
): MeasurePoint3D {
  const kmPerSceneUnit = terrainGrid.patch_size_km / 20.0;
  const dNorthKm = -sceneZ * kmPerSceneUnit;
  const dEastKm = sceneX * kmPerSceneUnit;

  const latDeg = site.lat_deg + (dNorthKm / R_MOON_KM) * (180.0 / Math.PI);
  const cosLat = Math.max(0.05, Math.cos((site.lat_deg * Math.PI) / 180.0));
  const lonDeg =
    (site.lon_deg + (dEastKm / (R_MOON_KM * cosLat)) * (180.0 / Math.PI) + 360.0) % 360.0;

  const { elevM, slopeDeg } = sampleDemAtScene(terrainGrid, sceneX, sceneZ);

  return {
    id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sceneX,
    sceneZ,
    latDeg,
    lonDeg,
    elevM,
    slopeDeg,
  };
}

/**
 * Compute exaggerated 3D scene Y height above the DEM surface for draped lines & pins.
 */
export function getSceneSurfaceY(
  terrainGrid: TerrainGridData,
  verticalExaggeration: number,
  sceneX: number,
  sceneZ: number,
  liftOffset = 0.06
): number {
  const { elevM } = sampleDemAtScene(terrainGrid, sceneX, sceneZ);
  return ((elevM - terrainGrid.lander_pos.z_m) / 1000.0) * verticalExaggeration + liftOffset;
}

/**
 * Spherical lunar Haversine geodesic distance (km) between two selenographic points.
 */
export function lunarGeodesicDistanceKm(a: MeasurePoint3D, b: MeasurePoint3D): number {
  const lat1 = (a.latDeg * Math.PI) / 180.0;
  const lat2 = (b.latDeg * Math.PI) / 180.0;
  const dLat = lat2 - lat1;
  const dLon = ((b.lonDeg - a.lonDeg) * Math.PI) / 180.0;

  const sinDLat = Math.sin(dLat * 0.5);
  const sinDLon = Math.sin(dLon * 0.5);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2.0 * R_MOON_KM * Math.asin(Math.min(1.0, Math.sqrt(h)));
}

/**
 * Compute total polyline geodesic length (km) and per-segment lengths.
 */
export function computePolylineDistanceKm(points: MeasurePoint3D[]): {
  totalKm: number;
  segmentsKm: number[];
} {
  const segmentsKm: number[] = [];
  let totalKm = 0;
  for (let i = 1; i < points.length; i++) {
    const d = lunarGeodesicDistanceKm(points[i - 1], points[i]);
    segmentsKm.push(d);
    totalKm += d;
  }
  return { totalKm, segmentsKm };
}

/**
 * Compute geodesic polygon area (km^2) and perimeter (km) using tangent-plane metric & spherical correction.
 */
export function computePolygonAreaKm2(
  points: MeasurePoint3D[],
  patchSizeKm: number
): { areaKm2: number; perimeterKm: number } {
  if (points.length < 3) {
    return { areaKm2: 0, perimeterKm: computePolylineDistanceKm(points).totalKm };
  }

  const kmPerScene = patchSizeKm / 20.0;
  let twiceArea = 0;
  let perimeterKm = 0;

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];
    const x1 = curr.sceneX * kmPerScene;
    const y1 = -curr.sceneZ * kmPerScene;
    const x2 = next.sceneX * kmPerScene;
    const y2 = -next.sceneZ * kmPerScene;
    twiceArea += x1 * y2 - x2 * y1;
    perimeterKm += lunarGeodesicDistanceKm(curr, next);
  }

  return { areaKm2: Math.abs(twiceArea) * 0.5, perimeterKm };
}

/**
 * Generate a DEM-draped 3D polyline between two scene points so lines conform tightly to craters/ridges.
 */
export function buildDrapedSegment3D(
  terrainGrid: TerrainGridData,
  verticalExaggeration: number,
  a: { sceneX: number; sceneZ: number },
  b: { sceneX: number; sceneZ: number },
  subdivisions = 32
): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= subdivisions; i++) {
    const t = i / subdivisions;
    const x = a.sceneX + (b.sceneX - a.sceneX) * t;
    const z = a.sceneZ + (b.sceneZ - a.sceneZ) * t;
    const y = getSceneSurfaceY(terrainGrid, verticalExaggeration, x, z, 0.065);
    pts.push([x, y, z]);
  }
  return pts;
}

/**
 * Generate a DEM-draped 3D circle centered at `center` passing through `edge`.
 */
export function buildDrapedCircle3D(
  terrainGrid: TerrainGridData,
  verticalExaggeration: number,
  center: MeasurePoint3D,
  edge: MeasurePoint3D,
  segments = 72
): [number, number, number][] {
  const rScene = Math.hypot(edge.sceneX - center.sceneX, edge.sceneZ - center.sceneZ);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2.0;
    const x = Math.max(-10, Math.min(10, center.sceneX + Math.cos(theta) * rScene));
    const z = Math.max(-10, Math.min(10, center.sceneZ + Math.sin(theta) * rScene));
    const y = getSceneSurfaceY(terrainGrid, verticalExaggeration, x, z, 0.065);
    pts.push([x, y, z]);
  }
  return pts;
}

/**
 * Sample a 64-point elevation & slope transect between endpoints A and B.
 */
export function sampleDemProfileTransect(
  site: LunarSite,
  terrainGrid: TerrainGridData,
  start: MeasurePoint3D,
  end: MeasurePoint3D,
  samples = 64
): ProfileSamplePoint[] {
  const totalDistKm = lunarGeodesicDistanceKm(start, end);
  const out: ProfileSamplePoint[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const sceneX = start.sceneX + (end.sceneX - start.sceneX) * t;
    const sceneZ = start.sceneZ + (end.sceneZ - start.sceneZ) * t;
    const pt = sceneToSelenographic(site, terrainGrid, sceneX, sceneZ);
    out.push({
      t,
      distanceKm: totalDistKm * t,
      sceneX,
      sceneZ,
      latDeg: pt.latDeg,
      lonDeg: pt.lonDeg,
      elevM: pt.elevM,
      slopeDeg: pt.slopeDeg,
    });
  }

  return out;
}