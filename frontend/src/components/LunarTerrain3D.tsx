import React, { useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Camera, Eye, Mountain, Sun, Radio } from 'lucide-react';
import type {
  TerrainGridData,
  TimelineStep,
  SolarArrayType,
  LunarSite,
} from '../types/mission';

interface LunarTerrain3DProps {
  site: LunarSite;
  terrainGrid: TerrainGridData;
  timeline: TimelineStep[];
  currentStepIndex: number;
  arrayType: SolarArrayType;
}

// Convert topocentric (az_deg, el_deg, radius) to Three.js world coordinates
// Convention in our Three.js scene:
//   +X = East, -X = West
//   +Z = South, -Z = North (so Azimuth 0° North is along -Z, Azimuth 90° East is along +X)
//   +Y = Up (Elevation)
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
}

const RegolithTerrainMesh: React.FC<TerrainMeshProps> = ({
  terrainGrid,
  verticalExaggeration,
}) => {
  const geometry = useMemo(() => {
    const N = terrainGrid.grid_size;
    const elevations = terrainGrid.elevations_m;
    const baseElev = terrainGrid.lander_pos.z_m;
    // Scene width = 20 units (1 unit = 1 km)
    const patchSizeScene = 20.0;
    const geom = new THREE.PlaneGeometry(patchSizeScene, patchSizeScene, N - 1, N - 1);
    geom.rotateX(-Math.PI / 2);

    const posAttr = geom.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const minE = terrainGrid.min_elev_m;
    const maxE = Math.max(minE + 10, terrainGrid.max_elev_m);

    for (let idx = 0; idx < posAttr.count; idx++) {
      // PlaneGeometry vertices go row by row from top (-Z, North) to bottom (+Z, South)
      const col = idx % N;
      const rowFromNorth = Math.floor(idx / N);
      // In our backend, row i=0 is South (-10km) and row i=N-1 is North (+10km)
      const demRow = N - 1 - rowFromNorth;
      const zMeters = elevations[demRow]?.[col] ?? baseElev;
      const relKm = ((zMeters - baseElev) / 1000.0) * verticalExaggeration;

      posAttr.setY(idx, relKm);

      // Subtle regolith albedo + elevation shading
      const norm = Math.max(0, Math.min(1, (zMeters - minE) / (maxE - minE)));
      const shade = 0.26 + 0.36 * norm;
      colors[idx * 3] = shade;
      colors[idx * 3 + 1] = shade * 1.01;
      colors[idx * 3 + 2] = shade * 1.05;
    }

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }, [terrainGrid, verticalExaggeration]);

  return (
    <mesh geometry={geometry} receiveShadow castShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.93}
        metalness={0.06}
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
    ? '#10B981' // Green: Power + DTE Comms
    : currentStep.sun_visible
    ? '#F59E0B' // Gold: Power Only
    : currentStep.earth_visible
    ? '#38BDF8' // Cyan: Comms Only (Battery Draw)
    : '#EF4444'; // Red: Full Eclipse & Comms Blackout

  return (
    <group position={[0, 0.04, 0]}>
      {/* Animated Telemetry Ring on Surface */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.25, 0.38, 32]} />
        <meshBasicMaterial color={statusColor} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>

      {/* Lander Base Structure */}
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 0.24, 8]} />
        <meshStandardMaterial color="#E5E7EB" metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Hardware-Specific Solar Array Geometry Visual */}
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
        <group position={[0, 0.36, 0]} rotation={[0, ((-currentStep.sun_az * Math.PI) / 180), 0]}>
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
}) => {
  const [cameraMode, setCameraMode] = useState<'orbital' | 'surface'>('orbital');
  const [verticalExaggeration, setVerticalExaggeration] = useState<number>(2.5);

  const currentStep = timeline[currentStepIndex] || timeline[0];
  const skyRadius = 12.5;

  // Sun and Earth 3D sky-dome positions
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

  // Directional shadow light positioned slightly higher when grazing so Three.js shadow map casts long crater shadows cleanly
  const shadowLightPos = useMemo(() => {
    if (!currentStep) return [0, 4, -12] as [number, number, number];
    const effectiveEl = Math.max(1.2, currentStep.sun_el + 1.5);
    return azElToVector3(currentStep.sun_az, effectiveEl, 18.0);
  }, [currentStep]);

  // Sun trajectory 3D polyline points
  const sunArcPoints = useMemo(() => {
    return timeline.map((s) =>
      azElToVector3(s.sun_az, Math.max(-3, s.sun_el), skyRadius)
    );
  }, [timeline]);

  // Earth libration 3D polyline points
  const earthArcPoints = useMemo(() => {
    return timeline.map((s) =>
      azElToVector3(s.earth_az, Math.max(-3, s.earth_el), skyRadius * 0.92)
    );
  }, [timeline]);

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-3.5 flex flex-col justify-between h-full shadow-lg relative overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-2 mb-2 z-10">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-amber-400" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              3D Lunar Terrain DEM & Grazing Ray-Cast Simulator
            </h2>
            <p className="text-[11px] text-gray-400">
              {site.name} • 20 km × 20 km Patch (64×64 LOLA Grid)
            </p>
          </div>
        </div>

        {/* Camera & Relief Controls */}
        <div className="flex items-center gap-1.5">
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
              Orbital Tactical
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
              Lander Horizon
            </button>
          </div>

          <select
            value={verticalExaggeration}
            onChange={(e) => setVerticalExaggeration(Number(e.target.value))}
            className="bg-[#0B0F19] border border-gray-700 rounded-lg px-2 py-1 text-[11px] font-mono text-gray-300"
            title="Vertical Terrain Exaggeration Factor"
          >
            <option value={1}>1.0x True Scale</option>
            <option value={2.5}>2.5x LOLA Relief</option>
            <option value={4}>4.0x Deep Relief</option>
          </select>
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div className="relative flex-1 min-h-[300px] w-full rounded-lg overflow-hidden bg-[#060911] border border-gray-800/80">
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
          <Stars radius={50} depth={30} count={1500} factor={2.5} saturation={0} fade />

          {/* Ambient & Grazing Solar Directional Illumination */}
          <ambientLight intensity={currentStep?.sun_visible ? 0.22 : 0.09} color="#94A3B8" />
          <directionalLight
            position={shadowLightPos}
            intensity={currentStep?.sun_visible ? 2.4 * Math.max(0.25, currentStep.sun_fraction) : 0.12}
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

          {/* 64x64 Displaced Lunar Regolith Terrain Mesh */}
          <RegolithTerrainMesh
            terrainGrid={terrainGrid}
            verticalExaggeration={verticalExaggeration}
          />

          {/* Central Lander & Solar Array Beacon */}
          {currentStep && (
            <LanderBeacon currentStep={currentStep} arrayType={arrayType} />
          )}

          {/* Sun Sky-Dome Trajectory & Glowing Solar Sphere */}
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

          {/* Earth Libration Trajectory & Blue-Marbled Earth Sphere */}
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

          {/* Compass Cardinal Markers at Patch Perimeter */}
          <Html position={[0, 0.4, -9.6]} center distanceFactor={20}>
            <span className="px-1.5 py-0.5 rounded bg-slate-900/90 text-sky-400 border border-sky-500/40 text-[10px] font-mono font-bold">
              N (0° EARTHWARD)
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

        {/* HUD Overlay Badge in Bottom-Left of 3D Viewport */}
        <div className="absolute bottom-2.5 left-2.5 bg-slate-950/85 backdrop-blur-md border border-gray-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono space-y-0.5 pointer-events-none">
          <div className="flex items-center gap-3">
            <span className="text-gray-400">
              Lander Datum: <strong className="text-white">{site.elev_m >= 0 ? `+${site.elev_m}m` : `${site.elev_m}m`}</strong>
            </span>
            <span className="text-gray-400">
              Coords: <strong className="text-white">{site.lat_deg}°, {site.lon_deg}°</strong>
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-amber-400">
              <Sun className="w-3 h-3" /> Ray: {currentStep?.sun_visible ? 'ILLUMINATED' : 'OCCLUDED BY TERRAIN'}
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <Radio className="w-3 h-3" /> Link: {currentStep?.earth_visible ? 'DTE ACTIVE' : 'TERRAIN MASKED'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Instructions */}
      <div className="pt-2 flex flex-wrap items-center justify-between text-[11px] text-gray-400">
        <span>Drag to orbit 3D DEM • Scroll to zoom • Right-click to pan</span>
        <span className="font-mono text-gray-300">
          Beacon Ring:{' '}
          <strong className="text-emerald-400">Green=Both</strong> •{' '}
          <strong className="text-amber-400">Gold=Sun</strong> •{' '}
          <strong className="text-red-400">Red=Eclipse</strong>
        </span>
      </div>
    </div>
  );
};
