import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SolarArrayType, TimelineStep } from '../types/mission';

export interface LanderModel3DProps {
  currentStep: TimelineStep;
  arrayType: SolarArrayType;
  showEducationalVectors: boolean;
  cinematicMode: boolean;
}

export function azElToDirectionVector(azDeg: number, elDeg: number): THREE.Vector3 {
  const azRad = (azDeg * Math.PI) / 180;
  const elRad = (elDeg * Math.PI) / 180;
  const cosEl = Math.cos(elRad);
  const x = cosEl * Math.sin(azRad);
  const y = Math.sin(elRad);
  const z = -cosEl * Math.cos(azRad);
  return new THREE.Vector3(x, y, z).normalize();
}

/**
 * Generates a crinkled Gold Kapton Multi-Layer Insulation (MLI) normal map
 * and a detailed Photovoltaic Solar Cell Grid texture for realistic spacecraft rendering.
 */
function createSpacecraftTextures(): {
  kaptonNormalMap: THREE.DataTexture;
  solarCellTexture: THREE.CanvasTexture;
} {
  // 1. Crinkled Kapton Foil Normal Map (128x128)
  const size = 128;
  const nData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Multi-frequency crinkle facets
      const c1 = Math.sin(x * 0.45 + y * 0.35) * Math.cos(x * 0.25 - y * 0.55);
      const c2 = Math.sin(x * 1.1 - y * 0.9) * 0.45;
      const nx = (c1 + c2) * 0.45;
      const ny = (Math.cos(x * 0.5 + y * 0.4) - c2) * 0.45;
      const nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
      const idx = (y * size + x) * 4;
      nData[idx] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      nData[idx + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      nData[idx + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      nData[idx + 3] = 255;
    }
  }
  const kaptonNormalMap = new THREE.DataTexture(nData, size, size, THREE.RGBAFormat);
  kaptonNormalMap.wrapS = THREE.RepeatWrapping;
  kaptonNormalMap.wrapT = THREE.RepeatWrapping;
  kaptonNormalMap.repeat.set(3, 3);
  kaptonNormalMap.needsUpdate = true;

  // 2. Photovoltaic Solar Cell Wafer Grid Texture (256x256)
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Deep sapphire triple-junction GaAs solar cell base
    ctx.fillStyle = '#0B2559';
    ctx.fillRect(0, 0, 256, 256);

    const cols = 8;
    const rows = 16;
    const cw = 256 / cols;
    const ch = 256 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = c * cw;
        const y0 = r * ch;
        // Cell wafer fill with subtle blue-violet sheen
        ctx.fillStyle = (r + c) % 2 === 0 ? '#0F3175' : '#123885';
        ctx.fillRect(x0 + 1.5, y0 + 1.2, cw - 3, ch - 2.4);

        // Fine silver finger busbar line across cell
        ctx.fillStyle = 'rgba(186, 230, 253, 0.35)';
        ctx.fillRect(x0 + 2, y0 + ch * 0.5, cw - 4, 0.8);
      }
    }

    // Metallic silver cell interconnect grid lines
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 1.5;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cw, 0);
      ctx.lineTo(c * cw, 256);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ch);
      ctx.lineTo(256, r * ch);
      ctx.stroke();
    }
  }

  const solarCellTexture = new THREE.CanvasTexture(canvas);
  solarCellTexture.colorSpace = THREE.SRGBColorSpace;
  solarCellTexture.wrapS = THREE.RepeatWrapping;
  solarCellTexture.wrapT = THREE.RepeatWrapping;
  solarCellTexture.needsUpdate = true;

  return { kaptonNormalMap, solarCellTexture };
}

export const LanderModel3D: React.FC<LanderModel3DProps> = ({
  currentStep,
  arrayType,
  showEducationalVectors,
  cinematicMode,
}) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const trackingGimbalRef = useRef<THREE.Group>(null);
  const modelGroupRef = useRef<THREE.Group>(null);

  const { kaptonNormalMap, solarCellTexture } = useMemo(() => createSpacecraftTextures(), []);

  // Compute exact 3D unit vector pointing toward the Sun
  const sunUnitVec = useMemo(() => {
    return azElToDirectionVector(currentStep.sun_az, currentStep.sun_el);
  }, [currentStep.sun_az, currentStep.sun_el]);

  // Compute the active solar panel's surface Normal Vector & Angle of Incidence (deg)
  const { panelNormalVec, incidenceAngleDeg, cosineEfficiencyPct, panelOriginY } = useMemo(() => {
    const clampedSunVec = azElToDirectionVector(
      currentStep.sun_az,
      Math.max(0.0, currentStep.sun_el)
    );

    if (arrayType === 'horizontal_deck') {
      const normal = new THREE.Vector3(0, 1, 0);
      const dot = Math.max(-1, Math.min(1, normal.dot(clampedSunVec)));
      const angleDeg = (Math.acos(dot) * 180) / Math.PI;
      const eff = currentStep.sun_visible ? Math.max(0, dot) * 100 : 0;
      return {
        panelNormalVec: normal,
        incidenceAngleDeg: angleDeg,
        cosineEfficiencyPct: eff,
        panelOriginY: 0.34,
      };
    }

    if (arrayType === 'vertical_cylindrical') {
      const azRad = (currentStep.sun_az * Math.PI) / 180;
      const normal = new THREE.Vector3(Math.sin(azRad), 0, -Math.cos(azRad)).normalize();
      const dot = Math.max(-1, Math.min(1, normal.dot(clampedSunVec)));
      const angleDeg = (Math.acos(dot) * 180) / Math.PI;
      const eff = currentStep.sun_visible ? Math.max(0, dot) * 100 : 0;
      return {
        panelNormalVec: normal,
        incidenceAngleDeg: angleDeg,
        cosineEfficiencyPct: eff,
        panelOriginY: 0.56,
      };
    }

    const normal = clampedSunVec.clone().normalize();
    return {
      panelNormalVec: normal,
      incidenceAngleDeg: 0.0,
      cosineEfficiencyPct: currentStep.sun_visible ? 100.0 : 0.0,
      panelOriginY: 0.68,
    };
  }, [arrayType, currentStep.sun_az, currentStep.sun_el, currentStep.sun_visible]);

  useEffect(() => {
    if (arrayType === 'dual_axis_tracking' && trackingGimbalRef.current) {
      const targetWorldPos = new THREE.Vector3()
        .copy(panelNormalVec)
        .multiplyScalar(10)
        .add(new THREE.Vector3(0, 0.68, 0));
      trackingGimbalRef.current.lookAt(targetWorldPos);
    }
  }, [arrayType, panelNormalVec, currentStep.step_index]);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const s = 1 + 0.12 * Math.sin(clock.getElapsedTime() * 2.8);
      ringRef.current.scale.set(s, s, 1);
    }
    if (arrayType === 'dual_axis_tracking' && trackingGimbalRef.current) {
      const targetLocal = panelNormalVec.clone().multiplyScalar(5);
      const dummy = new THREE.Object3D();
      dummy.position.set(0, 0, 0);
      dummy.lookAt(targetLocal);
      trackingGimbalRef.current.quaternion.slerp(dummy.quaternion, 0.35);
    }
  });

  const statusColor = currentStep.joint_operational
    ? '#10B981'
    : currentStep.sun_visible
    ? '#F59E0B'
    : currentStep.earth_visible
    ? '#38BDF8'
    : '#EF4444';

  const goldFoilEmissive =
    currentStep.sun_visible && cinematicMode ? '#B45309' : '#1F1204';
  const goldFoilEmissiveIntensity =
    currentStep.sun_visible && cinematicMode ? 0.52 : 0.08;

  const originPoint: [number, number, number] = [0, panelOriginY, 0];
  const sunRayLength = 2.65;
  const normalRayLength = 1.65;

  const sunVectorTip: [number, number, number] = [
    sunUnitVec.x * sunRayLength,
    panelOriginY + Math.max(-0.15, sunUnitVec.y * sunRayLength),
    sunUnitVec.z * sunRayLength,
  ];

  const normalVectorTip: [number, number, number] = [
    panelNormalVec.x * normalRayLength,
    panelOriginY + panelNormalVec.y * normalRayLength,
    panelNormalVec.z * normalRayLength,
  ];

  const labelPos: [number, number, number] = [
    (panelNormalVec.x * 1.15 + sunUnitVec.x * 1.15) * 0.5,
    panelOriginY + (panelNormalVec.y * 1.15 + Math.max(0, sunUnitVec.y) * 1.15) * 0.5 + 0.32,
    (panelNormalVec.z * 1.15 + sunUnitVec.z * 1.15) * 0.5,
  ];

  const isOptimalIncidence = incidenceAngleDeg < 45 && currentStep.sun_visible;
  const normalVectorColor = isOptimalIncidence ? '#10B981' : '#EF4444';

  const legAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

  return (
    <group ref={modelGroupRef} position={[0, 0.02, 0]}>
      {/* Ground Operational Status Telemetry Ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.42, 0.53, 48]} />
        <meshBasicMaterial
          color={statusColor}
          side={THREE.DoubleSide}
          transparent
          opacity={0.82}
        />
      </mesh>

      {/* Main Descent Engine Nozzle Bell beneath Chassis */}
      <mesh position={[0, 0.065, 0]} castShadow>
        <coneGeometry args={[0.075, 0.09, 20, 1, true]} />
        <meshStandardMaterial
          color="#334155"
          metalness={0.88}
          roughness={0.28}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Shared 4-Point Lunar Landing Gear A-Frame Struts & Dish Footpads */}
      {legAngles.map((angle, idx) => {
        const footX = Math.cos(angle) * 0.36;
        const footZ = Math.sin(angle) * 0.36;
        return (
          <group key={idx}>
            {/* Dish Footpad + Crushable Shock Absorber Cone */}
            <mesh position={[footX, 0.018, footZ]} castShadow receiveShadow>
              <cylinderGeometry args={[0.062, 0.072, 0.022, 20]} />
              <meshStandardMaterial color="#D97706" metalness={0.78} roughness={0.3} />
            </mesh>
            {/* Primary Telescopic Strut */}
            <mesh
              position={[footX * 0.62, 0.13, footZ * 0.62]}
              rotation={[Math.sin(angle) * 0.56, 0, -Math.cos(angle) * 0.56]}
              castShadow
            >
              <cylinderGeometry args={[0.015, 0.018, 0.34, 12]} />
              <meshStandardMaterial color="#E2E8F0" metalness={0.85} roughness={0.22} />
            </mesh>
            {/* Lower Secondary A-Frame Brace */}
            <mesh
              position={[footX * 0.55, 0.08, footZ * 0.55]}
              rotation={[Math.sin(angle) * 1.15, 0, -Math.cos(angle) * 1.15]}
              castShadow
            >
              <cylinderGeometry args={[0.009, 0.009, 0.24, 8]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        );
      })}

      {/* =====================================================================
          MODEL 1: VERTICAL CYLINDRICAL (Intuitive Machines Nova-C Style)
         ===================================================================== */}
      {arrayType === 'vertical_cylindrical' && (
        <group>
          {/* Lower Crinkled Gold Kapton MLI Propulsion Cylinder */}
          <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.175, 0.19, 0.34, 24]} />
            <meshStandardMaterial
              color="#F59E0B"
              normalMap={kaptonNormalMap}
              normalScale={new THREE.Vector2(0.85, 0.85)}
              emissive={goldFoilEmissive}
              emissiveIntensity={goldFoilEmissiveIntensity}
              metalness={0.82}
              roughness={0.24}
            />
          </mesh>

          {/* Upper 360° Body-Mounted Photovoltaic Solar Array Drum */}
          <mesh position={[0, 0.60, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.17, 0.17, 0.32, 32]} />
            <meshStandardMaterial
              map={solarCellTexture}
              color="#E0F2FE"
              emissive={currentStep.sun_visible ? '#1E3A8A' : '#000000'}
              emissiveIntensity={currentStep.sun_visible ? 0.38 : 0}
              metalness={0.72}
              roughness={0.14}
            />
          </mesh>

          {/* Gold Structural Separation Rings */}
          <mesh position={[0, 0.44, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.025, 24]} />
            <meshStandardMaterial
              color="#FBBF24"
              emissive={goldFoilEmissive}
              emissiveIntensity={goldFoilEmissiveIntensity * 1.1}
              metalness={0.88}
              roughness={0.18}
            />
          </mesh>

          {/* Top Avionics Deck & DTE High-Gain Parabolic Dish */}
          <mesh position={[0, 0.78, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.17, 0.05, 24]} />
            <meshStandardMaterial
              color="#F59E0B"
              normalMap={kaptonNormalMap}
              emissive={goldFoilEmissive}
              emissiveIntensity={goldFoilEmissiveIntensity}
              metalness={0.82}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[0.06, 0.88, 0]} rotation={[0.35, 0, 0]} castShadow>
            <coneGeometry args={[0.068, 0.085, 24, 1, true]} />
            <meshStandardMaterial
              color="#F8FAFC"
              side={THREE.DoubleSide}
              metalness={0.65}
              roughness={0.22}
            />
          </mesh>
        </group>
      )}

      {/* =====================================================================
          MODEL 2: HORIZONTAL DECK (Apollo LM Descent Stage Style)
         ===================================================================== */}
      {arrayType === 'horizontal_deck' && (
        <group>
          {/* Wide Octagonal Descent Stage Base (Crinkled Gold Kapton MLI Foil) */}
          <mesh position={[0, 0.19, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.31, 0.33, 0.22, 8]} />
            <meshStandardMaterial
              color="#F59E0B"
              normalMap={kaptonNormalMap}
              normalScale={new THREE.Vector2(0.9, 0.9)}
              emissive={goldFoilEmissive}
              emissiveIntensity={goldFoilEmissiveIntensity}
              metalness={0.82}
              roughness={0.24}
            />
          </mesh>

          {/* Metallic Octagonal Rim Bezel */}
          <mesh position={[0, 0.305, 0]} castShadow>
            <cylinderGeometry args={[0.322, 0.322, 0.02, 8]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.8} roughness={0.25} />
          </mesh>

          {/* Flat Top-Facing Horizontal Photovoltaic Solar Deck (Faces +Y Zenith) */}
          <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.295, 0.295, 0.018, 8]} />
            <meshStandardMaterial
              map={solarCellTexture}
              color="#E0F2FE"
              emissive={currentStep.sun_visible ? '#1E3A8A' : '#000000'}
              emissiveIntensity={currentStep.sun_visible ? 0.22 : 0}
              metalness={0.7}
              roughness={0.15}
            />
          </mesh>

          {/* Center Avionics Hub & Comms Mast */}
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 0.05, 8]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.75} roughness={0.28} />
          </mesh>
        </group>
      )}

      {/* =====================================================================
          MODEL 3: DUAL-AXIS TRACKING (Gimbaled Solar Mast Style)
         ===================================================================== */}
      {arrayType === 'dual_axis_tracking' && (
        <group>
          {/* Base Rover / Lander Avionics Chassis */}
          <mesh position={[0, 0.19, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.215, 0.24, 0.20, 8]} />
            <meshStandardMaterial
              color="#F59E0B"
              normalMap={kaptonNormalMap}
              normalScale={new THREE.Vector2(0.85, 0.85)}
              emissive={goldFoilEmissive}
              emissiveIntensity={goldFoilEmissiveIntensity}
              metalness={0.82}
              roughness={0.24}
            />
          </mesh>

          {/* Central Vertical Tracking Mast */}
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.032, 0.042, 0.48, 16]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.85} roughness={0.2} />
          </mesh>

          {/* 2-Axis Gimbal Hub at Mast Top (Continuously lookAt()s the 3D Sun Vector) */}
          <group ref={trackingGimbalRef} position={[0, 0.68, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.056, 16, 16]} />
              <meshStandardMaterial color="#FBBF24" metalness={0.88} roughness={0.18} />
            </mesh>

            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, 0.80, 12]} />
              <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.22} />
            </mesh>

            {/* Left Photovoltaic Solar Wing */}
            <mesh position={[-0.235, 0, 0.015]} castShadow receiveShadow>
              <boxGeometry args={[0.33, 0.25, 0.018]} />
              <meshStandardMaterial
                map={solarCellTexture}
                color="#E0F2FE"
                emissive={currentStep.sun_visible ? '#0369A1' : '#000000'}
                emissiveIntensity={currentStep.sun_visible ? 0.55 : 0}
                metalness={0.72}
                roughness={0.12}
              />
            </mesh>

            {/* Right Photovoltaic Solar Wing */}
            <mesh position={[0.235, 0, 0.015]} castShadow receiveShadow>
              <boxGeometry args={[0.33, 0.25, 0.018]} />
              <meshStandardMaterial
                map={solarCellTexture}
                color="#E0F2FE"
                emissive={currentStep.sun_visible ? '#0369A1' : '#000000'}
                emissiveIntensity={currentStep.sun_visible ? 0.55 : 0}
                metalness={0.72}
                roughness={0.12}
              />
            </mesh>
          </group>
        </group>
      )}

      {/* 2.2 EDUCATIONAL INCIDENCE VECTORS */}
      {showEducationalVectors && (
        <group>
          <Line
            points={[sunVectorTip, originPoint]}
            color="#FACC15"
            lineWidth={3.0}
            dashed={!currentStep.sun_visible}
          />
          <mesh
            position={[
              sunUnitVec.x * 0.55,
              panelOriginY + Math.max(-0.05, sunUnitVec.y * 0.55),
              sunUnitVec.z * 0.55,
            ]}
          >
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial color="#FEF08A" />
          </mesh>

          <Html position={sunVectorTip} center distanceFactor={14}>
            <div className="px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-400 text-amber-200 text-[9px] font-mono font-bold whitespace-nowrap shadow-md pointer-events-none">
              ☀️ SUN RAY (El {currentStep.sun_el.toFixed(1)}°)
            </div>
          </Html>

          <Line
            points={[originPoint, normalVectorTip]}
            color={normalVectorColor}
            lineWidth={3.2}
          />
          <mesh position={normalVectorTip}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshBasicMaterial color={normalVectorColor} />
          </mesh>

          <Html position={normalVectorTip} center distanceFactor={14}>
            <div
              className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold whitespace-nowrap shadow-md pointer-events-none ${
                isOptimalIncidence
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                  : 'bg-red-950/90 border-red-400 text-red-200'
              }`}
            >
              n̂ PANEL NORMAL
            </div>
          </Html>

          <Html position={labelPos} center distanceFactor={13}>
            <div
              className={`px-2.5 py-1.5 rounded-lg border backdrop-blur-md text-[10px] font-mono shadow-xl pointer-events-none whitespace-nowrap ${
                isOptimalIncidence
                  ? 'bg-emerald-950/90 border-emerald-400/80 text-emerald-100'
                  : 'bg-red-950/90 border-red-400/80 text-red-100'
              }`}
            >
              <div className="font-extrabold flex items-center gap-1.5">
                <span>ANGLE OF INCIDENCE (θ):</span>
                <span className={isOptimalIncidence ? 'text-emerald-300' : 'text-red-300'}>
                  {incidenceAngleDeg.toFixed(1)}°
                </span>
              </div>
              <div className="text-[9px] opacity-90">
                cos(θ) Efficiency: <strong>{cosineEfficiencyPct.toFixed(1)}%</strong> •{' '}
                {arrayType === 'horizontal_deck'
                  ? '90° Polar Mismatch (~0 Power)'
                  : arrayType === 'dual_axis_tracking'
                  ? '0° Optimal Lock (100% Capture)'
                  : '360° Grazing Capture'}
              </div>
            </div>
          </Html>
        </group>
      )}
    </group>
  );
};
