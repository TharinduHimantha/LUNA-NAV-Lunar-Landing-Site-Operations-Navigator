import * as THREE from 'three';
import type {
  ColormapId,
  ContourSettings,
  LayerItemState,
} from '../../types/workbench';

function colormapToInt(cm?: ColormapId): number {
  if (cm === 'viridis') return 1;
  if (cm === 'inferno') return 2;
  if (cm === 'grayscale') return 3;
  return 0; // cividis (colorblind-safe default)
}

export function createLunarTerrainShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: { value: new THREE.Vector3(0, 0.05, -1) },
      uSunAzDeg: { value: 0.0 },
      uSunElDeg: { value: 1.5 },
      uSunFraction: { value: 1.0 },
      uEarthDirection: { value: new THREE.Vector3(0, 0.1, -1) },
      uEarthshineIntensity: { value: 0.16 },
      uCinematicMode: { value: 0.0 },

      uHorizonTexA: { value: null },
      uHorizonTexB: { value: null },
      uDiffuseTex: { value: null },
      uHasDiffuseTex: { value: 0.0 },

      uMinElevM: { value: -2000.0 },
      uMaxElevM: { value: 4500.0 },

      // Draped Layer Controls & Stack Priority Weights
      uBasemapOpacity: { value: 1.0 },
      uElevVisible: { value: 0.0 },
      uElevOpacity: { value: 0.65 },
      uElevColormap: { value: 0 },
      uElevMin: { value: -2500.0 },
      uElevMax: { value: 4800.0 },
      uElevGamma: { value: 1.0 },
      uElevPriority: { value: 1.0 },

      uSlopeVisible: { value: 0.0 },
      uSlopeOpacity: { value: 0.75 },
      uSlopeColormap: { value: 2 },
      uSlopeMin: { value: 0.0 },
      uSlopeMax: { value: 20.0 },
      uSlopeGamma: { value: 1.0 },
      uSlopePriority: { value: 1.0 },

      uPsrVisible: { value: 0.0 },
      uPsrOpacity: { value: 0.85 },

      uContoursVisible: { value: 1.0 },
      uContourIntervalM: { value: 100.0 },
    },
    vertexShader: `
      attribute float aElevM;
      attribute float aSlopeDeg;
      attribute float aAo;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying float vElevM;
      varying float vSlopeDeg;
      varying float vAo;

      void main() {
        vUv = uv;
        vElevM = aElevM;
        vSlopeDeg = aSlopeDeg;
        vAo = aAo;

        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform float uSunAzDeg;
      uniform float uSunElDeg;
      uniform float uSunFraction;
      uniform vec3 uEarthDirection;
      uniform float uEarthshineIntensity;
      uniform float uCinematicMode;

      uniform sampler2D uHorizonTexA;
      uniform sampler2D uHorizonTexB;
      uniform sampler2D uDiffuseTex;
      uniform float uHasDiffuseTex;

      uniform float uMinElevM;
      uniform float uMaxElevM;

      uniform float uBasemapOpacity;
      uniform float uElevVisible;
      uniform float uElevOpacity;
      uniform int uElevColormap;
      uniform float uElevMin;
      uniform float uElevMax;
      uniform float uElevGamma;
      uniform float uElevPriority;

      uniform float uSlopeVisible;
      uniform float uSlopeOpacity;
      uniform int uSlopeColormap;
      uniform float uSlopeMin;
      uniform float uSlopeMax;
      uniform float uSlopeGamma;
      uniform float uSlopePriority;

      uniform float uPsrVisible;
      uniform float uPsrOpacity;

      uniform float uContoursVisible;
      uniform float uContourIntervalM;

      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying float vElevM;
      varying float vSlopeDeg;
      varying float vAo;

      // Perceptually Uniform Scientific Colormaps (No Rainbow/Jet)
      vec3 evalColormap(int id, float tRaw) {
        float t = clamp(tRaw, 0.0, 1.0);
        if (id == 1) {
          // Viridis
          vec3 c0 = vec3(0.267, 0.005, 0.329);
          vec3 c1 = vec3(0.190, 0.407, 0.556);
          vec3 c2 = vec3(0.208, 0.718, 0.472);
          vec3 c3 = vec3(0.993, 0.906, 0.144);
          if (t < 0.33) return mix(c0, c1, t / 0.33);
          if (t < 0.66) return mix(c1, c2, (t - 0.33) / 0.33);
          return mix(c2, c3, (t - 0.66) / 0.34);
        } else if (id == 2) {
          // Inferno
          vec3 c0 = vec3(0.001, 0.000, 0.014);
          vec3 c1 = vec3(0.471, 0.110, 0.427);
          vec3 c2 = vec3(0.929, 0.412, 0.145);
          vec3 c3 = vec3(0.988, 0.998, 0.645);
          if (t < 0.33) return mix(c0, c1, t / 0.33);
          if (t < 0.66) return mix(c1, c2, (t - 0.33) / 0.33);
          return mix(c2, c3, (t - 0.66) / 0.34);
        } else if (id == 3) {
          // Grayscale
          return vec3(t);
        }
        // Cividis (Default Colorblind-Safe)
        vec3 c0 = vec3(0.000, 0.135, 0.305);
        vec3 c1 = vec3(0.341, 0.365, 0.427);
        vec3 c2 = vec3(0.647, 0.612, 0.455);
        vec3 c3 = vec3(0.996, 0.910, 0.220);
        if (t < 0.33) return mix(c0, c1, t / 0.33);
        if (t < 0.66) return mix(c1, c2, (t - 0.33) / 0.33);
        return mix(c2, c3, (t - 0.66) / 0.34);
      }

      float sampleHorizonDeg(vec2 uv, float azDeg) {
        vec4 hA = texture2D(uHorizonTexA, uv) * 30.0 - 5.0;
        vec4 hB = texture2D(uHorizonTexB, uv) * 30.0 - 5.0;

        float az = mod(azDeg + 360.0, 360.0);
        float sectorFloat = az / 45.0;
        int s0 = int(floor(sectorFloat));
        int s1 = int(mod(float(s0 + 1), 8.0));
        float frac = fract(sectorFloat);

        float v0 = 0.0;
        if (s0 == 0) v0 = hA.r;
        else if (s0 == 1) v0 = hA.g;
        else if (s0 == 2) v0 = hA.b;
        else if (s0 == 3) v0 = hA.a;
        else if (s0 == 4) v0 = hB.r;
        else if (s0 == 5) v0 = hB.g;
        else if (s0 == 6) v0 = hB.b;
        else v0 = hB.a;

        float v1 = 0.0;
        if (s1 == 0) v1 = hA.r;
        else if (s1 == 1) v1 = hA.g;
        else if (s1 == 2) v1 = hA.b;
        else if (s1 == 3) v1 = hA.a;
        else if (s1 == 4) v1 = hB.r;
        else if (s1 == 5) v1 = hB.g;
        else if (s1 == 6) v1 = hB.b;
        else v1 = hB.a;

        return mix(v0, v1, frac);
      }

      vec3 applyElevationOverlay(vec3 baseCol) {
        if (uElevVisible < 0.5) return baseCol;
        float span = max(10.0, uElevMax - uElevMin);
        float tElev = pow(clamp((vElevM - uElevMin) / span, 0.0, 1.0), max(0.2, uElevGamma));
        vec3 elevCol = evalColormap(uElevColormap, tElev);
        return mix(baseCol, elevCol * 0.62, uElevOpacity * 0.72);
      }

      vec3 applySlopeOverlay(vec3 baseCol) {
        if (uSlopeVisible < 0.5) return baseCol;
        float span = max(0.5, uSlopeMax - uSlopeMin);
        float tSlope = pow(clamp((vSlopeDeg - uSlopeMin) / span, 0.0, 1.0), max(0.2, uSlopeGamma));
        vec3 slopeCol = evalColormap(uSlopeColormap, tSlope);
        if (vSlopeDeg < 5.0) {
          slopeCol = mix(slopeCol, vec3(0.06, 0.72, 0.55), 0.32);
        }
        return mix(baseCol, slopeCol * 0.68, uSlopeOpacity * 0.78);
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 sunDir = normalize(uSunDirection);
        vec3 earthDir = normalize(uEarthDirection);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);

        // 1. Base Lunar Regolith Albedo
        float grain = fract(sin(dot(vUv * 420.0, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 regolithBase = vec3(0.24 + 0.04 * grain);
        if (uHasDiffuseTex > 0.5) {
          vec3 texCol = texture2D(uDiffuseTex, vUv).rgb;
          regolithBase = mix(regolithBase, texCol * 0.65, uBasemapOpacity);
        }

        // 2. Draped Scientific Data Overlays (Respecting Layer Stack Order)
        vec3 surfaceAlbedo = regolithBase;
        if (uSlopePriority >= uElevPriority) {
          surfaceAlbedo = applyElevationOverlay(surfaceAlbedo);
          surfaceAlbedo = applySlopeOverlay(surfaceAlbedo);
        } else {
          surfaceAlbedo = applySlopeOverlay(surfaceAlbedo);
          surfaceAlbedo = applyElevationOverlay(surfaceAlbedo);
        }

        // 3. Topographic Horizon-Raycast Shadowing (with 0.266 deg Solar Limb Penumbra)
        float localHorizonDeg = sampleHorizonDeg(vUv, uSunAzDeg);
        float sunClearanceDeg = uSunElDeg - localHorizonDeg;
        float terrainShadowFactor = smoothstep(-0.266, 0.266, sunClearanceDeg) * uSunFraction;

        // 4. Lommel-Seeliger / Hapke Lunar Regolith Hillshade
        float ndotl = max(0.0, dot(normal, sunDir));
        float ndotv = max(0.05, dot(normal, viewDir));
        float lommelSeeliger = ndotl / (ndotl + ndotv * 0.45 + 0.08);
        float hillshade = mix(ndotl, lommelSeeliger, 0.62);

        vec3 directSunLight = vec3(2.45, 2.40, 2.28) * hillshade * terrainShadowFactor;

        // 5. Cool-Blue Earthshine Fill Light + DEM Cavity Ambient Occlusion
        float earthFacing = max(0.0, dot(normal, earthDir)) * 0.75 + 0.25;
        float fillScale = mix(1.0, 0.35, uCinematicMode);
        vec3 earthshineLight = vec3(0.055, 0.085, 0.135) * uEarthshineIntensity * earthFacing * vAo * fillScale;

        vec3 litColor = surfaceAlbedo * (directSunLight + earthshineLight);

        // 6. Permanently Shadowed Region (PSR < 70 K) Cold-Trap Indicator
        if (uPsrVisible > 0.5) {
          float hN = sampleHorizonDeg(vUv, 0.0);
          float hE = sampleHorizonDeg(vUv, 90.0);
          float hS = sampleHorizonDeg(vUv, 180.0);
          float hW = sampleHorizonDeg(vUv, 270.0);
          float meanMask = (hN + hE + hS + hW) * 0.25;
          float psrMask = smoothstep(2.6, 4.2, meanMask);
          vec3 psrTint = vec3(0.14, 0.36, 0.88);
          litColor = mix(litColor, psrTint * (0.45 + 0.55 * vAo), psrMask * uPsrOpacity * 0.74);
        }

        // 7. Hypsometric Contour Lines & 5x Index Contours
        if (uContoursVisible > 0.5 && uContourIntervalM > 5.0) {
          float elevSteps = vElevM / uContourIntervalM;
          float distToLine = abs(fract(elevSteps + 0.5) - 0.5);
          float lineWidth = fwidth(elevSteps) * 1.15;
          float contourAlpha = 1.0 - smoothstep(0.0, max(0.015, lineWidth), distToLine);

          float indexSteps = vElevM / (uContourIntervalM * 5.0);
          float distToIndex = abs(fract(indexSteps + 0.5) - 0.5);
          float indexAlpha = 1.0 - smoothstep(0.0, max(0.02, fwidth(indexSteps) * 1.5), distToIndex);

          vec3 contourColor = mix(vec3(0.45, 0.55, 0.68), vec3(0.22, 0.74, 0.97), indexAlpha);
          float finalContourMix = max(contourAlpha * 0.22, indexAlpha * 0.50);
          litColor = mix(litColor, contourColor, finalContourMix);
        }

        gl_FragColor = vec4(litColor, 1.0);
      }
    `,
  });
}

export function syncTerrainShaderUniforms(
  mat: THREE.ShaderMaterial,
  params: {
    sunAzDeg: number;
    sunElDeg: number;
    sunFraction: number;
    earthAzDeg: number;
    earthElDeg: number;
    cinematicMode: boolean;
    minElevM: number;
    maxElevM: number;
    layers: LayerItemState[];
    contourSettings?: ContourSettings;
  }
): void {
  const azRad = (params.sunAzDeg * Math.PI) / 180.0;
  const elRad = (params.sunElDeg * Math.PI) / 180.0;
  mat.uniforms.uSunDirection.value.set(
    Math.cos(elRad) * Math.sin(azRad),
    Math.sin(elRad),
    -Math.cos(elRad) * Math.cos(azRad)
  );
  mat.uniforms.uSunAzDeg.value = params.sunAzDeg;
  mat.uniforms.uSunElDeg.value = params.sunElDeg;
  mat.uniforms.uSunFraction.value = params.sunFraction;

  const eAzRad = (params.earthAzDeg * Math.PI) / 180.0;
  const eElRad = (params.earthElDeg * Math.PI) / 180.0;
  mat.uniforms.uEarthDirection.value.set(
    Math.cos(eElRad) * Math.sin(eAzRad),
    Math.sin(eElRad),
    -Math.cos(eElRad) * Math.cos(eAzRad)
  );

  mat.uniforms.uCinematicMode.value = params.cinematicMode ? 1.0 : 0.0;
  mat.uniforms.uMinElevM.value = params.minElevM;
  mat.uniforms.uMaxElevM.value = params.maxElevM;

  const basemap = params.layers.find((l) => l.id === 'lroc_wac');
  const elevIdx = params.layers.findIndex((l) => l.id === 'lola_elevation');
  const slopeIdx = params.layers.findIndex((l) => l.id === 'terrain_slope');
  const elevLayer = elevIdx >= 0 ? params.layers[elevIdx] : undefined;
  const slopeLayer = slopeIdx >= 0 ? params.layers[slopeIdx] : undefined;
  const psrLayer = params.layers.find((l) => l.id === 'psr_cold_traps');

  mat.uniforms.uBasemapOpacity.value = basemap && basemap.visible ? basemap.opacity : 0.0;

  mat.uniforms.uElevVisible.value = elevLayer?.visible ? 1.0 : 0.0;
  mat.uniforms.uElevOpacity.value = elevLayer?.opacity ?? 0.65;
  mat.uniforms.uElevColormap.value = colormapToInt(elevLayer?.colormap);
  mat.uniforms.uElevMin.value = elevLayer?.minVal ?? params.minElevM;
  mat.uniforms.uElevMax.value = elevLayer?.maxVal ?? params.maxElevM;
  mat.uniforms.uElevGamma.value = elevLayer?.gamma ?? 1.0;
  // Higher in layer list = smaller index = higher priority
  mat.uniforms.uElevPriority.value = elevIdx >= 0 ? 100 - elevIdx : 50;

  mat.uniforms.uSlopeVisible.value = slopeLayer?.visible ? 1.0 : 0.0;
  mat.uniforms.uSlopeOpacity.value = slopeLayer?.opacity ?? 0.75;
  mat.uniforms.uSlopeColormap.value = colormapToInt(slopeLayer?.colormap);
  mat.uniforms.uSlopeMin.value = slopeLayer?.minVal ?? 0.0;
  mat.uniforms.uSlopeMax.value = slopeLayer?.maxVal ?? 20.0;
  mat.uniforms.uSlopeGamma.value = slopeLayer?.gamma ?? 1.0;
  mat.uniforms.uSlopePriority.value = slopeIdx >= 0 ? 100 - slopeIdx : 49;

  mat.uniforms.uPsrVisible.value = psrLayer?.visible ? 1.0 : 0.0;
  mat.uniforms.uPsrOpacity.value = psrLayer?.opacity ?? 0.85;

  mat.uniforms.uContoursVisible.value =
    params.contourSettings === undefined || params.contourSettings.visible ? 1.0 : 0.0;
  mat.uniforms.uContourIntervalM.value = params.contourSettings?.intervalM ?? 100.0;
}