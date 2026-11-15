import React, { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import type { TerrainGridData, TimelineStep } from '../../types/mission';
import type { ActiveToolId, MeasurePoint3D } from '../../types/workbench';
import {
  buildDrapedCircle3D,
  buildDrapedSegment3D,
  computePolygonAreaKm2,
  computePolylineDistanceKm,
  getSceneSurfaceY,
  lunarGeodesicDistanceKm,
} from '../../utils/selenographicGeodesy';

interface MeasurementOverlay3DProps {
  terrainGrid: TerrainGridData;
  verticalExaggeration: number;
  activeTool: ActiveToolId;
  points: MeasurePoint3D[];
  currentStep: TimelineStep;
  profileHoverT: number | null;
}

export const MeasurementOverlay3D: React.FC<MeasurementOverlay3DProps> = ({
  terrainGrid,
  verticalExaggeration,
  activeTool,
  points,
  currentStep,
  profileHoverT,
}) => {
  const drapedLines = useMemo(() => {
    if (points.length < 2) return [];

    if (activeTool === 'circle') {
      const center = points[0];
      const edge = points[1];
      const radiusLine = buildDrapedSegment3D(terrainGrid, verticalExaggeration, center, edge, 24);
      const circleLoop = buildDrapedCircle3D(terrainGrid, verticalExaggeration, center, edge, 72);
      return [radiusLine, circleLoop];
    }

    const segments: [number, number, number][][] = [];
    const limit = activeTool === 'profile' ? Math.min(2, points.length) : points.length;
    for (let i = 1; i < limit; i++) {
      segments.push(
        buildDrapedSegment3D(terrainGrid, verticalExaggeration, points[i - 1], points[i], 32)
      );
    }

    if (activeTool === 'area' && points.length >= 3) {
      segments.push(
        buildDrapedSegment3D(
          terrainGrid,
          verticalExaggeration,
          points[points.length - 1],
          points[0],
          32
        )
      );
    }

    return segments;
  }, [terrainGrid, verticalExaggeration, activeTool, points]);

  const pinPositions = useMemo(() => {
    return points.map((p) => ({
      point: p,
      pos: [
        p.sceneX,
        getSceneSurfaceY(terrainGrid, verticalExaggeration, p.sceneX, p.sceneZ, 0.08),
        p.sceneZ,
      ] as [number, number, number],
    }));
  }, [points, terrainGrid, verticalExaggeration]);

  const hoverMarkerPos = useMemo(() => {
    if (activeTool !== 'profile' || points.length < 2 || profileHoverT === null) return null;
    const a = points[0];
    const b = points[1];
    const x = a.sceneX + (b.sceneX - a.sceneX) * profileHoverT;
    const z = a.sceneZ + (b.sceneZ - a.sceneZ) * profileHoverT;
    const y = getSceneSurfaceY(terrainGrid, verticalExaggeration, x, z, 0.11);
    return [x, y, z] as [number, number, number];
  }, [activeTool, points, profileHoverT, terrainGrid, verticalExaggeration]);

  if (points.length === 0) return null;

  const lastPin = pinPositions[pinPositions.length - 1];
  const polyDist = computePolylineDistanceKm(points);
  const polyArea = computePolygonAreaKm2(points, terrainGrid.patch_size_km);
  const circleRadiusKm =
    activeTool === 'circle' && points.length >= 2
      ? lunarGeodesicDistanceKm(points[0], points[1])
      : 0;

  return (
    <group>
      {/* Draped Terrain Polylines */}
      {drapedLines.map((pts, idx) =>
        pts.length >= 2 ? (
          <Line
            key={`measure_line_${idx}`}
            points={pts}
            color={activeTool === 'profile' ? '#F59E0B' : '#38BDF8'}
            lineWidth={2.2}
          />
        ) : null
      )}

      {/* Vertex Pins */}
      {pinPositions.map(({ point, pos }, idx) => {
        const label =
          activeTool === 'profile'
            ? idx === 0
              ? 'A'
              : 'B'
            : activeTool === 'circle'
            ? idx === 0
              ? 'O'
              : 'R'
            : String(idx + 1);

        return (
          <group key={point.id} position={pos}>
            <mesh>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial
                color={activeTool === 'profile' ? '#F59E0B' : '#38BDF8'}
                emissive={activeTool === 'profile' ? '#D97706' : '#0284C7'}
                emissiveIntensity={0.85}
              />
            </mesh>
            <Html position={[0, 0.28, 0]} center distanceFactor={18}>
              <span className="px-1.5 py-0.5 rounded bg-[#05070b]/90 text-amber-300 border border-amber-400/50 text-[9px] font-mono font-bold pointer-events-none">
                {label}
              </span>
            </Html>
          </group>
        );
      })}

      {/* Synchronized Profile Hover Beacon */}
      {hoverMarkerPos && (
        <mesh position={hoverMarkerPos}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial
            color="#34D399"
            emissive="#10B981"
            emissiveIntensity={1.2}
          />
        </mesh>
      )}

      {/* Floating 3D Summary Callout on Active Endpoint */}
      {lastPin && (
        <Html position={[lastPin.pos[0], lastPin.pos[1] + 0.58, lastPin.pos[2]]} center>
          <div className="hud-panel rounded px-2.5 py-1.5 text-[10px] font-mono text-slate-100 whitespace-nowrap pointer-events-none shadow-lg border-sky-400/50">
            {activeTool === 'point_inspect' && (
              <div className="space-y-0.5">
                <div className="text-sky-300 font-semibold">
                  {lastPin.point.latDeg.toFixed(3)}°, {lastPin.point.lonDeg.toFixed(2)}°E
                </div>
                <div>
                  Elev: <strong>{lastPin.point.elevM.toFixed(1)} m</strong> • Slope:{' '}
                  <strong
                    className={
                      lastPin.point.slopeDeg < 5 ? 'text-emerald-400' : 'text-amber-300'
                    }
                  >
                    {lastPin.point.slopeDeg.toFixed(1)}°
                  </strong>
                </div>
                <div className="text-[9px] text-slate-400">
                  Sun {currentStep.sun_visible ? 'LIT' : 'SHADOW'} • Earth{' '}
                  {currentStep.earth_visible ? 'DTE' : 'LOS BLOCKED'}
                </div>
              </div>
            )}

            {activeTool === 'distance' && (
              <div>
                <span className="text-slate-400">Geodesic Dist: </span>
                <strong className="text-sky-300">{polyDist.totalKm.toFixed(3)} km</strong>
              </div>
            )}

            {activeTool === 'area' && (
              <div>
                <span className="text-slate-400">Area: </span>
                <strong className="text-sky-300">{polyArea.areaKm2.toFixed(3)} km²</strong>
                <span className="text-slate-400"> ({polyArea.perimeterKm.toFixed(2)} km perim)</span>
              </div>
            )}

            {activeTool === 'circle' && (
              <div>
                <span className="text-slate-400">Radius: </span>
                <strong className="text-sky-300">{circleRadiusKm.toFixed(3)} km</strong>
                {points.length >= 2 && (
                  <span className="text-slate-400">
                    {' '}
                    ({(Math.PI * circleRadiusKm * circleRadiusKm).toFixed(2)} km²)
                  </span>
                )}
              </div>
            )}

            {activeTool === 'profile' && points.length >= 2 && (
              <div>
                <span className="text-amber-300 font-semibold">Transect A→B: </span>
                <strong>{lunarGeodesicDistanceKm(points[0], points[1]).toFixed(3)} km</strong>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};