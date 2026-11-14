import React, { useMemo } from 'react';
import { Stars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TimelineStep } from '../types/mission';

export interface SkyDomeProps {
  timeline: TimelineStep[];
  currentStep: TimelineStep;
  cinematicMode: boolean;
  showTrajectoryArcs?: boolean;
}

const SUN_DOME_RADIUS = 16.5;
const EARTH_DOME_RADIUS = 15.2;

const SUN_ANGULAR_DIAMETER_DEG = 0.53;
const EARTH_ANGULAR_DIAMETER_DEG = 1.9;

function sphericalSkyPosition(
  azDeg: number,
  elDeg: number,
  radius: number
): [number, number, number] {
  const phi = ((90.0 - elDeg) * Math.PI) / 180.0;
  const theta = (azDeg * Math.PI) / 180.0;
  const sinPhi = Math.sin(phi);
  const x = radius * sinPhi * Math.sin(theta);
  const y = radius * Math.cos(phi);
  const z = -radius * sinPhi * Math.cos(theta);
  return [x, y, z];
}

function fbmNoise2D(x: number, y: number): number {
  const hash = (ix: number, iy: number) => {
    const h = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
    return h - Math.floor(h);
  };
  const noise = (nx: number, ny: number) => {
    const ix = Math.floor(nx);
    const iy = Math.floor(ny);
    const fx = nx - ix;
    const fy = ny - iy;
    const ux = fx * fx * (3.0 - 2.0 * fx);
    const uy = fy * fy * (3.0 - 2.0 * fy);
    const a = hash(ix, iy);
    const b = hash(ix + 1, iy);
    const c = hash(ix, iy + 1);
    const d = hash(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };

  let val = 0.0;
  let amp = 0.5;
  let freq = 1.0;
  for (let o = 0; o < 5; o++) {
    val += amp * noise(x * freq, y * freq);
    freq *= 2.05;
    amp *= 0.5;
  }
  return val;
}

function createRealisticEarthTextures(): {
  dayMap: THREE.CanvasTexture;
  specCloudMap: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 512;

  const dayCanvas = document.createElement('canvas');
  dayCanvas.width = width;
  dayCanvas.height = height;
  const dayCtx = dayCanvas.getContext('2d');

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');

  if (dayCtx && maskCtx) {
    const dayImg = dayCtx.createImageData(width, height);
    const maskImg = maskCtx.createImageData(width, height);
    const dData = dayImg.data;
    const mData = maskImg.data;

    const continents = [
      { u: 0.22, v: 0.30, rx: 0.11, ry: 0.14 },
      { u: 0.27, v: 0.42, rx: 0.05, ry: 0.08 },
      { u: 0.32, v: 0.65, rx: 0.06, ry: 0.17 },
      { u: 0.54, v: 0.53, rx: 0.08, ry: 0.18 },
      { u: 0.58, v: 0.44, rx: 0.06, ry: 0.08 },
      { u: 0.62, v: 0.28, rx: 0.18, ry: 0.13 },
      { u: 0.74, v: 0.36, rx: 0.10, ry: 0.10 },
      { u: 0.82, v: 0.68, rx: 0.06, ry: 0.07 },
    ];

    for (let y = 0; y < height; y++) {
      const v = y / (height - 1);
      const lat = (0.5 - v) * Math.PI;
      const absLat = Math.abs(lat) / (Math.PI / 2);

      for (let x = 0; x < width; x++) {
        const u = x / (width - 1);

        const nCoast = fbmNoise2D(u * 10.0, v * 5.0);
        const nDetail = fbmNoise2D(u * 26.0 + 4.1, v * 13.0 + 1.7);

        let landScore = 0.0;
        for (const c of continents) {
          const du = (u - c.u) / c.rx;
          const dv = (v - c.v) / c.ry;
          const dist2 = du * du + dv * dv;
          if (dist2 < 2.2) {
            landScore = Math.max(landScore, 1.15 - Math.sqrt(dist2));
          }
        }
        landScore += (nCoast - 0.48) * 0.65 + (nDetail - 0.5) * 0.25;

        const iceCap = absLat + (nCoast - 0.5) * 0.12 > 0.84;
        const isLand = landScore > 0.32 || absLat > 0.88;

        let r: number;
        let g: number;
        let b: number;

        if (iceCap) {
          r = 238;
          g = 244;
          b = 252;
        } else if (isLand) {
          const aridity = Math.exp(-Math.pow((absLat - 0.26) / 0.14, 2)) * (0.5 + 0.5 * nDetail);
          const elevation = Math.max(0, landScore - 0.32) * 1.8 + (nDetail - 0.4) * 0.5;

          if (elevation > 0.78) {
            r = 165;
            g = 158;
            b = 148;
          } else if (aridity > 0.52) {
            r = Math.round(186 + 35 * nDetail);
            g = Math.round(154 + 28 * nDetail);
            b = Math.round(98 + 18 * nDetail);
          } else {
            r = Math.round(34 + 38 * nDetail);
            g = Math.round(88 + 48 * nCoast);
            b = Math.round(42 + 22 * nDetail);
          }
        } else {
          const shelf = Math.max(0, 1.0 - (0.32 - landScore) * 5.0);
          r = Math.round(8 + 22 * shelf);
          g = Math.round(36 + 68 * shelf);
          b = Math.round(88 + 75 * shelf);
        }

        const swirlU = u * 9.0 + Math.sin(v * 12.0) * 0.35;
        const swirlV = v * 6.0 + Math.cos(u * 8.0) * 0.2;
        const cloudRaw = fbmNoise2D(swirlU + 11.3, swirlV + 7.9);
        const cloudAlpha = Math.max(0, Math.min(1, (cloudRaw - 0.52) * 2.6));

        const cityMask =
          isLand && !iceCap && absLat < 0.65 && nDetail > 0.62 && landScore < 0.62 ? 255 : 0;

        const idx = (y * width + x) * 4;
        dData[idx] = r;
        dData[idx + 1] = g;
        dData[idx + 2] = b;
        dData[idx + 3] = 255;

        mData[idx] = isLand || iceCap ? 12 : 240;
        mData[idx + 1] = Math.round(cloudAlpha * 255);
        mData[idx + 2] = cityMask;
        mData[idx + 3] = 255;
      }
    }

    dayCtx.putImageData(dayImg, 0, 0);
    maskCtx.putImageData(maskImg, 0, 0);
  }

  const dayMap = new THREE.CanvasTexture(dayCanvas);
  dayMap.colorSpace = THREE.SRGBColorSpace;
  dayMap.wrapS = THREE.RepeatWrapping;
  dayMap.wrapT = THREE.ClampToEdgeWrapping;
  dayMap.needsUpdate = true;

  const specCloudMap = new THREE.CanvasTexture(maskCanvas);
  specCloudMap.wrapS = THREE.RepeatWrapping;
  specCloudMap.wrapT = THREE.ClampToEdgeWrapping;
  specCloudMap.needsUpdate = true;

  return { dayMap, specCloudMap };
}

export const SkyDome: React.FC<SkyDomeProps> = ({
  timeline,
  currentStep,
  cinematicMode,
  showTrajectoryArcs = true,
}) => {
  const sunArcPoints = useMemo(() => {
    return timeline.map((s) => sphericalSkyPosition(s.sun_az, s.sun_el, SUN_DOME_RADIUS));
  }, [timeline]);

  const earthArcPoints = useMemo(() => {
    return timeline.map((s) => sphericalSkyPosition(s.earth_az, s.earth_el, EARTH_DOME_RADIUS));
  }, [timeline]);

  const sunPos = useMemo(
    () => sphericalSkyPosition(currentStep.sun_az, currentStep.sun_el, SUN_DOME_RADIUS),
    [currentStep.sun_az, currentStep.sun_el]
  );

  const earthPos = useMemo(
    () => sphericalSkyPosition(currentStep.earth_az, currentStep.earth_el, EARTH_DOME_RADIUS),
    [currentStep.earth_az, currentStep.earth_el]
  );

  // True ~3.6x angular ratio between Earth (1.90°) and Sun (0.53°)
  const sunVisualRadius = 0.22;
  const earthVisualRadius = 0.78;

  const shadowLightPos = useMemo(() => {
    const effectiveEl = Math.max(0.8, currentStep.sun_el);
    return sphericalSkyPosition(currentStep.sun_az, effectiveEl, 38.0);
  }, [currentStep.sun_az, currentStep.sun_el]);

  const sunDirectionVec = useMemo(() => {
    const sunWorld = new THREE.Vector3(
      ...sphericalSkyPosition(currentStep.sun_az, currentStep.sun_el, 5000)
    );
    const earthWorld = new THREE.Vector3(
      ...sphericalSkyPosition(currentStep.earth_az, currentStep.earth_el, 384)
    );
    return sunWorld.sub(earthWorld).normalize();
  }, [currentStep.sun_az, currentStep.sun_el, currentStep.earth_az, currentStep.earth_el]);

  const earthPhaseInfo = useMemo(() => {
    const earthFromOrigin = new THREE.Vector3(...earthPos).normalize();
    const sunFromOrigin = new THREE.Vector3(...sunPos).normalize();
    const cosElong = Math.max(-1, Math.min(1, earthFromOrigin.dot(sunFromOrigin)));
    const illumFraction = 0.5 * (1.0 - cosElong);
    const pct = Math.round(illumFraction * 100);
    let label: string;
    if (pct < 15) label = 'THIN CRESCENT';
    else if (pct < 40) label = 'CRESCENT';
    else if (pct <= 60) label = 'QUARTER';
    else if (pct < 85) label = 'GIBBOUS';
    else label = 'FULL';
    return { pct, label };
  }, [earthPos, sunPos]);

  const { dayMap, specCloudMap } = useMemo(() => createRealisticEarthTextures(), []);

  const earthPhaseMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDayTexture: { value: dayMap },
        uSpecCloudTexture: { value: specCloudMap },
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
        uOccluded: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uDayTexture;
        uniform sampler2D uSpecCloudTexture;
        uniform vec3 uSunDirection;
        uniform float uOccluded;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;

        void main() {
          vec3 baseAlbedo = texture2D(uDayTexture, vUv).rgb;
          vec3 masks = texture2D(uSpecCloudTexture, vUv).rgb;
          float oceanMask = masks.r;
          float cloudDensity = masks.g;
          float cityMask = masks.b;

          vec3 normal = normalize(vWorldNormal);
          vec3 sunDir = normalize(uSunDirection);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);

          float ndotl = dot(normal, sunDir);
          float dayWeight = smoothstep(-0.10, 0.14, ndotl);
          float twilightWeight = smoothstep(-0.14, 0.05, ndotl) * (1.0 - smoothstep(0.0, 0.22, ndotl));
          float diffuse = max(0.0, ndotl);

          vec3 halfVec = normalize(sunDir + viewDir);
          float specPower = pow(max(0.0, dot(normal, halfVec)), 28.0);
          vec3 oceanSpecular = vec3(1.0, 0.95, 0.85) * specPower * oceanMask * dayWeight * 0.65;

          vec3 surfaceWithClouds = mix(baseAlbedo, vec3(0.96, 0.98, 1.0), cloudDensity * 0.85);

          float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 3.2);
          vec3 rayleighLimb = vec3(0.22, 0.62, 1.0) * fresnel * smoothstep(-0.25, 0.45, ndotl) * 1.15;
          vec3 sunsetTwilight = vec3(0.95, 0.42, 0.15) * twilightWeight * fresnel * 0.8;

          vec3 dayColor = surfaceWithClouds * (0.18 + 1.35 * diffuse) + oceanSpecular + rayleighLimb + sunsetTwilight;

          vec3 cityGlow = vec3(1.0, 0.78, 0.35) * cityMask * (1.0 - cloudDensity * 0.7) * 0.55;
          vec3 nightColor = surfaceWithClouds * 0.025 + vec3(0.01, 0.02, 0.05) + cityGlow * (1.0 - dayWeight);

          vec3 finalColor = mix(nightColor, dayColor, dayWeight);

          if (uOccluded > 0.5) {
            finalColor = mix(finalColor, vec3(0.90, 0.18, 0.18), 0.45);
          }

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }, [dayMap, specCloudMap]);

  useMemo(() => {
    earthPhaseMaterial.uniforms.uSunDirection.value.copy(sunDirectionVec);
    earthPhaseMaterial.uniforms.uOccluded.value = currentStep.earth_visible ? 0.0 : 1.0;
  }, [earthPhaseMaterial, sunDirectionVec, currentStep.earth_visible]);

  const earthSpinRad = ((currentStep.mission_hour || 0) / 24.0) * Math.PI * 2.0;

  return (
    <group>
      {/* Dense Deep-Space Starfield (Airless Lunar Sky) */}
      <Stars radius={130} depth={90} count={4200} factor={2.8} saturation={0.02} fade={false} />

      {/* Subtle Fill & Spacecraft Key Light */}
      <ambientLight intensity={cinematicMode ? 0.04 : 0.25} color="#94A3B8" />
      <directionalLight
        position={shadowLightPos}
        intensity={currentStep.sun_visible ? 2.6 * Math.max(0.2, currentStep.sun_fraction) : 0.08}
        color={currentStep.sun_visible ? '#FFFBEB' : '#64748B'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={95}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
      />

      {/* True-Direction Sun Marker (0.53° Angular Diameter) */}
      <group position={sunPos}>
        <mesh>
          <sphereGeometry args={[sunVisualRadius, 32, 32]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive={currentStep.sun_visible ? '#FFFBEB' : '#DC2626'}
            emissiveIntensity={currentStep.sun_visible ? 6.5 : 1.8}
            roughness={0.0}
            metalness={0.0}
            toneMapped={false}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[sunVisualRadius * 1.75, 24, 24]} />
          <meshBasicMaterial
            color={currentStep.sun_visible ? '#FDE047' : '#EF4444'}
            transparent
            opacity={currentStep.sun_visible ? 0.34 : 0.16}
            depthWrite={false}
          />
        </mesh>

        <Html distanceFactor={20} position={[0, sunVisualRadius + 0.42, 0]} center>
          <span className="px-1.5 py-0.5 rounded bg-[#070b14]/90 text-amber-300 border border-amber-500/40 text-[9px] font-mono tracking-wider whitespace-nowrap pointer-events-none tabular-nums">
            SUN {currentStep.sun_el >= 0 ? `+${currentStep.sun_el.toFixed(2)}°` : `${currentStep.sun_el.toFixed(2)}°`} • {SUN_ANGULAR_DIAMETER_DEG}°
          </span>
        </Html>
      </group>

      {/* True-Direction Earth Marker (1.90° Angular Diameter + Phase Shader) */}
      <group position={earthPos}>
        <mesh>
          <sphereGeometry args={[earthVisualRadius * 1.06, 36, 36]} />
          <meshBasicMaterial
            color={currentStep.earth_visible ? '#38BDF8' : '#EF4444'}
            transparent
            opacity={currentStep.earth_visible ? 0.16 : 0.12}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>

        <group rotation={[0, 0, (23.44 * Math.PI) / 180]}>
          <mesh rotation={[0, earthSpinRad, 0]} material={earthPhaseMaterial}>
            <sphereGeometry args={[earthVisualRadius, 64, 64]} />
          </mesh>
        </group>

        <Html distanceFactor={20} position={[0, earthVisualRadius + 0.44, 0]} center>
          <span className="px-1.5 py-0.5 rounded bg-[#070b14]/90 text-sky-300 border border-sky-500/40 text-[9px] font-mono tracking-wider whitespace-nowrap pointer-events-none tabular-nums">
            EARTH {currentStep.earth_el >= 0 ? `+${currentStep.earth_el.toFixed(1)}°` : `${currentStep.earth_el.toFixed(1)}°`} • {EARTH_ANGULAR_DIAMETER_DEG}° • {earthPhaseInfo.label} {earthPhaseInfo.pct}%
          </span>
        </Html>
      </group>

      {/* Ephemeris Trajectory Arcs & Line-of-Sight Vectors */}
      {showTrajectoryArcs && (
        <group>
          {sunArcPoints.length > 1 && (
            <Line
              points={sunArcPoints}
              color="#F59E0B"
              lineWidth={1.2}
              transparent
              opacity={0.42}
            />
          )}
          <Line
            points={[[0, 0.35, 0], sunPos]}
            color={currentStep.sun_visible ? '#F59E0B' : '#EF4444'}
            lineWidth={1.2}
            dashed={!currentStep.sun_visible}
            transparent
            opacity={0.55}
          />

          {earthArcPoints.length > 1 && (
            <Line
              points={earthArcPoints}
              color="#38BDF8"
              lineWidth={1.4}
              transparent
              opacity={0.52}
            />
          )}
          <Line
            points={[[0, 0.35, 0], earthPos]}
            color={currentStep.earth_visible ? '#38BDF8' : '#EF4444'}
            lineWidth={1.2}
            dashed={!currentStep.earth_visible}
            transparent
            opacity={0.55}
          />
        </group>
      )}
    </group>
  );
};