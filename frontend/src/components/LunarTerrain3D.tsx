import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Camera, Eye, Mountain, Sun, Radio, Snowflake, Thermometer } from 'lucide-react';
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

const RegolithTerrainMesh: React.FC<TerrainMeshProps> = ({
  terrainGrid,
  verticalExaggeration,
  showPsrOverlay,
  siteLatDeg,
}) => {
  const [diffuseTexture, setDiffuseTexture] = useState<THREE.Texture | null>(null);

  // Load Base64 LROC WAC diffuse texture or FastAPI `/static/` texture URL
  useEffect(() => {
    const backendOrigin = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/api$/, '');
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
  }, [terrainGrid.lroc_texture_base64, terrainGrid.lroc_psr_texture_base64, showPsrOverlay]);

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
        // Highlight Permanently Shadowed Regions (PSRs) in vivid cryogenic blue/purple hue
        colors[idx * 3] = 0.22;
        colors[idx * 3 + 1] = 0.34;
        colors[idx * 3 + 2] = 0.88;
      } else {
        const shade = diffuseTexture ? 0.88 + 0.12 * norm : 0.26 + 0.38 * norm;
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
        roughness={0.91}
        metalness={0.07}
      />
    </mesh>
  );
};

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
        ? azElToVector3(currentStep.earth_az, Math.max(-4, currentStep.earth_el), skyRadius * 0.92)
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
              LOLA {terrainGrid.grid_size}×{terrainGrid.grid_size} DEM • LROC WAC Texture • PSR Cold-Trap Mask
            </p>
          </div>
        </div>

        {/* PSR Hazard Overlay & Camera Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleTogglePsr}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition ${
              showPsr
                ? 'bg-indigo-600/35 text-indigo-200 border-indigo-400 shadow-sm shadow-indigo-500/30'
                : 'bg-[#0B0F19] text-gray-300 border-gray-700 hover:text-white'
            }`}
            title="Highlight Permanently Shadowed Regions (PSRs) & Cryogenic Cold Traps in 3D"
          >
            <Snowflake className={`w-3.5 h-3.5 ${showPsr ? 'text-sky-300 animate-spin' : 'text-indigo-400'}`} />
            {showPsr ? 'PSRs Active' : 'Show PSRs'}
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
              {compactMode ? 'Orbital' : 'Orbital Tactical'}
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
              {compactMode ? 'Surface' : 'Lander Horizon'}
            </button>
          </div>

          <select
            value={verticalExaggeration}
            onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
            className="bg-[#0B0F19] border border-gray-700 rounded-lg px-2 py-1 text-[11px] font-mono text-gray-300"
            title="Vertical Terrain Exaggeration Factor"
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
          compactMode ? 'min-h-[290px]' : 'min-h-[340px]'
        } w-full rounded-lg overflow-hidden bg-[#060911] border border-gray-800/80`}
      >
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

          <ambientLight intensity={currentStep?.sun_visible ? 0.24 : 0.1} color="#94A3B8" />
          <directionalLight
            position={shadowLightPos}
            intensity={currentStep?.sun_visible ? 2.5 * Math.max(0.25, currentStep.sun_fraction) : 0.12}
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
            <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-gray-300 border border-gray-700 text-[10px] font-mono">
              E (90°)
            </span>
          </Html>
          <Html position={[0, 0.4, 9.6]} center distanceFactor={20}>
            <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-gray-300 border border-gray-700 text-[10px] font-mono">
              S (180°)
            </span>
          </Html>
          <Html position={[-9.6, 0.4, 0]} center distanceFactor={20}>
            <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-gray-300 border border-gray-700 text-[10px] font-mono">
              W (270°)
            </span>
          </Html>

          <OrbitControls
            target={cameraMode === 'orbital' ? [0, 0, 0] : [0, 0.4, -3]}
            maxPolarAngle={Math.PI / 2 - 0.02}
            minDistance={1.2}
            maxDistance={28}
            enableDamping
          />
        </Canvas>

        {/* Bottom-Left Telemetry & Diviner Thermal HUD Overlay */}
        <div className="absolute bottom-2 left-2 bg-slate-950/85 backdrop-blur-md border border-gray-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono space-y-0.5 pointer-events-none">
          <div className="flex items-center gap-2.5">
            <span className="text-gray-400">
              Elev: <strong className="text-white">{site.elev_m >= 0 ? `+${site.elev_m}m` : `${site.elev_m}m`}</strong>
            </span>
            <span className="text-gray-400">
              Slope: <strong className="text-white">{terrainGrid.mean_slope_deg ?? 4.5}°</strong>
            </span>
            <span className="text-indigo-300">
              PSR Area: <strong>{terrainGrid.psr_area_percentage ?? 0}%</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`flex items-center gap-1 ${currentStep?.sun_visible ? 'text-amber-400' : 'text-red-400'}`}>
              <Sun className="w-3 h-3" /> {currentStep?.sun_visible ? `${currentStep.power_kw.toFixed(2)}kW` : 'ECLIPSE'}
            </span>
            <span className={`flex items-center gap-1 ${currentStep?.earth_visible ? 'text-sky-400' : 'text-red-400'}`}>
              <Radio className="w-3 h-3" /> {currentStep?.earth_visible ? 'DTE LINK' : 'OCCLUDED'}
            </span>
            {thermalMetrics && (
              <span
                className={`flex items-center gap-1 ${
                  (currentStep?.local_temp_k ?? thermalMetrics.local_temp_k ?? thermalMetrics.temp_min_k) < 70
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-400'
                }`}
              >
                <Thermometer className="w-3 h-3" />{' '}
                {currentStep?.local_temp_k ?? thermalMetrics.local_temp_k ?? thermalMetrics.temp_max_k}K (
                {thermalMetrics.temp_min_k}K–{thermalMetrics.temp_max_k}K)
              </span>
            )}
          </div>
        </div>

        {/* Top-Right PSR Hazard Legend Pill when active */}
        {showPsr && (
          <div className="absolute top-2 right-2 bg-indigo-950/90 border border-indigo-400/60 rounded-md px-2 py-1 text-[10px] font-mono text-indigo-200 flex items-center gap-1.5 pointer-events-none">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />
            Cryo Cold Traps (PSRs &lt;70K) Highlighted
          </div>
        )}
      </div>
    </div>
  );
};
