import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  Camera,
  Eye,
  Mountain,
  Sun,
  Radio,
  Snowflake,
  Thermometer,
  RotateCcw,
} from 'lucide-react';
import type {
  TerrainGridData,
  TimelineStep,
  SolarArrayType,
  LunarSite,
  ThermalMetrics,
} from '../types/mission';

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

function azElToVector3(azDeg: number, elDeg: number, radius: number): [number, number, number] {
  const azRad = (azDeg * Math.PI) / 180;
  const elRad = (elDeg * Math.PI) / 180;
  const horiz = radius * Math.cos(elRad);
  const x = horiz * Math.sin(azRad);
  const z = -horiz * Math.cos(azRad);
  const y = radius * Math.sin(elRad);
  return [x, y, z];
}

interface TerrainMeshProps {
  terrainGrid: TerrainGridData;
  verticalExaggeration: number;
  showPsrOverlay: boolean;
  siteLatDeg: number;
}

const RegolithTerrainMesh: React.FC<TerrainMeshProps> = React.memo(
  ({ terrainGrid, verticalExaggeration, showPsrOverlay, siteLatDeg }) => {
    const [diffuseTexture, setDiffuseTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
      const backendOrigin = (
        import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
      ).replace(/\/api$/, '');
      const staticUrl = showPsrOverlay
        ? terrainGrid.lroc_psr_texture_url
          ? `${backendOrigin}${terrainGrid.lroc_psr_texture_url}`
          : undefined
        : terrainGrid.lroc_texture_url
        ? `${backendOrigin}${terrainGrid.lroc_texture_url}`
        : undefined;

      const uri = showPsrOverlay
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

        if (showPsrOverlay && isColdTrap) {
          colors[idx * 3] = 0.22;
          colors[idx * 3 + 1] = 0.36;
          colors[idx * 3 + 2] = 0.92;
        } else {
          const shade = diffuseTexture ? 0.88 + 0.12 * norm : 0.28 + 0.38 * norm;
          colors[idx * 3] = shade;
          colors[idx * 3 + 1] = shade * 1.01;
          colors[idx * 3 + 2] = shade * 1.04;
        }
      }

      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geom.computeVertexNormals();
      return geom;
    }, [terrainGrid, verticalExaggeration, showPsrOverlay, siteLatDeg, diffuseTexture]);

    return (
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          key={diffuseTexture ? 'textured' : 'vertex'}
          map={diffuseTexture || null}
          vertexColors
          roughness={0.9}
          metalness={0.06}
        />
      </mesh>
    );
  }
);

interface LanderBeaconProps {
  currentStep: TimelineStep;
  arrayType: SolarArrayType;
}

const LanderBeacon: React.FC<LanderBeaconProps> = ({ currentStep, arrayType }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + 0.18 * Math.sin(clock.getElapsedTime() * 3.2);
      ringRef.current.scale.set(s, s, 1);
    }
  });

  const statusColor = currentStep.joint_operational
    ? '#10B981'
    : currentStep.sun_visible
    ? '#F59E0B'
    : currentStep.earth_visible
    ? '#38BDF8'
    : '#EF4444';

  return (
    <group position={[0, 0.04, 0]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.25, 0.38, 32]} />
        <meshBasicMaterial color={statusColor} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>

      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 0.24, 8]} />
        <meshStandardMaterial color="#E5E7EB" metalness={0.5} roughness={0.3} />
      </mesh>

      {arrayType === 'vertical_cylindrical' && (
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.45, 16]} />
          <meshStandardMaterial
            color="#F59E0B"
            emissive={currentStep.sun_visible ? '#78350F' : '#000000'}
            metalness={0.6}
            roughness={0.25}
          />
        </mesh>
      )}

      {arrayType === 'dual_axis_tracking' && (
        <group position={[0, 0.36, 0]} rotation={[0, (-currentStep.sun_az * Math.PI) / 180, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.52, 0.22, 0.03]} />
            <meshStandardMaterial
              color="#38BDF8"
              emissive={currentStep.sun_visible ? '#0C4A6E' : '#000000'}
              metalness={0.7}
              roughness={0.2}
            />
          </mesh>
        </group>
      )}

      {arrayType === 'horizontal_deck' && (
        <mesh position={[0, 0.27, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
          <circleGeometry args={[0.26, 16]} />
          <meshStandardMaterial
            color="#60A5FA"
            emissive={currentStep.sun_visible ? '#1E3A8A' : '#000000'}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      )}
    </group>
  );
};

export const LunarTerrain3D: React.FC<LunarTerrain3DProps> = React.memo(
  ({
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
    const controlsRef = useRef<OrbitControlsImpl>(null);

    const showPsr = externalShowPsr !== undefined ? externalShowPsr : internalShowPsr;
    const handleTogglePsr = () => {
      const next = !showPsr;
      if (onTogglePsr) onTogglePsr(next);
      else setInternalShowPsr(next);
    };

    const currentStep = timeline[currentStepIndex] || timeline[0];
    const skyRadius = 12.5;

    const sunPos = useMemo(
      () =>
        currentStep
          ? azElToVector3(currentStep.sun_az, Math.max(-4, currentStep.sun_el), skyRadius)
          : ([0, 5, -10] as [number, number, number]),
      [currentStep]
    );

    const earthPos = useMemo(
      () =>
        currentStep
          ? azElToVector3(
              currentStep.earth_az,
              Math.max(-4, currentStep.earth_el),
              skyRadius * 0.92
            )
          : ([0, 4, -10] as [number, number, number]),
      [currentStep]
    );

    const shadowLightPos = useMemo(() => {
      if (!currentStep) return [0, 4, -12] as [number, number, number];
      const effectiveEl = Math.max(1.2, currentStep.sun_el + 1.5);
      return azElToVector3(currentStep.sun_az, effectiveEl, 18.0);
    }, [currentStep]);

    const sunArcPoints = useMemo(() => {
      return timeline.map((s) =>
        azElToVector3(s.sun_az, Math.max(-3, s.sun_el), skyRadius)
      );
    }, [timeline]);

    const earthArcPoints = useMemo(() => {
      return timeline.map((s) =>
        azElToVector3(s.earth_az, Math.max(-3, s.earth_el), skyRadius * 0.92)
      );
    }, [timeline]);

    return (
      <div className="relative h-full w-full rounded-xl overflow-hidden bg-[#05070E] border border-slate-800 shadow-xl">
        {/* Top-Left Floating Glassmorphism Site & Coordinates HUD */}
        <div className="absolute top-3 left-3 z-20 hud-glass rounded-xl px-3 py-2 max-w-[62%] pointer-events-auto">
          <div className="flex items-center gap-2">
            <Mountain className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            {scenarioBadge && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                {scenarioBadge}
              </span>
            )}
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono truncate">
              {site.name}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono text-slate-300 mt-1">
            <span>
              {site.lat_deg >= 0 ? `+${site.lat_deg.toFixed(2)}°N` : `${site.lat_deg.toFixed(2)}°S`},{' '}
              {site.lon_deg.toFixed(1)}°E
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Elev{' '}
              <strong className="text-white">
                {site.elev_m >= 0 ? `+${site.elev_m}m` : `${site.elev_m}m`}
              </strong>
            </span>
            {!compactMode && (
              <>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">
                  LOLA {terrainGrid.grid_size}×{terrainGrid.grid_size}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Top-Right Floating Glassmorphism Viewport Controls */}
        <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center justify-end gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={handleTogglePsr}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold backdrop-blur-md border transition shadow-lg ${
              showPsr
                ? 'bg-indigo-600/80 text-white border-indigo-400'
                : 'bg-[#0B0F19]/80 text-slate-200 border-slate-700/80 hover:border-slate-500'
            }`}
            title="Toggle Permanently Shadowed Regions (PSRs <70K) Cold-Trap Overlay"
          >
            <Snowflake className={`w-3.5 h-3.5 ${showPsr ? 'text-sky-200 animate-spin' : 'text-indigo-400'}`} />
            <span>{showPsr ? 'PSRs On' : 'PSRs'}</span>
          </button>

          <div className="inline-flex rounded-lg bg-[#0B0F19]/80 backdrop-blur-md p-0.5 border border-slate-700/80 text-[11px] font-mono shadow-lg">
            <button
              type="button"
              onClick={() => setCameraMode('orbital')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                cameraMode === 'orbital'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Tactical Orbital Overhead Camera"
            >
              <Camera className="w-3 h-3" />
              <span>Orbit</span>
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('surface')}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                cameraMode === 'surface'
                  ? 'bg-sky-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Lander Horizon Eye-Level View"
            >
              <Eye className="w-3 h-3" />
              <span>Horizon</span>
            </button>
          </div>

          <select
            value={verticalExaggeration}
            onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
            className="bg-[#0B0F19]/80 backdrop-blur-md border border-slate-700/80 rounded-lg px-2 py-1.5 text-[11px] font-mono text-slate-200 shadow-lg focus:outline-none cursor-pointer"
            title="Vertical Terrain Relief Exaggeration"
          >
            <option value={1}>1.0x</option>
            <option value={2.5}>2.5x</option>
            <option value={4}>4.0x</option>
          </select>

          <button
            type="button"
            onClick={() => controlsRef.current?.reset()}
            className="p-1.5 rounded-lg bg-[#0B0F19]/80 backdrop-blur-md border border-slate-700/80 text-slate-300 hover:text-white shadow-lg transition"
            title="Reset 3D Camera Angle"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3D WebGL Canvas */}
        <div className={`w-full h-full ${compactMode ? 'min-h-[320px]' : 'min-h-[420px]'}`}>
          <Canvas
            shadows
            key={cameraMode}
            camera={{
              position: cameraMode === 'orbital' ? [0, 9.5, 13.5] : [0, 0.65, 2.2],
              fov: cameraMode === 'orbital' ? 45 : 55,
              near: 0.1,
              far: 100,
            }}
          >
            <color attach="background" args={['#05070E']} />
            <Stars radius={50} depth={30} count={1400} factor={2.5} saturation={0} fade />

            {/* Soft ambient fill light keeps shadowed crater walls legible */}
            <ambientLight intensity={currentStep?.sun_visible ? 0.3 : 0.14} color="#94A3B8" />
            <directionalLight
              position={shadowLightPos}
              intensity={
                currentStep?.sun_visible ? 2.5 * Math.max(0.25, currentStep.sun_fraction) : 0.14
              }
              color={currentStep?.sun_visible ? '#FDE68A' : '#EF4444'}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
              shadow-camera-near={1}
              shadow-camera-far={40}
              shadow-camera-left={-12}
              shadow-camera-right={12}
              shadow-camera-top={12}
              shadow-camera-bottom={-12}
            />

            <RegolithTerrainMesh
              terrainGrid={terrainGrid}
              verticalExaggeration={verticalExaggeration}
              showPsrOverlay={showPsr}
              siteLatDeg={site.lat_deg}
            />

            {currentStep && (
              <LanderBeacon currentStep={currentStep} arrayType={arrayType} />
            )}

            {sunArcPoints.length > 1 && (
              <Line
                points={sunArcPoints}
                color="#F59E0B"
                lineWidth={1.5}
                transparent
                opacity={0.55}
              />
            )}
            <Line
              points={[[0, 0.25, 0], sunPos]}
              color={currentStep?.sun_visible ? '#F59E0B' : '#EF4444'}
              lineWidth={1.8}
              dashed={!currentStep?.sun_visible}
            />
            <mesh position={sunPos}>
              <sphereGeometry args={[0.42, 20, 20]} />
              <meshBasicMaterial color={currentStep?.sun_visible ? '#FBBF24' : '#DC2626'} />
              <Html distanceFactor={18} position={[0, 0.65, 0]} center>
                <span className="px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-500/50 text-[10px] font-mono whitespace-nowrap">
                  SUN {currentStep?.sun_el.toFixed(1)}°
                </span>
              </Html>
            </mesh>

            {earthArcPoints.length > 1 && (
              <Line
                points={earthArcPoints}
                color="#38BDF8"
                lineWidth={1.6}
                transparent
                opacity={0.65}
              />
            )}
            <Line
              points={[[0, 0.25, 0], earthPos]}
              color={currentStep?.earth_visible ? '#38BDF8' : '#EF4444'}
              lineWidth={1.6}
              dashed={!currentStep?.earth_visible}
            />
            <mesh position={earthPos}>
              <sphereGeometry args={[0.36, 20, 20]} />
              <meshBasicMaterial color={currentStep?.earth_visible ? '#38BDF8' : '#991B1B'} />
              <Html distanceFactor={18} position={[0, 0.6, 0]} center>
                <span className="px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-500/50 text-[10px] font-mono whitespace-nowrap">
                  EARTH {currentStep?.earth_el.toFixed(1)}°
                </span>
              </Html>
            </mesh>

            <Html position={[0, 0.4, -9.6]} center distanceFactor={20}>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/90 text-sky-400 border border-sky-500/40 text-[10px] font-mono font-bold">
                N (0° EARTH)
              </span>
            </Html>
            <Html position={[9.6, 0.4, 0]} center distanceFactor={20}>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-700 text-[10px] font-mono">
                E (90°)
              </span>
            </Html>
            <Html position={[0, 0.4, 9.6]} center distanceFactor={20}>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-700 text-[10px] font-mono">
                S (180°)
              </span>
            </Html>
            <Html position={[-9.6, 0.4, 0]} center distanceFactor={20}>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-700 text-[10px] font-mono">
                W (270°)
              </span>
            </Html>

            <OrbitControls
              ref={controlsRef}
              target={cameraMode === 'orbital' ? [0, 0, 0] : [0, 0.4, -3]}
              maxPolarAngle={Math.PI / 2 - 0.02}
              minDistance={1.2}
              maxDistance={28}
              enableDamping
            />
          </Canvas>
        </div>

        {/* Bottom-Left Floating Glassmorphism Telemetry & Diviner Thermal Pill */}
        <div className="absolute bottom-3 left-3 z-20 hud-glass rounded-xl px-3 py-1.5 text-[10px] font-mono space-y-1 pointer-events-none">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-slate-400">
              Mean Slope: <strong className="text-white">{terrainGrid.mean_slope_deg ?? 4.5}°</strong>
            </span>
            <span className="text-indigo-300">
              PSR Cold Traps: <strong>{terrainGrid.psr_area_percentage ?? 0}%</strong>
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
                <Thermometer className="w-3 h-3" />
                {currentStep?.local_temp_k ??
                  thermalMetrics.local_temp_k ??
                  thermalMetrics.temp_max_k}
                K ({thermalMetrics.temp_min_k}–{thermalMetrics.temp_max_k}K)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1 font-semibold ${
                currentStep?.sun_visible ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              <Sun className="w-3 h-3" />
              {currentStep?.sun_visible ? `${currentStep.power_kw.toFixed(2)} kW` : 'SOLAR ECLIPSE'}
            </span>
            <span
              className={`flex items-center gap-1 font-semibold ${
                currentStep?.earth_visible ? 'text-sky-400' : 'text-rose-400'
              }`}
            >
              <Radio className="w-3 h-3" />
              {currentStep?.earth_visible ? 'DTE LINK LOCK' : 'EARTH OCCLUDED'}
            </span>
          </div>
        </div>

        {/* Bottom-Right PSR Legend Badge when active */}
        {showPsr && (
          <div className="absolute bottom-3 right-3 z-20 bg-indigo-950/90 backdrop-blur-md border border-indigo-400/60 rounded-lg px-2.5 py-1 text-[10px] font-mono text-indigo-200 flex items-center gap-1.5 pointer-events-none shadow-lg">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
            <span>Cryogenic Cold Traps (&lt;70K)</span>
          </div>
        )}
      </div>
    );
  }
);