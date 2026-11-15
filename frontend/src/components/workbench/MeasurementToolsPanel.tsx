import React, { useMemo } from 'react';
import {
  MapPin,
  Ruler,
  Pentagon,
  CircleDot,
  Activity,
  Undo2,
  Trash2,
} from 'lucide-react';
import type { LunarSite, TerrainGridData, TimelineStep } from '../../types/mission';
import type { ActiveToolId, MeasurePoint3D } from '../../types/workbench';
import {
  computePolygonAreaKm2,
  computePolylineDistanceKm,
  lunarGeodesicDistanceKm,
  sampleDemProfileTransect,
} from '../../utils/selenographicGeodesy';

interface MeasurementToolsPanelProps {
  site: LunarSite;
  terrainGrid: TerrainGridData;
  currentStep: TimelineStep;
  activeTool: ActiveToolId;
  onSelectTool: (tool: ActiveToolId) => void;
  points: MeasurePoint3D[];
  onUndoPoint: () => void;
  onClearPoints: () => void;
  profileHoverT: number | null;
  onHoverProfileT: (t: number | null) => void;
}

export const MeasurementToolsPanel: React.FC<MeasurementToolsPanelProps> = ({
  site,
  terrainGrid,
  currentStep,
  activeTool,
  onSelectTool,
  points,
  onUndoPoint,
  onClearPoints,
  profileHoverT,
  onHoverProfileT,
}) => {
  const profileSamples = useMemo(() => {
    if (activeTool !== 'profile' || points.length < 2) return [];
    return sampleDemProfileTransect(site, terrainGrid, points[0], points[1], 64);
  }, [activeTool, points, site, terrainGrid]);

  const profileStats = useMemo(() => {
    if (profileSamples.length < 2) return null;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let maxSlope = 0;
    let gainM = 0;
    let lossM = 0;

    for (let i = 0; i < profileSamples.length; i++) {
      const s = profileSamples[i];
      if (s.elevM < minZ) minZ = s.elevM;
      if (s.elevM > maxZ) maxZ = s.elevM;
      if (s.slopeDeg > maxSlope) maxSlope = s.slopeDeg;
      if (i > 0) {
        const dz = s.elevM - profileSamples[i - 1].elevM;
        if (dz > 0) gainM += dz;
        else lossM += Math.abs(dz);
      }
    }

    const totalDistKm = profileSamples[profileSamples.length - 1].distanceKm;
    return { minZ, maxZ, maxSlope, gainM, lossM, totalDistKm };
  }, [profileSamples]);

  const hoveredSample = useMemo(() => {
    if (profileSamples.length === 0 || profileHoverT === null) return null;
    const idx = Math.min(
      profileSamples.length - 1,
      Math.max(0, Math.round(profileHoverT * (profileSamples.length - 1)))
    );
    return profileSamples[idx];
  }, [profileSamples, profileHoverT]);

  const polyDist = useMemo(() => computePolylineDistanceKm(points), [points]);
  const polyArea = useMemo(
    () => computePolygonAreaKm2(points, terrainGrid.patch_size_km),
    [points, terrainGrid.patch_size_km]
  );

  const circleRadiusKm =
    activeTool === 'circle' && points.length >= 2
      ? lunarGeodesicDistanceKm(points[0], points[1])
      : 0;

  const toolInstructions: Record<ActiveToolId, string> = {
    none: 'Select an analysis tool below, then click directly on the 3D lunar surface.',
    point_inspect:
      'Click any crater rim, floor, or ridge on the 3D terrain to inspect selenographic coordinates, elevation, slope, and visibility.',
    distance:
      'Click sequential waypoints on the 3D terrain to measure cumulative spherical geodesic rover/traverse distance (km).',
    area: 'Click 3 or more boundary vertices on the 3D terrain to enclose a landing zone or PSR polygon (km²).',
    circle:
      'Click a center point (O), then click a second point (R) to measure a concentric geodesic range ring.',
    profile:
      'Click Start Point (A) and End Point (B) on the 3D terrain to generate an elevation & slope cross-section.',
  };

  return (
    <div className="space-y-4">
      {/* Tool Selector Grid */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="section-kicker">Interactive Analysis Tool</span>
          {points.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onUndoPoint}
                title="Undo last point"
                className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1"
              >
                <Undo2 className="w-3 h-3" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                onClick={onClearPoints}
                title="Clear measurement"
                className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-rose-300 hover:border-rose-500/60 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {(
            [
              { id: 'point_inspect', label: 'Point Inspect', icon: MapPin },
              { id: 'distance', label: 'Distance (km)', icon: Ruler },
              { id: 'area', label: 'Polygon Area', icon: Pentagon },
              { id: 'circle', label: 'Geodesic Ring', icon: CircleDot },
              { id: 'profile', label: 'DEM Profile', icon: Activity },
            ] as const
          ).map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelectTool(active ? 'none' : tool.id)}
                className={`p-2 rounded border flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-sky-500/20 border-sky-400/60 text-sky-300 font-medium'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tool.label}</span>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-400 leading-snug pt-1">
          {toolInstructions[activeTool]}
        </p>
      </div>

      {/* Live Measurement Readout Card */}
      {activeTool !== 'none' && points.length > 0 && (
        <div className="p-3 rounded-md bg-slate-950/75 border border-sky-500/35 space-y-2 text-xs font-mono">
          <span className="section-kicker text-sky-400 block">Active Measurement Telemetry</span>

          {activeTool === 'point_inspect' && (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Coordinates:</span>
                <span className="text-slate-100 tabular-nums">
                  {points[0].latDeg.toFixed(4)}°, {points[0].lonDeg.toFixed(3)}°E
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">LOLA Elevation:</span>
                <span className="text-slate-100 tabular-nums">{points[0].elevM.toFixed(1)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Local Slope:</span>
                <span
                  className={
                    points[0].slopeDeg < 5.0
                      ? 'text-emerald-400 tabular-nums'
                      : 'text-amber-300 tabular-nums'
                  }
                >
                  {points[0].slopeDeg.toFixed(2)}°{' '}
                  {points[0].slopeDeg < 5.0 ? '(HLS SAFE)' : '(STEEP)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Epoch Illumination:</span>
                <span className="text-slate-100">
                  {currentStep.sun_visible ? 'Direct Sunlit' : 'Terrain Shadow'}
                </span>
              </div>
            </div>
          )}

          {activeTool === 'distance' && (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Waypoints:</span>
                <span className="text-slate-100 tabular-nums">{points.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Geodesic Path:</span>
                <span className="text-sky-300 font-semibold tabular-nums">
                  {polyDist.totalKm.toFixed(3)} km ({(polyDist.totalKm * 1000).toFixed(0)} m)
                </span>
              </div>
              {polyDist.segmentsKm.length > 0 && (
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                  Last leg: {polyDist.segmentsKm[polyDist.segmentsKm.length - 1].toFixed(3)} km
                </div>
              )}
            </div>
          )}

          {activeTool === 'area' && (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Vertices:</span>
                <span className="text-slate-100 tabular-nums">{points.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Enclosed Area:</span>
                <span className="text-sky-300 font-semibold tabular-nums">
                  {polyArea.areaKm2.toFixed(3)} km² ({(polyArea.areaKm2 * 100).toFixed(1)} ha)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Perimeter:</span>
                <span className="text-slate-100 tabular-nums">
                  {polyArea.perimeterKm.toFixed(3)} km
                </span>
              </div>
            </div>
          )}

          {activeTool === 'circle' && (
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Center (O):</span>
                <span className="text-slate-100 tabular-nums">
                  {points[0].latDeg.toFixed(3)}°, {points[0].lonDeg.toFixed(2)}°E
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Geodesic Radius:</span>
                <span className="text-sky-300 font-semibold tabular-nums">
                  {circleRadiusKm.toFixed(3)} km
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Circle Area:</span>
                <span className="text-slate-100 tabular-nums">
                  {(Math.PI * circleRadiusKm * circleRadiusKm).toFixed(3)} km²
                </span>
              </div>
            </div>
          )}

          {/* Interactive SVG DEM Elevation & Slope Cross-Section Chart */}
          {activeTool === 'profile' && profileStats && profileSamples.length >= 2 && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5 text-[10px] bg-slate-900/90 p-2 rounded border border-slate-800">
                <div>
                  <span className="text-slate-400 block">Dist</span>
                  <strong className="text-amber-300 tabular-nums">
                    {profileStats.totalDistKm.toFixed(2)} km
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Gain / Loss</span>
                  <strong className="text-slate-100 tabular-nums">
                    +{profileStats.gainM.toFixed(0)} / -{profileStats.lossM.toFixed(0)}m
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Max Slope</span>
                  <strong
                    className={
                      profileStats.maxSlope < 5
                        ? 'text-emerald-400 tabular-nums'
                        : 'text-rose-300 tabular-nums'
                    }
                  >
                    {profileStats.maxSlope.toFixed(1)}°
                  </strong>
                </div>
              </div>

              <div className="relative select-none">
                <svg
                  viewBox="0 0 280 118"
                  className="w-full h-32 bg-[#060911] rounded border border-slate-800 overflow-visible cursor-crosshair"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    onHoverProfileT(t);
                  }}
                  onMouseLeave={() => onHoverProfileT(null)}
                >
                  <defs>
                    <linearGradient id="demElevFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.03" />
                    </linearGradient>
                  </defs>

                  {(() => {
                    const padL = 6;
                    const padR = 6;
                    const padT = 10;
                    const padB = 16;
                    const w = 280 - padL - padR;
                    const h = 118 - padT - padB;
                    const zSpan = Math.max(10, profileStats.maxZ - profileStats.minZ);
                    const maxSlopeAxis = Math.max(25, profileStats.maxSlope + 3);

                    const elevCoords = profileSamples.map((s) => {
                      const x = padL + s.t * w;
                      const y = padT + h - ((s.elevM - profileStats.minZ) / zSpan) * h;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    });

                    const slopeCoords = profileSamples.map((s) => {
                      const x = padL + s.t * w;
                      const y = padT + h - Math.min(1, s.slopeDeg / maxSlopeAxis) * h;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    });

                    const hlsThresholdY = padT + h - (5.0 / maxSlopeAxis) * h;
                    const areaPath = `M ${padL},${padT + h} L ${elevCoords.join(' L ')} L ${
                      padL + w
                    },${padT + h} Z`;

                    const hoverX =
                      profileHoverT !== null ? padL + profileHoverT * w : null;

                    return (
                      <>
                        {/* 5 deg HLS Slope Limit Line */}
                        <line
                          x1={padL}
                          y1={hlsThresholdY}
                          x2={padL + w}
                          y2={hlsThresholdY}
                          stroke="#10B981"
                          strokeWidth="0.8"
                          strokeDasharray="3 3"
                          opacity="0.65"
                        />

                        {/* Elevation Area & Curve */}
                        <path d={areaPath} fill="url(#demElevFill)" />
                        <polyline
                          fill="none"
                          stroke="#F59E0B"
                          strokeWidth="1.8"
                          points={elevCoords.join(' ')}
                        />

                        {/* Slope Overlay Curve */}
                        <polyline
                          fill="none"
                          stroke="#38BDF8"
                          strokeWidth="1.2"
                          opacity="0.85"
                          points={slopeCoords.join(' ')}
                        />

                        {/* Hover Scrub Line */}
                        {hoverX !== null && (
                          <line
                            x1={hoverX}
                            y1={padT}
                            x2={hoverX}
                            y2={padT + h}
                            stroke="#34D399"
                            strokeWidth="1.2"
                          />
                        )}

                        <text x={padL} y={113} fill="#94A3B8" fontSize="8" fontFamily="monospace">
                          A (0.0 km)
                        </text>
                        <text
                          x={padL + w}
                          y={113}
                          fill="#94A3B8"
                          fontSize="8"
                          fontFamily="monospace"
                          textAnchor="end"
                        >
                          B ({profileStats.totalDistKm.toFixed(2)} km)
                        </text>
                      </>
                    );
                  })()}
                </svg>

                <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-amber-400 inline-block" /> Elevation (m)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-0.5 bg-sky-400 inline-block" /> Slope (°)
                  </span>
                  <span className="text-emerald-400">--- 5° HLS</span>
                </div>

                {hoveredSample && (
                  <div className="mt-1.5 px-2 py-1 rounded bg-slate-900 border border-emerald-500/40 text-[10px] text-slate-200 flex justify-between tabular-nums">
                    <span>@{hoveredSample.distanceKm.toFixed(2)} km</span>
                    <span>Elev {hoveredSample.elevM.toFixed(1)} m</span>
                    <span>Slope {hoveredSample.slopeDeg.toFixed(1)}°</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Baseline Patch DEM Summary */}
      <div className="p-3 rounded-md bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs font-mono">
        <span className="section-kicker block">Active Patch DEM Metrics</span>
        <div className="flex justify-between">
          <span className="text-slate-400">Elevation Span:</span>
          <span className="text-slate-100 tabular-nums">
            {terrainGrid.min_elev_m.toFixed(0)}m to {terrainGrid.max_elev_m.toFixed(0)}m
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Landing Pad Slope:</span>
          <span className="text-emerald-400 tabular-nums">
            {terrainGrid.landing_pad_slope_deg ?? 3.1}°
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Patch Mean Slope:</span>
          <span className="text-slate-100 tabular-nums">
            {terrainGrid.mean_slope_deg ?? 5.2}°
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">PSR Cold Trap Area:</span>
          <span className="text-sky-300 tabular-nums">
            {terrainGrid.psr_area_percentage ?? 0}%
          </span>
        </div>
      </div>
    </div>
  );
};