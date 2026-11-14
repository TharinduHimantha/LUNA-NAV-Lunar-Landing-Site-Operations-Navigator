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

/**
 * Sky dome radii in scene units.
 * Using a unified dome radius for BOTH the trajectory paths and the 3D celestial bodies
 * guarantees zero parallax offset from any orbital or surface camera position—the 3D Earth
 * and 3D Sun spheres travel 100% locked onto their marked paths at every frame.
 */
export const SUN_DOME_RADIUS = 16.5;
export const EARTH_DOME_RADIUS = 15.2;

export const SUN_ANGULAR_DIAMETER_DEG = 0.53;
export const EARTH_ANGULAR_DIAMETER_DEG = 1.9;

/**
 * Map topocentric (azimuth_deg, elevation_deg) to spherical coordinates [x, y, z]
 * centered on the lander at [0, 0, 0].
 * Azimuth: 0° = North (-Z), 90° = East (+X), 180° = South (+Z), 270° = West (-X)
 * Elevation: 0° = Horizon, +90° = Zenith (+Y)
 */
export function sphericalSkyPosition(
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

/**
 * Deterministic Pseudo-Random Noise for Realistic Continents, Clouds & City Lights
 */
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

/**
 * Generates high-resolution Day Albedo + Land/Ocean Specular Mask + Cloud Texture for Earth
 */
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

    // Major continental seeds (u in [0..1], v in [0..1], rx, ry)
    const continents = [
      // North America
      { u: 0.22, v: 0.30, rx: 0.11, ry: 0.14 },
      { u: 0.27, v: 0.42, rx: 0.05, ry: 0.08 },
      // South America
      { u: 0.32, v: 0.65, rx: 0.06, ry: 0.17 },
      // Africa
      { u: 0.54, v: 0.53, rx: 0.08, ry: 0.18 },
      { u: 0.58, v: 0.44, rx: 0.06, ry: 0.08 },
      // Eurasia
      { u: 0.62, v: 0.28, rx: 0.18, ry: 0.13 },
      { u: 0.74, v: 0.36, rx: 0.10, ry: 0.10 },
      // Australia
      { u: 0.82, v: 0.68, rx: 0.06, ry: 0.07 },
    ];

    for (let y = 0; y < height; y++) {
      const v = y / (height - 1);
      const lat = (0.5 - v) * Math.PI; // +pi/2 North to -pi/2 South
      const absLat = Math.abs(lat) / (Math.PI / 2);

      for (let x = 0; x < width; x++) {
        const u = x / (width - 1);

        // Fractal coastline modulation
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

        // Polar ice caps (Antarctica & Arctic sea ice)
        const iceCap = absLat + (nCoast - 0.5) * 0.12 > 0.84;
        const isLand = landScore > 0.32 || absLat > 0.88;

        let r = 10;
        let g = 42;
        let b = 96;

        if (iceCap) {
          r = 238;
          g = 244;
          b = 252;
        } else if (isLand) {
          // Biome coloring: equatorial rainforest, subtropical desert gold, temperate forest, alpine rock
          const aridity = Math.exp(-Math.pow((absLat - 0.26) / 0.14, 2)) * (0.5 + 0.5 * nDetail);
          const elevation = Math.max(0, landScore - 0.32) * 1.8 + (nDetail - 0.4) * 0.5;

          if (elevation > 0.78) {
            // Mountain range snow/rock
            r = 165;
            g = 158;
            b = 148;
          } else if (aridity > 0.52) {
            // Sahara / Arabian / Australian desert ochre-gold
            r = Math.round(186 + 35 * nDetail);
            g = Math.round(154 + 28 * nDetail);
            b = Math.round(98 + 18 * nDetail);
          } else {
            // Lush forest & grassland greens
            r = Math.round(34 + 38 * nDetail);
            g = Math.round(88 + 48 * nCoast);
            b = Math.round(42 + 22 * nDetail);
          }
        } else {
          // Deep abyssal ocean vs shallow turquoise continental shelf
          const shelf = Math.max(0, 1.0 - (0.32 - landScore) * 5.0);
          r = Math.round(8 + 22 * shelf);
          g = Math.round(36 + 68 * shelf);
          b = Math.round(88 + 75 * shelf);
        }

        // Swirling cyclone & trade-wind cloud bands
        const swirlU = u * 9.0 + Math.sin(v * 12.0) * 0.35;
        const swirlV = v * 6.0 + Math.cos(u * 8.0) * 0.2;
        const cloudRaw = fbmNoise2D(swirlU + 11.3, swirlV + 7.9);
        const cloudAlpha = Math.max(0, Math.min(1, (cloudRaw - 0.52) * 2.6));

        // Night-side city lights along populated coastal/temperate land zones
        const cityMask =
          isLand && !iceCap && absLat < 0.65 && nDetail > 0.62 && landScore < 0.62 ? 255 : 0;

        const idx = (y * width + x) * 4;
        dData[idx] = r;
        dData[idx + 1] = g;
        dData[idx + 2] = b;
        dData[idx + 3] = 255;

        // mData: R = Ocean Specular (255 for water), G = Cloud Density, B = Night City Lights
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
  // Unified trajectory + body positions:
  // By using the EXACT same function and radius for `sunPos` & `sunArcPoints`, and for
  // `earthPos` & `earthArcPoints`, the 3D Sun and 3D Earth meshes ALWAYS travel directly
  // along their marked paths in the 3D viewport from every camera angle!
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

  // Relative scale preserving the true ~3.6x angular ratio between Earth (~1.9°) and Sun (~0.53°)
  // while keeping both bodies clearly visible as 3D spheres along their orbital tracks
  const sunVisualRadius = 0.24;
  const earthVisualRadius = 0.68;

  // Directional shadow-casting light aligned with exact Sun vector
  const shadowLightPos = useMemo(() => {
    const effectiveEl = Math.max(0.8, currentStep.sun_el);
    return sphericalSkyPosition(currentStep.sun_az, effectiveEl, 38.0);
  }, [currentStep.sun_az, currentStep.sun_el]);

  // 3D Sun direction vector relative to Earth for accurate Crescent / Half / Full Earth phases
  const sunDirectionVec = useMemo(() => {
    const sunWorld = new THREE.Vector3(...sphericalSkyPosition(currentStep.sun_az, currentStep.sun_el, 5000));
    const earthWorld = new THREE.Vector3(...sphericalSkyPosition(currentStep.earth_az, currentStep.earth_el, 384));
    return sunWorld.sub(earthWorld).normalize();
  }, [currentStep.sun_az, currentStep.sun_el, currentStep.earth_az, currentStep.earth_el]);

  // Compute human-readable Earth Phase name & illuminated fraction for telemetry badge
  const earthPhaseInfo = useMemo(() => {
    const earthFromOrigin = new THREE.Vector3(...earthPos).normalize();
    const sunFromOrigin = new THREE.Vector3(...sunPos).normalize();
    const cosElong = Math.max(-1, Math.min(1, earthFromOrigin.dot(sunFromOrigin)));
    const illumFraction = 0.5 * (1.0 - cosElong);
    const pct = Math.round(illumFraction * 100);
    let label = 'Half Earth';
    if (pct < 15) label = 'Thin Crescent Earth';
    else if (pct < 40) label = 'Crescent Earth';
    else if (pct <= 60) label = 'Quarter Earth';
    else if (pct < 85) label = 'Gibbous Earth';
    else label = 'Full Earth';
    return { pct, label };
  }, [earthPos, sunPos]);

  const { dayMap, specCloudMap } = useMemo(() => createRealisticEarthTextures(), []);

  // Photorealistic GLSL Earth Shader:
  // - Continents + Ocean Specular Glint + Swirling Cloud Layer + Rayleigh Blue Atmosphere
  // - Night-side Golden City Lights + True Solar Phase Terminator
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

          // Solar phase terminator with soft atmospheric twilight zone
          float ndotl = dot(normal, sunDir);
          float dayWeight = smoothstep(-0.10, 0.14, ndotl);
          float twilightWeight = smoothstep(-0.14, 0.05, ndotl) * (1.0 - smoothstep(0.0, 0.22, ndotl));
          float diffuse = max(0.0, ndotl);

          // Ocean solar specular highlight (sunglint on water)
          vec3 halfVec = normalize(sunDir + viewDir);
          float specPower = pow(max(0.0, dot(normal, halfVec)), 28.0);
          vec3 oceanSpecular = vec3(1.0, 0.95, 0.85) * specPower * oceanMask * dayWeight * 0.65;

          // Bright white swirling cloud layer over surface
          vec3 surfaceWithClouds = mix(baseAlbedo, vec3(0.96, 0.98, 1.0), cloudDensity * 0.85);

          // Rayleigh atmospheric scattering limb glow
          float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 3.2);
          vec3 rayleighLimb = vec3(0.22, 0.62, 1.0) * fresnel * smoothstep(-0.25, 0.45, ndotl) * 1.15;
          vec3 sunsetTwilight = vec3(0.95, 0.42, 0.15) * twilightWeight * fresnel * 0.8;

          // Day hemisphere lighting
          vec3 dayColor = surfaceWithClouds * (0.18 + 1.35 * diffuse) + oceanSpecular + rayleighLimb + sunsetTwilight;

          // Night hemisphere: faint lunarshine + golden urban city lights
          vec3 cityGlow = vec3(1.0, 0.78, 0.35) * cityMask * (1.0 - cloudDensity * 0.7) * 0.55;
          vec3 nightColor = surfaceWithClouds * 0.025 + vec3(0.01, 0.02, 0.05) + cityGlow * (1.0 - dayWeight);

          vec3 finalColor = mix(nightColor, dayColor, dayWeight);

          // Subtle crimson warning tint when Earth dips below the local lunar mountain horizon
          if (uOccluded > 0.5) {
            finalColor = mix(finalColor, vec3(0.90, 0.18, 0.18), 0.45);
          }

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }, [dayMap, specCloudMap]);

  earthPhaseMaterial.uniforms.uSunDirection.value.copy(sunDirectionVec);
  earthPhaseMaterial.uniforms.uOccluded.value = currentStep.earth_visible ? 0.0 : 1.0;

  // Earth rotates 360° every 24.0 mission hours around its 23.4°-tilted axis
  const earthSpinRad = ((currentStep.mission_hour || 0) / 24.0) * Math.PI * 2.0;

  return (
    <group>
      {/* Deep Space Starfield */}
      <Stars radius={120} depth={80} count={2800} factor={3.2} saturation={0.05} fade />

      {/* Ambient Fill Light: Pitch-black shadows in Cinematic Vacuum Mode, brightened in Data Mode */}
      <ambientLight
        intensity={cinematicMode ? 0.04 : 0.65}
        color={cinematicMode ? '#64748B' : '#E2E8F0'}
      />

      {/* High-Resolution 4096x4096 PCFSoftShadowMap Directional Sunlight */}
      <directionalLight
        position={shadowLightPos}
        intensity={
          currentStep.sun_visible
            ? (cinematicMode ? 3.8 : 2.2) * Math.max(0.2, currentStep.sun_fraction)
            : cinematicMode
            ? 0.02
            : 0.35
        }
        color={currentStep.sun_visible ? '#FFFBEB' : '#EF4444'}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={95}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
      />

      {/* =====================================================================
          3.1 THE REALISTIC SUN (Locked 100% onto `sunArcPoints` at `SUN_DOME_RADIUS`)
         ===================================================================== */}
      <group position={sunPos}>
        {/* Blinding HDR Photosphere Core */}
        <mesh>
          <sphereGeometry args={[sunVisualRadius, 32, 32]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive={currentStep.sun_visible ? '#FFFBEB' : '#DC2626'}
            emissiveIntensity={currentStep.sun_visible ? 10.0 : 2.5}
            roughness={0.0}
            metalness={0.0}
            toneMapped={false}
          />
        </mesh>

        {/* Inner Solar Chromosphere Halo */}
        <mesh>
          <sphereGeometry args={[sunVisualRadius * 1.65, 24, 24]} />
          <meshBasicMaterial
            color={currentStep.sun_visible ? '#FDE047' : '#EF4444'}
            transparent
            opacity={currentStep.sun_visible ? 0.42 : 0.2}
            depthWrite={false}
          />
        </mesh>

        {/* Outer Solar Corona Glow */}
        <mesh>
          <sphereGeometry args={[sunVisualRadius * 2.9, 24, 24]} />
          <meshBasicMaterial
            color={currentStep.sun_visible ? '#F59E0B' : '#991B1B'}
            transparent
            opacity={currentStep.sun_visible ? 0.16 : 0.08}
            depthWrite={false}
          />
        </mesh>

        <Html distanceFactor={20} position={[0, sunVisualRadius + 0.45, 0]} center>
          <span className="px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-500/50 text-[10px] font-mono whitespace-nowrap pointer-events-none shadow">
            ☀️ SUN {currentStep.sun_el.toFixed(1)}° ({SUN_ANGULAR_DIAMETER_DEG}° Disc)
          </span>
        </Html>
      </group>

      {/* =====================================================================
          3.2 THE REALISTIC EARTH (Locked 100% onto `earthArcPoints` at `EARTH_DOME_RADIUS`)
          Features Blue Marble Continents, Ocean Sunglint, Clouds, City Lights & Solar Phases
         ===================================================================== */}
      <group position={earthPos}>
        {/* Outer Rayleigh Atmospheric Halo */}
        <mesh>
          <sphereGeometry args={[earthVisualRadius * 1.07, 36, 36]} />
          <meshBasicMaterial
            color={currentStep.earth_visible ? '#38BDF8' : '#EF4444'}
            transparent
            opacity={currentStep.earth_visible ? 0.18 : 0.12}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>

        {/* 23.4° Obliquity Group + 24h Sidereal Axial Spin */}
        <group rotation={[0, 0, (23.44 * Math.PI) / 180]}>
          <mesh rotation={[0, earthSpinRad, 0]} material={earthPhaseMaterial}>
            <sphereGeometry args={[earthVisualRadius, 64, 64]} />
          </mesh>
        </group>

        <Html distanceFactor={20} position={[0, earthVisualRadius + 0.48, 0]} center>
          <span className="px-1.5 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-500/50 text-[10px] font-mono whitespace-nowrap pointer-events-none shadow">
            🌍 EARTH {currentStep.earth_el.toFixed(1)}° ({earthPhaseInfo.label} • {earthPhaseInfo.pct}%)
          </span>
        </Html>
      </group>

      {/* =====================================================================
          ORBITAL TRAJECTORY PATHS & LINE-OF-SIGHT RAYS
          (Drawn at the exact same `SUN_DOME_RADIUS` and `EARTH_DOME_RADIUS`)
         ===================================================================== */}
      {showTrajectoryArcs && (
        <group>
          {sunArcPoints.length > 1 && (
            <Line
              points={sunArcPoints}
              color="#F59E0B"
              lineWidth={1.6}
              transparent
              opacity={0.55}
            />
          )}
          <Line
            points={[[0, 0.35, 0], sunPos]}
            color={currentStep.sun_visible ? '#F59E0B' : '#EF4444'}
            lineWidth={1.5}
            dashed={!currentStep.sun_visible}
            transparent
            opacity={0.68}
          />

          {earthArcPoints.length > 1 && (
            <Line
              points={earthArcPoints}
              color="#38BDF8"
              lineWidth={2.0}
              transparent
              opacity={0.75}
            />
          )}
          <Line
            points={[[0, 0.35, 0], earthPos]}
            color={currentStep.earth_visible ? '#38BDF8' : '#EF4444'}
            lineWidth={1.5}
            dashed={!currentStep.earth_visible}
            transparent
            opacity={0.68}
          />
        </group>
      )}
    </group>
  );
};
