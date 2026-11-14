import React, { useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import {
  Camera,
  Eye,
  Mountain,
  Sun,
  Radio,
  Snowflake,
  Thermometer,
  Film,
  Grid,
  Compass,
} from 'lucide-react';
import type {
  TerrainGridData,
  TimelineStep,
  SolarArrayType,
  LunarSite,
  ThermalMetrics,
} from '../types/mission';
import { LanderModel3D } from './LanderModel3D';
import { SkyDome } from './SkyDome';

interface LunarTerrain3DProps {
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
}

interface TerrainMeshProps {
  terrainGrid: TerrainGridData;
  verticalExaggeration: number;
  showPsrOverlay: boolean;
  cinematicMode: boolean;
  wireframeDataMode: boolean;
  siteLatDeg: number;
}

function buildDemNormalMapTexture(
  elevations: number[][],
  gridSize: number,
  cellSizeM: number,
  verticalExaggeration: number
): THREE.DataTexture {
  const N = gridSize;
  const scaleFactor = 4;
  const width = N * scaleFactor;
  const height = N * scaleFactor;
  const data = new Uint8Array(width * height * 4);

  const sampleElevation = (rFloat: number, cFloat: number): number => {
    const r = Math.max(0, Math.min(N - 1, Math.floor(rFloat)));
    const c = Math.max(0, Math.min(N - 1, Math.floor(cFloat)));
    return elevations[r]?.[c] ?? 0;
  };

  for (let py = 0; py < height; py++) {
    const demRow = (py / (height - 1)) * (N - 1);
    for (let px = 0; px < width; px++) {
      const demCol = (px / (width - 1)) * (N - 1);

      const eLeft = sampleElevation(demRow, demCol - 1);
      const eRight = sampleElevation(demRow, demCol + 1);
      const eDown = sampleElevation(demRow - 1, demCol);
      const eUp = sampleElevation(demRow + 1, demCol);

      // Multi-frequency micro-regolith grain + sub-grid crater normal perturbations
      const u = px / width;
      const v = py / height;
      const craterFieldX = Math.sin(u * 48.0) * Math.cos(v * 48.0) * 0.14;
      const craterFieldY = Math.cos(u * 48.0) * Math.sin(v * 48.0) * 0.14;
      const microGrainX = Math.sin(px * 1.9 + py * 1.1) * 0.065 + craterFieldX;
      const microGrainY = Math.cos(px * 1.1 - py * 1.8) * 0.065 + craterFieldY;

      const dzdx =
        (((eRight - eLeft) * verticalExaggeration) / (2.0 * Math.max(10, cellSizeM))) * 2.85 +
        microGrainX;
      const dzdy =
        (((eUp - eDown) * verticalExaggeration) / (2.0 * Math.max(10, cellSizeM))) * 2.85 +
        microGrainY;

      const nx = -dzdx;
      const ny = -dzdy;
      const nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;

      const idx = (py * width + px) * 4;
      data[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  const normalTex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  normalTex.wrapS = THREE.ClampToEdgeWrapping;
  normalTex.wrapT = THREE.ClampToEdgeWrapping;
  normalTex.magFilter = THREE.LinearFilter;
  normalTex.minFilter = THREE.LinearMipmapLinearFilter;
  normalTex.generateMipmaps = true;
  normalTex.needsUpdate = true;
  return normalTex;
}

const RegolithTerrainMesh: React.FC<TerrainMeshProps> = ({
  terrainGrid,
  verticalExaggeration,
  showPsrOverlay,
  cinematicMode,
  wireframeDataMode,
  siteLatDeg,
}) => {
  const [diffuseTexture, setDiffuseTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const backendOrigin = (
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
    ).replace(/\/api$/, '');
    const staticUrl =
      showPsrOverlay && cinematicMode
        ? terrainGrid.lroc_psr_texture_url
          ? `${backendOrigin}${terrainGrid.lroc_psr_texture_url}`
          : undefined
        : terrainGrid.lroc_texture_url
        ? `${backendOrigin}${terrainGrid.lroc_texture_url}`
        : undefined;

    const uri =
      showPsrOverlay && cinematicMode
        ? terrainGrid.lroc_psr_texture_base64 || staticUrl || terrainGrid.lroc_texture_base64
        : terrainGrid.lroc_texture_base64 || staticUrl;

    if (!uri) {
      setDiffuseTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(
      uri,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        setDiffuseTexture(tex);
      },
      undefined,
      () => setDiffuseTexture(null)
    );
  }, [
    terrainGrid.lroc_texture_base64,
    terrainGrid.lroc_psr_texture_base64,
    terrainGrid.lroc_texture_url,
    terrainGrid.lroc_psr_texture_url,
    showPsrOverlay,
    cinematicMode,
  ]);

  const normalMapTexture = useMemo(() => {
    const cellSizeM =
      ((terrainGrid.patch_size_km || 20) * 1000) / Math.max(1, terrainGrid.grid_size - 1);
    return buildDemNormalMapTexture(
      terrainGrid.elevations_m,
      terrainGrid.grid_size,
      cellSizeM,
      verticalExaggeration
    );
  }, [
    terrainGrid.elevations_m,
    terrainGrid.grid_size,
    terrainGrid.patch_size_km,
    verticalExaggeration,
  ]);

  const geometry = useMemo(() => {
    const N = terrainGrid.grid_size;
    const elevations = terrainGrid.elevations_m;
    const baseElev = terrainGrid.lander_pos.z_m;
    const patchSizeScene = 20.0;
    const geom = new THREE.PlaneGeometry(patchSizeScene, patchSizeScene, N - 1, N - 1);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const minE = terrainGrid.min_elev_m;
    const maxE = Math.max(minE + 10, terrainGrid.max_elev_m);
    const rimThreshold = minE + 0.65 * (maxE - minE);
    const isPolar = Math.abs(siteLatDeg) > 75;

    for (let idx = 0; idx < posAttr.count; idx++) {
      const col = idx % N;
      const rowFromNorth = Math.floor(idx / N);
      const demRow = N - 1 - rowFromNorth;
      const zMeters = elevations[demRow]?.[col] ?? baseElev;
      const relKm = ((zMeters - baseElev) / 1000.0) * verticalExaggeration;

      posAttr.setY(idx, relKm);

      const norm = Math.max(0, Math.min(1, (zMeters - minE) / (maxE - minE)));
      const isColdTrap = isPolar && rimThreshold - zMeters > 190;

      if (!cinematicMode && isColdTrap) {
        colors[idx * 3] = 1.0;
        colors[idx * 3 + 1] = 0.08;
        colors[idx * 3 + 2] = 0.16;
      } else if (showPsrOverlay && isColdTrap) {
        colors[idx * 3] = 0.88;
        colors[idx * 3 + 1] = 0.16;
        colors[idx * 3 + 2] = 0.32;
      } else {
        const shade = diffuseTexture ? 0.85 + 0.15 * norm : 0.28 + 0.42 * norm;
        colors[idx * 3] = shade;
        colors[idx * 3 + 1] = shade * 0.99;
        colors[idx * 3 + 2] = shade * 0.98;
      }
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    geom.computeTangents();
    return geom;
  }, [
    terrainGrid,
    verticalExaggeration,
    showPsrOverlay,
    cinematicMode,
    siteLatDeg,
    diffuseTexture,
  ]);

  // Deterministic 3D Lunar Ejecta Boulders placed at exact terrain surface elevations
  const boulders = useMemo(() => {
    const N = terrainGrid.grid_size;
    const elevations = terrainGrid.elevations_m;
    const baseElev = terrainGrid.lander_pos.z_m;
    const list: {
      pos: [number, number, number];
      scale: [number, number, number];
      rot: [number, number, number];
    }[] = [];

    for (let i = 0; i < 36; i++) {
      // Deterministic golden-angle spiral outside immediate 0.85-unit lander pad
      const r = 0.88 + ((i * 0.6180339887) % 1) * 6.8;
      const theta = i * 2.3999632;
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);

      const u = (x + 10.0) / 20.0;
      const v = (z + 10.0) / 20.0;
      const col = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
      const rowFromNorth = Math.max(0, Math.min(N - 1, Math.round(v * (N - 1))));
      const demRow = N - 1 - rowFromNorth;
      const zMeters = elevations[demRow]?.[col] ?? baseElev;
      const y = ((zMeters - baseElev) / 1000.0) * verticalExaggeration;

      const baseScale = 0.025 + ((i * 17) % 10) * 0.0065;
      list.push({
        pos: [x, y + baseScale * 0.35, z],
        scale: [baseScale * 1.3, baseScale * 0.78, baseScale * 1.1],
        rot: [(i * 0.7) % 3.14, (i * 1.3) % 3.14, (i * 0.4) % 3.14],
      });
    }
    return list;
  }, [terrainGrid, verticalExaggeration]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshPhysicalMaterial
          key={`${diffuseTexture ? 'tex' : 'notex'}-${cinematicMode ? 'cin' : 'data'}`}
          map={diffuseTexture || null}
          normalMap={normalMapTexture}
          normalScale={new THREE.Vector2(1.75, 1.75)}
          vertexColors
          roughness={0.95}
          metalness={0.03}
          reflectivity={0.04}
          clearcoat={0.0}
        />
      </mesh>

      {/* Scattered Lunar Ejecta Boulders Casting Grazing Shadows */}
      {boulders.map((b, idx) => (
        <mesh
          key={idx}
          position={b.pos}
          scale={b.scale}
          rotation={b.rot}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial
            color="#646A73"
            roughness={0.94}
            metalness={0.05}
          />
        </mesh>
      ))}

      {!cinematicMode && wireframeDataMode && (
        <mesh geometry={geometry} position={[0, 0.006, 0]}>
          <meshBasicMaterial color="#38BDF8" wireframe transparent opacity={0.28} />
        </mesh>
      )}
    </group>
  );
};

export const LunarTerrain3D: React.FC<LunarTerrain3DProps> = ({
  site,
  terrainGrid,
  timeline,
  currentStepIndex,
  arrayType,
  thermalMetrics,
  scenarioBadge,
  compactMode = false,
  externalShowPsr,
  onTogglePsr,
}) => {
  const [cameraMode, setCameraMode] = useState<'orbital' | 'surface'>('orbital');
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(2.5);
  const [internalShowPsr, setInternalShowPsr] = useState<boolean>(false);

  const [cinematicMode, setCinematicMode] = useState<boolean>(true);
  const [wireframeDataMode, setWireframeDataMode] = useState<boolean>(true);
  const [showEducationalVectors, setShowEducationalVectors] = useState<boolean>(true);

  const showPsr = externalShowPsr !== undefined ? externalShowPsr : internalShowPsr;
  const handleTogglePsr = () => {
    const next = !showPsr;
    if (onTogglePsr) onTogglePsr(next);
    else setInternalShowPsr(next);
  };

  const currentStep = timeline[currentStepIndex] || timeline[0];

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-3 flex flex-col justify-between h-full shadow-lg relative overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2 mb-2 z-10">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              {scenarioBadge && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                  {scenarioBadge}
                </span>
              )}
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                {site.name}
              </h2>
            </div>
            <p className="text-[10px] text-gray-400 font-mono">
              PBR Regolith (Roughness 0.94) • DEM Normal Map • 0.53° Sun / 1.9° Earth SkyDome
            </p>
          </div>
        </div>

        {/* Phase 3 Mode Toggles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-[#0B0F19] p-0.5 border border-gray-700 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setCinematicMode(true)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                cinematicMode
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Cinematic Mode: Apollo Vacuum Look, ACES Filmic ToneMapping, HDR Bloom & Pitch-Black Shadows"
            >
              <Film className="w-3 h-3" />
              Cinematic
            </button>
            <button
              type="button"
              onClick={() => setCinematicMode(false)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                !cinematicMode
                  ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Data Mode: Artificially Brightened Ambient Light, Wireframe Grid & Neon Red PSR Hazard Highlighting"
            >
              <Grid className="w-3 h-3" />
              Data Mode
            </button>
          </div>

          {!cinematicMode && (
            <button
              type="button"
              onClick={() => setWireframeDataMode((w) => !w)}
              className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition ${
                wireframeDataMode
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                  : 'bg-[#0B0F19] text-gray-400 border-gray-700'
              }`}
            >
              Wireframe: {wireframeDataMode ? 'ON' : 'OFF'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowEducationalVectors((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border transition ${
              showEducationalVectors
                ? 'bg-emerald-600/30 text-emerald-200 border-emerald-400/70'
                : 'bg-[#0B0F19] text-gray-300 border-gray-700 hover:text-white'
            }`}
            title="Toggle 3D Sun Ray Vector, Panel Surface Normal Vector & Angle of Incidence (θ) Educational Overlay"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            {compactMode ? 'Vectors' : 'Incidence Vectors'}
          </button>

          <button
            type="button"
            onClick={handleTogglePsr}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border transition ${
              showPsr || !cinematicMode
                ? 'bg-rose-600/30 text-rose-200 border-rose-400/70'
                : 'bg-[#0B0F19] text-gray-300 border-gray-700 hover:text-white'
            }`}
          >
            <Snowflake className="w-3.5 h-3.5 text-rose-300" />
            {compactMode ? 'PSRs' : showPsr ? 'PSRs Active' : 'Show PSRs'}
          </button>

          <div className="inline-flex rounded-lg bg-[#0B0F19] p-0.5 border border-gray-700 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setCameraMode('orbital')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                cameraMode === 'orbital'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Camera className="w-3 h-3" />
              Orbital
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('surface')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition ${
                cameraMode === 'surface'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              Surface
            </button>
          </div>

          <select
            value={verticalExaggeration}
            onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
            className="bg-[#0B0F19] border border-gray-700 rounded-lg px-2 py-1 text-[11px] font-mono text-gray-300"
          >
            <option value={1}>1.0x Scale</option>
            <option value={2.5}>2.5x Relief</option>
            <option value={4}>4.0x Relief</option>
          </select>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div
        className={`relative flex-1 ${
          compactMode ? 'min-h-[300px]' : 'min-h-[360px]'
        } w-full rounded-lg overflow-hidden bg-[#030509] border border-gray-800/80`}
      >
        <Canvas
          shadows={{ type: THREE.PCFSoftShadowMap }}
          key={cameraMode}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
          }}
          camera={{
            position: cameraMode === 'orbital' ? [0, 8.5, 12.8] : [0, 0.72, 2.35],
            fov: cameraMode === 'orbital' ? 45 : 50,
            near: 0.08,
            far: 12000,
          }}
        >
          <color attach="background" args={[cinematicMode ? '#020307' : '#0B101E']} />

          {currentStep && (
            <SkyDome
              timeline={timeline}
              currentStep={currentStep}
              cinematicMode={cinematicMode}
            />
          )}

          <RegolithTerrainMesh
            terrainGrid={terrainGrid}
            verticalExaggeration={verticalExaggeration}
            showPsrOverlay={showPsr}
            cinematicMode={cinematicMode}
            wireframeDataMode={wireframeDataMode}
            siteLatDeg={site.lat_deg}
          />

          {currentStep && (
            <LanderModel3D
              currentStep={currentStep}
              arrayType={arrayType}
              showEducationalVectors={showEducationalVectors}
              cinematicMode={cinematicMode}
            />
          )}

          <Html position={[0, 0.4, -9.6]} center distanceFactor={20}>
            <span className="px-1.5 py-0.5 rounded bg-slate-900/90 text-sky-400 border border-sky-500/40 text-[10px] font-mono font-bold pointer-events-none">
              N (0° EARTH)
            </span>
          </Html>
          <Html position={[9.6, 0.4, 0]} center distanceFactor={20}>
            <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-gray-300 border border-gray-700 text-[10px] font-mono pointer-events-none">
              E (90°)
            </span>
          </Html>
          <Html position={[0, 0.4, 9.6]} center distanceFactor={20}>
            <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-gray-300 border border-gray-700 text-[10px] font-mono pointer-events-none">
              S (180°)
            </span>
          </Html>
          <Html position={[-9.6, 0.4, 0]} center distanceFactor={20}>
            <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-gray-300 border border-gray-700 text-[10px] font-mono pointer-events-none">
              W (270°)
            </span>
          </Html>

          <OrbitControls
            target={cameraMode === 'orbital' ? [0, 0.35, 0] : [0, 0.55, -2.5]}
            maxPolarAngle={Math.PI / 2 - 0.01}
            minDistance={0.9}
            maxDistance={32}
            enableDamping
          />

          <EffectComposer enableNormalPass={false}>
            <Bloom
              luminanceThreshold={cinematicMode ? 0.62 : 1.5}
              luminanceSmoothing={0.25}
              intensity={cinematicMode ? 1.45 : 0.15}
              mipmapBlur
            />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        </Canvas>

        {/* Bottom-Left Telemetry & Diviner Thermal HUD Overlay */}
        <div className="absolute bottom-2 left-2 bg-slate-950/85 backdrop-blur-md border border-gray-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono space-y-0.5 pointer-events-none">
          <div className="flex items-center gap-2.5">
            <span className="text-gray-400">
              Elev:{' '}
              <strong className="text-white">
                {site.elev_m >= 0 ? `+${site.elev_m}m` : `${site.elev_m}m`}
              </strong>
            </span>
            <span className="text-gray-400">
              Slope: <strong className="text-white">{terrainGrid.mean_slope_deg ?? 4.5}°</strong>
            </span>
            <span className="text-rose-300">
              PSR Area: <strong>{terrainGrid.psr_area_percentage ?? 0}%</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`flex items-center gap-1 ${
                currentStep?.sun_visible ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              <Sun className="w-3 h-3" />{' '}
              {currentStep?.sun_visible ? `${currentStep.power_kw.toFixed(2)}kW` : 'ECLIPSE'}
            </span>
            <span
              className={`flex items-center gap-1 ${
                currentStep?.earth_visible ? 'text-sky-400' : 'text-red-400'
              }`}
            >
              <Radio className="w-3 h-3" />{' '}
              {currentStep?.earth_visible ? 'DTE LINK' : 'OCCLUDED'}
            </span>
            {thermalMetrics && (
              <span
                className={`flex items-center gap-1 ${
                  (currentStep?.local_temp_k ??
                    thermalMetrics.local_temp_k ??
                    thermalMetrics.temp_min_k) < 70
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-400'
                }`}
              >
                <Thermometer className="w-3 h-3" />{' '}
                {currentStep?.local_temp_k ??
                  thermalMetrics.local_temp_k ??
                  thermalMetrics.temp_max_k}
                K ({thermalMetrics.temp_min_k}K–{thermalMetrics.temp_max_k}K)
              </span>
            )}
          </div>
        </div>

        {/* Top-Right Active Mode & PSR Hazard Legend Pill */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1 pointer-events-none">
          <div
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono border flex items-center gap-1.5 ${
              cinematicMode
                ? 'bg-amber-950/85 border-amber-500/50 text-amber-200'
                : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                cinematicMode ? 'bg-amber-400' : 'bg-rose-500 animate-pulse'
              }`}
            />
            {cinematicMode
              ? 'CINEMATIC VACUUM PBR (ACES Filmic + HDR Bloom)'
              : 'DATA SAFETY MODE (Neon Red PSR Cold-Traps <70K)'}
          </div>
        </div>
      </div>

      {/* 3D Viewport Visual Legend & Quick Reference Strip */}
      <div className="mt-2 pt-2 border-t border-gray-800/90 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-gray-400">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-gray-300 font-bold uppercase">Beacon Ring:</span>
          <span className="flex items-center gap-1 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Joint (Sun+DTE)
          </span>
          <span className="flex items-center gap-1 text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Sun Only
          </span>
          <span className="flex items-center gap-1 text-sky-300">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> DTE Only
          </span>
          <span className="flex items-center gap-1 text-red-300">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Blackout
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex items-center gap-1 text-yellow-300">
            <span className="w-2.5 h-0.5 bg-yellow-400 inline-block" /> Sun Ray
          </span>
          <span className="flex items-center gap-1 text-emerald-300">
            <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" /> n̂ Normal (&lt;45°)
          </span>
          <span className="flex items-center gap-1 text-rose-300">
            <span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" /> PSR Cold Trap (&lt;70K)
          </span>
          <span className="text-gray-500 hidden sm:inline">
            • Drag: Orbit | Right-Drag: Pan | Scroll: Zoom
          </span>
        </div>
      </div>
    </div>
  );
};
