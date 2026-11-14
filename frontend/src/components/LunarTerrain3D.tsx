import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Mountain, Snowflake, RotateCcw } from 'lucide-react';
import type {
  TerrainGridData,
  TimelineStep,
  SolarArrayType,
  LunarSite,
  ThermalMetrics,
} from '../types/mission';
import type {
  ActiveToolId,
  CameraPresetId,
  ContourSettings,
  CursorTelemetry,
  GraticuleSettings,
  LayerItemState,
  MeasurePoint3D,
} from '../types/workbench';
import {
  computeTerrainBuffers,
  type TerrainWorkerOutput,
} from '../workers/terrainHorizonWorker';
import {
  createLunarTerrainShaderMaterial,
  syncTerrainShaderUniforms,
} from './terrain/LunarTerrainShaderMaterial';
import { MeasurementOverlay3D } from './terrain/MeasurementOverlay3D';
import { sceneToSelenographic } from '../utils/selenographicGeodesy';
import { SkyDome } from './SkyDome';
import { LanderModel3D } from './LanderModel3D';

export interface LunarTerrain3DProps {
  site: LunarSite;
  terrainGrid: TerrainGridData;
  timeline: TimelineStep[];
  currentStepIndex: number;
  arrayType: SolarArrayType;
  thermalMetrics?: ThermalMetrics;
  scenarioBadge?: string;
  compactMode?: boolean;
  externalShowPsr?: boolean;
  onTogglePsr?: (val: boolean) => void;
  layers?: LayerItemState[];
  contourSettings?: ContourSettings;
  graticuleSettings?: GraticuleSettings;
  cameraPreset?: CameraPresetId;
  cinematicMode?: boolean;
  showEducationalVectors?: boolean;
  onCursorTelemetry?: (cursor: CursorTelemetry) => void;
  activeTool?: ActiveToolId;
  measurePoints?: MeasurePoint3D[];
  onAddMeasurePoint?: (pt: MeasurePoint3D) => void;
  profileHoverT?: number | null;
}

const DEFAULT_FALLBACK_LAYERS: LayerItemState[] = [
  {
    id: 'lroc_wac',
    label: 'LROC WAC Albedo',
    group: 'Basemap',
    visible: true,
    opacity: 1,
    sourceNote: '',
  },
  {
    id: 'lola_elevation',
    label: 'LOLA Elevation',
    group: 'Elevation',
    visible: false,
    opacity: 0.55,
    colormap: 'cividis',
    minVal: -2500,
    maxVal: 4800,
    gamma: 1.0,
    sourceNote: '',
  },
  {
    id: 'psr_cold_traps',
    label: 'PSR Cold Traps',
    group: 'Illumination',
    visible: false,
    opacity: 0.85,
    sourceNote: '',
  },
];

interface CameraRigProps {
  cameraPreset: CameraPresetId;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

const CameraPresetRig: React.FC<CameraRigProps> = ({ cameraPreset, controlsRef }) => {
  const { camera } = useThree();
  const isTransitioningRef = useRef<boolean>(false);
  const goalPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 9.5, 13.5));
  const goalTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (cameraPreset === 'top_down') {
      goalPosRef.current.set(0, 21.0, 0.05);
      goalTargetRef.current.set(0, 0, 0);
    } else if (cameraPreset === 'low_oblique') {
      goalPosRef.current.set(0, 2.2, 7.8);
      goalTargetRef.current.set(0, 0.35, -1.5);
    } else {
      goalPosRef.current.set(0, 9.5, 13.5);
      goalTargetRef.current.set(0, 0, 0);
    }
    isTransitioningRef.current = true;
  }, [cameraPreset]);

  useFrame((_, delta) => {
    if (!isTransitioningRef.current || !controlsRef.current) return;
    const alpha = Math.min(1, delta * 5.5);
    camera.position.lerp(goalPosRef.current, alpha);
    controlsRef.current.target.lerp(goalTargetRef.current, alpha);
    controlsRef.current.update();
    if (camera.position.distanceTo(goalPosRef.current) < 0.04) {
      isTransitioningRef.current = false;
    }
  });

  return null;
};

interface SelenographicGraticuleProps {
  terrainGrid: TerrainGridData;
  verticalExaggeration: number;
  visible: boolean;
}

const SelenographicGraticule3D: React.FC<SelenographicGraticuleProps> = ({
  terrainGrid,
  verticalExaggeration,
  visible,
}) => {
  const { gridPolylines, ringPolylines } = useMemo(() => {
    const N = terrainGrid.grid_size;
    const baseElev = terrainGrid.lander_pos.z_m;

    const sampleY = (sceneX: number, sceneZ: number): number => {
      const u = Math.max(0, Math.min(1, (sceneX + 10.0) / 20.0));
      const vNorth = Math.max(0, Math.min(1, (-sceneZ + 10.0) / 20.0));
      const col = Math.min(N - 1, Math.floor(u * (N - 1)));
      const demRow = Math.min(N - 1, Math.floor(vNorth * (N - 1)));
      const zM = terrainGrid.elevations_m[demRow]?.[col] ?? baseElev;
      return ((zM - baseElev) / 1000.0) * verticalExaggeration + 0.035;
    };

    const lines: [number, number, number][][] = [];
    const coords = [-10, -5, 0, 5, 10];
    const samples = 48;

    for (const fixed of coords) {
      const rowPts: [number, number, number][] = [];
      const colPts: [number, number, number][] = [];
      for (let i = 0; i <= samples; i++) {
        const t = -10 + (20 * i) / samples;
        rowPts.push([t, sampleY(t, fixed), fixed]);
        colPts.push([fixed, sampleY(fixed, t), t]);
      }
      lines.push(rowPts, colPts);
    }

    const rings: { radiusScene: number; labelKm: string; pts: [number, number, number][] }[] = [];
    const kmToScene = 20.0 / Math.max(1, terrainGrid.patch_size_km);
    for (const km of [2.5, 5.0, 8.5]) {
      const rScene = km * kmToScene;
      if (rScene > 9.6) continue;
      const pts: [number, number, number][] = [];
      const segs = 64;
      for (let i = 0; i <= segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        const x = Math.cos(ang) * rScene;
        const z = Math.sin(ang) * rScene;
        pts.push([x, sampleY(x, z), z]);
      }
      rings.push({ radiusScene: rScene, labelKm: `${km.toFixed(1)} km`, pts });
    }

    return { gridPolylines: lines, ringPolylines: rings };
  }, [terrainGrid, verticalExaggeration]);

  if (!visible) return null;

  return (
    <group>
      {gridPolylines.map((pts, i) => (
        <Line
          key={`grid_${i}`}
          points={pts}
          color="#64748B"
          lineWidth={0.8}
          transparent
          opacity={0.28}
        />
      ))}
      {ringPolylines.map((ring) => (
        <group key={ring.labelKm}>
          <Line
            points={ring.pts}
            color="#38BDF8"
            lineWidth={1.0}
            dashed
            dashSize={0.35}
            gapSize={0.25}
            transparent
            opacity={0.42}
          />
          <Html position={[ring.radiusScene, 0.25, 0]} center distanceFactor={20}>
            <span className="px-1 py-0.5 rounded bg-[#05070b]/85 text-sky-300/90 border border-sky-500/30 text-[8px] font-mono pointer-events-none whitespace-nowrap">
              {ring.labelKm}
            </span>
          </Html>
        </group>
      ))}
    </group>
  );
};

interface TerrainShaderSurfaceProps {
  site: LunarSite;
  terrainGrid: TerrainGridData;
  verticalExaggeration: number;
  currentStep: TimelineStep;
  layers: LayerItemState[];
  contourSettings?: ContourSettings;
  cinematicMode: boolean;
  onCursorTelemetry?: (cursor: CursorTelemetry) => void;
  activeTool: ActiveToolId;
  onAddMeasurePoint?: (pt: MeasurePoint3D) => void;
}

const TerrainShaderSurface: React.FC<TerrainShaderSurfaceProps> = ({
  site,
  terrainGrid,
  verticalExaggeration,
  currentStep,
  layers,
  contourSettings,
  cinematicMode,
  onCursorTelemetry,
  activeTool,
  onAddMeasurePoint,
}) => {
  const [workerResult, setWorkerResult] = useState<TerrainWorkerOutput | null>(null);
  const [diffuseTex, setDiffuseTex] = useState<THREE.Texture | null>(null);
  const requestIdRef = useRef<number>(0);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    const reqId = ++requestIdRef.current;
    const payload = {
      requestId: reqId,
      elevations: terrainGrid.elevations_m,
      patchSizeKm: terrainGrid.patch_size_km,
      verticalExaggeration,
      baseElevM: terrainGrid.lander_pos.z_m,
    };

    let worker: Worker | null = null;
    try {
      worker = new Worker(
        new URL('../workers/terrainHorizonWorker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (e: MessageEvent<TerrainWorkerOutput>) => {
        if (e.data.requestId === requestIdRef.current) {
          setWorkerResult(e.data);
        }
      };
      worker.postMessage(payload);
    } catch {
      const syncOut = computeTerrainBuffers(payload);
      Promise.resolve().then(() => {
        if (reqId === requestIdRef.current) setWorkerResult(syncOut);
      });
    }

    return () => {
      worker?.terminate();
    };
  }, [
    terrainGrid.elevations_m,
    terrainGrid.patch_size_km,
    terrainGrid.lander_pos.z_m,
    verticalExaggeration,
  ]);

  useEffect(() => {
    const backendOrigin = (
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
    ).replace(/\/api$/, '');
    const staticUrl = terrainGrid.lroc_texture_url
      ? `${backendOrigin}${terrainGrid.lroc_texture_url}`
      : undefined;
    const uri = terrainGrid.lroc_texture_base64 || staticUrl;

    if (!uri) {
      Promise.resolve().then(() => setDiffuseTex(null));
      return;
    }

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      uri,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        setDiffuseTex((prev) => {
          prev?.dispose();
          return tex;
        });
      },
      undefined,
      () => {
        if (!cancelled) setDiffuseTex(null);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [terrainGrid.lroc_texture_base64, terrainGrid.lroc_texture_url]);

  useEffect(() => {
    const mat = createLunarTerrainShaderMaterial();
    materialRef.current = mat;
    if (meshRef.current) {
      meshRef.current.material = mat;
    }
    return () => {
      mat.dispose();
      materialRef.current = null;
    };
  }, []);

  const { geometry, texA, texB } = useMemo(() => {
    const N = terrainGrid.grid_size;
    const geom = new THREE.PlaneGeometry(20.0, 20.0, N - 1, N - 1);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position as THREE.BufferAttribute;
    const normAttr = geom.attributes.normal as THREE.BufferAttribute;
    const count = posAttr.count;

    const elevAttr = new Float32Array(count);
    const slopeAttr = new Float32Array(count);
    const aoAttr = new Float32Array(count);

    const activeData =
      workerResult && workerResult.gridSize === N
        ? workerResult
        : computeTerrainBuffers({
            requestId: 0,
            elevations: terrainGrid.elevations_m,
            patchSizeKm: terrainGrid.patch_size_km,
            verticalExaggeration,
            baseElevM: terrainGrid.lander_pos.z_m,
          });

    for (let i = 0; i < count; i++) {
      posAttr.setY(i, activeData.positionsY[i]);
      normAttr.setXYZ(
        i,
        activeData.normals[i * 3],
        activeData.normals[i * 3 + 1],
        activeData.normals[i * 3 + 2]
      );
      const rowFromNorth = Math.floor(i / N);
      const col = i % N;
      const demRow = N - 1 - rowFromNorth;
      elevAttr[i] = terrainGrid.elevations_m[demRow]?.[col] ?? terrainGrid.lander_pos.z_m;
      slopeAttr[i] = activeData.slopesDeg[i];
      aoAttr[i] = activeData.ao[i];
    }

    geom.setAttribute('aElevM', new THREE.BufferAttribute(elevAttr, 1));
    geom.setAttribute('aSlopeDeg', new THREE.BufferAttribute(slopeAttr, 1));
    geom.setAttribute('aAo', new THREE.BufferAttribute(aoAttr, 1));
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;

    const dataTexA = new THREE.DataTexture(activeData.horizonSectorA, N, N, THREE.RGBAFormat);
    dataTexA.minFilter = THREE.LinearFilter;
    dataTexA.magFilter = THREE.LinearFilter;
    dataTexA.flipY = true;
    dataTexA.needsUpdate = true;

    const dataTexB = new THREE.DataTexture(activeData.horizonSectorB, N, N, THREE.RGBAFormat);
    dataTexB.minFilter = THREE.LinearFilter;
    dataTexB.magFilter = THREE.LinearFilter;
    dataTexB.flipY = true;
    dataTexB.needsUpdate = true;

    return { geometry: geom, texA: dataTexA, texB: dataTexB };
  }, [
    terrainGrid.grid_size,
    terrainGrid.elevations_m,
    terrainGrid.patch_size_km,
    terrainGrid.lander_pos.z_m,
    verticalExaggeration,
    workerResult,
  ]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      texA.dispose();
      texB.dispose();
    };
  }, [geometry, texA, texB]);

  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    if (meshRef.current && meshRef.current.material !== mat) {
      meshRef.current.material = mat;
    }

    mat.uniforms.uHorizonTexA.value = texA;
    mat.uniforms.uHorizonTexB.value = texB;
    mat.uniforms.uDiffuseTex.value = diffuseTex;
    mat.uniforms.uHasDiffuseTex.value = diffuseTex ? 1.0 : 0.0;

    syncTerrainShaderUniforms(mat, {
      sunAzDeg: currentStep.sun_az,
      sunElDeg: currentStep.sun_el,
      sunFraction: currentStep.sun_fraction,
      earthAzDeg: currentStep.earth_az,
      earthElDeg: currentStep.earth_el,
      cinematicMode,
      minElevM: terrainGrid.min_elev_m,
      maxElevM: terrainGrid.max_elev_m,
      layers,
      contourSettings,
    });
  }, [
    texA,
    texB,
    diffuseTex,
    currentStep.sun_az,
    currentStep.sun_el,
    currentStep.sun_fraction,
    currentStep.earth_az,
    currentStep.earth_el,
    cinematicMode,
    terrainGrid.min_elev_m,
    terrainGrid.max_elev_m,
    layers,
    contourSettings,
  ]);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!onCursorTelemetry) return;
      const pt = e.point;
      const N = terrainGrid.grid_size;
      const u = Math.max(0, Math.min(1, (pt.x + 10.0) / 20.0));
      const vNorth = Math.max(0, Math.min(1, (-pt.z + 10.0) / 20.0));

      const col = Math.min(N - 1, Math.floor(u * N));
      const demRow = Math.min(N - 1, Math.floor(vNorth * N));
      const elevM = terrainGrid.elevations_m[demRow]?.[col] ?? terrainGrid.lander_pos.z_m;

      const kmPerSceneUnit = terrainGrid.patch_size_km / 20.0;
      const dNorthKm = -pt.z * kmPerSceneUnit;
      const dEastKm = pt.x * kmPerSceneUnit;
      const rMoonKm = 1737.4;

      const latDeg = site.lat_deg + (dNorthKm / rMoonKm) * (180 / Math.PI);
      const cosLat = Math.max(0.05, Math.cos((site.lat_deg * Math.PI) / 180));
      const lonDeg =
        (site.lon_deg + (dEastKm / (rMoonKm * cosLat)) * (180 / Math.PI) + 360) % 360;

      const slopeAttr = geometry.getAttribute('aSlopeDeg') as THREE.BufferAttribute | undefined;
      const rowFromNorth = N - 1 - demRow;
      const slopeDeg = slopeAttr
        ? slopeAttr.getX(rowFromNorth * N + col)
        : terrainGrid.mean_slope_deg ?? 4.0;

      onCursorTelemetry({
        latDeg,
        lonDeg,
        elevM,
        slopeDeg,
        sunlit: currentStep.sun_visible,
        earthVisible: currentStep.earth_visible,
      });
    },
    [
      onCursorTelemetry,
      terrainGrid,
      site.lat_deg,
      site.lon_deg,
      geometry,
      currentStep.sun_visible,
      currentStep.earth_visible,
    ]
  );

  const handleSurfaceClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (activeTool === 'none' || !onAddMeasurePoint) return;
      // Ignore orbit camera drags (pointer moved > 4px)
      if (e.delta > 4) return;
      e.stopPropagation();

      const sceneX = Math.max(-10, Math.min(10, e.point.x));
      const sceneZ = Math.max(-10, Math.min(10, e.point.z));
      const pt = sceneToSelenographic(site, terrainGrid, sceneX, sceneZ);
      onAddMeasurePoint(pt);
    },
    [activeTool, onAddMeasurePoint, site, terrainGrid]
  );

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      receiveShadow
      onPointerMove={handlePointerMove}
      onClick={handleSurfaceClick}
    />
  );
};

export const LunarTerrain3D: React.FC<LunarTerrain3DProps> = React.memo(
  ({
    site,
    terrainGrid,
    timeline,
    currentStepIndex,
    arrayType,
    scenarioBadge,
    compactMode = false,
    externalShowPsr,
    onTogglePsr,
    layers,
    contourSettings,
    graticuleSettings,
    cameraPreset = 'orbit',
    cinematicMode = false,
    showEducationalVectors = false,
    onCursorTelemetry,
    activeTool = 'none',
    measurePoints = [],
    onAddMeasurePoint,
    profileHoverT = null,
  }) => {
    const [verticalExaggeration, setVerticalExaggeration] = useState<number>(2.2);
    const [internalShowPsr, setInternalShowPsr] = useState<boolean>(false);
    const controlsRef = useRef<OrbitControlsImpl>(null);

    const showPsr = externalShowPsr !== undefined ? externalShowPsr : internalShowPsr;
    const handleTogglePsr = () => {
      const next = !showPsr;
      if (onTogglePsr) onTogglePsr(next);
      else setInternalShowPsr(next);
    };

    const effectiveLayers = useMemo(() => {
      const base = layers && layers.length > 0 ? layers : DEFAULT_FALLBACK_LAYERS;
      return base.map((l) => (l.id === 'psr_cold_traps' ? { ...l, visible: showPsr } : l));
    }, [layers, showPsr]);

    const currentStep = timeline[currentStepIndex] || timeline[0];

    return (
      <div
        className={`relative h-full w-full overflow-hidden bg-[#05070b] ${
          activeTool !== 'none' ? 'cursor-crosshair' : ''
        }`}
      >
        {/* Top-Left Compact Site Header Badge */}
        {!cinematicMode && (
          <div className="absolute top-3 left-16 max-md:left-3 z-20 hud-panel rounded-md px-3 py-1.5 max-w-[44vw] pointer-events-auto">
            <div className="flex items-center gap-2">
              <Mountain className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              {scenarioBadge && (
                <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/40 text-[10px] font-mono font-semibold">
                  {scenarioBadge}
                </span>
              )}
              <h2 className="text-xs font-semibold tracking-wide text-slate-100 truncate">
                {site.name}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-[10px] font-mono text-slate-400 mt-0.5 tabular-nums">
              <span>
                {site.lat_deg >= 0
                  ? `${site.lat_deg.toFixed(2)}°N`
                  : `${Math.abs(site.lat_deg).toFixed(2)}°S`}
                , {site.lon_deg.toFixed(1)}°E
              </span>
              <span>•</span>
              <span>
                Datum{' '}
                <strong className="text-slate-200">
                  {site.elev_m >= 0 ? `+${site.elev_m}m` : `${site.elev_m}m`}
                </strong>
              </span>
              {!compactMode && (
                <>
                  <span>•</span>
                  <span>
                    LOLA {terrainGrid.grid_size}×{terrainGrid.grid_size}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Secondary Viewport Controls */}
        {!cinematicMode && (
          <div className="absolute top-14 right-3 z-20 flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={handleTogglePsr}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono hud-panel transition-colors ${
                showPsr
                  ? 'border-sky-400/70 text-sky-300 bg-sky-500/20'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Toggle Permanently Shadowed Regions (<70K)"
            >
              <Snowflake className="w-3 h-3" />
              <span>PSR</span>
            </button>

            <select
              value={verticalExaggeration}
              onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
              aria-label="Vertical Relief Exaggeration"
              className="hud-panel rounded-md px-2 py-1 text-[10px] font-mono text-slate-200 focus:outline-none cursor-pointer"
              title="Vertical Terrain Exaggeration"
            >
              <option value={1}>1.0x Z</option>
              <option value={2.2}>2.2x Z</option>
              <option value={4}>4.0x Z</option>
            </select>

            <button
              type="button"
              onClick={() => controlsRef.current?.reset()}
              aria-label="Reset camera view"
              className="hud-panel rounded-md p-1 text-slate-300 hover:text-white transition-colors"
              title="Reset Camera"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3D WebGL Canvas */}
        <div className="w-full h-full">
          <Canvas
            shadows
            gl={{
              antialias: true,
              preserveDrawingBuffer: true,
              powerPreference: 'high-performance',
            }}
            camera={{
              position: [0, 9.5, 13.5],
              fov: 44,
              near: 0.1,
              far: 260,
            }}
          >
            <color attach="background" args={['#05070b']} />

            {currentStep && (
              <SkyDome
                timeline={timeline}
                currentStep={currentStep}
                cinematicMode={cinematicMode}
                showTrajectoryArcs={!cinematicMode}
              />
            )}

            {currentStep && (
              <TerrainShaderSurface
                site={site}
                terrainGrid={terrainGrid}
                verticalExaggeration={verticalExaggeration}
                currentStep={currentStep}
                layers={effectiveLayers}
                contourSettings={contourSettings}
                cinematicMode={cinematicMode}
                onCursorTelemetry={onCursorTelemetry}
                activeTool={activeTool}
                onAddMeasurePoint={onAddMeasurePoint}
              />
            )}

            <SelenographicGraticule3D
              terrainGrid={terrainGrid}
              verticalExaggeration={verticalExaggeration}
              visible={(graticuleSettings?.visible ?? true) && !cinematicMode}
            />

            {currentStep && !cinematicMode && (
              <MeasurementOverlay3D
                terrainGrid={terrainGrid}
                verticalExaggeration={verticalExaggeration}
                activeTool={activeTool}
                points={measurePoints}
                currentStep={currentStep}
                profileHoverT={profileHoverT}
              />
            )}

            {currentStep && (
              <LanderModel3D
                currentStep={currentStep}
                arrayType={arrayType}
                showEducationalVectors={showEducationalVectors && !cinematicMode}
                cinematicMode={cinematicMode}
              />
            )}

            {/* Minimal SVS Cardinal Graticule Labels */}
            {!cinematicMode && (
              <>
                <Html position={[0, 0.35, -9.8]} center distanceFactor={22}>
                  <span className="px-1.5 py-0.5 rounded bg-[#070b14]/85 text-sky-400 border border-sky-500/30 text-[9px] font-mono tracking-wider pointer-events-none">
                    0° N
                  </span>
                </Html>
                <Html position={[9.8, 0.35, 0]} center distanceFactor={22}>
                  <span className="px-1.5 py-0.5 rounded bg-[#070b14]/80 text-slate-400 border border-slate-700/60 text-[9px] font-mono pointer-events-none">
                    90° E
                  </span>
                </Html>
                <Html position={[0, 0.35, 9.8]} center distanceFactor={22}>
                  <span className="px-1.5 py-0.5 rounded bg-[#070b14]/80 text-slate-400 border border-slate-700/60 text-[9px] font-mono pointer-events-none">
                    180° S
                  </span>
                </Html>
                <Html position={[-9.8, 0.35, 0]} center distanceFactor={22}>
                  <span className="px-1.5 py-0.5 rounded bg-[#070b14]/80 text-slate-400 border border-slate-700/60 text-[9px] font-mono pointer-events-none">
                    270° W
                  </span>
                </Html>
              </>
            )}

            <CameraPresetRig cameraPreset={cameraPreset} controlsRef={controlsRef} />

            <OrbitControls
              ref={controlsRef}
              maxPolarAngle={Math.PI / 2 - 0.02}
              minDistance={1.0}
              maxDistance={32}
              enableDamping
              dampingFactor={0.07}
            />

            <EffectComposer multisampling={0}>
              <Bloom
                intensity={0.28}
                luminanceThreshold={1.15}
                luminanceSmoothing={0.25}
                mipmapBlur
              />
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            </EffectComposer>
          </Canvas>
        </div>
      </div>
    );
  }
);