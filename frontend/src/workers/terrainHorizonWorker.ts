export interface TerrainWorkerInput {
  requestId: number;
  elevations: number[][];
  patchSizeKm: number;
  verticalExaggeration: number;
  baseElevM: number;
}

export interface TerrainWorkerOutput {
  requestId: number;
  gridSize: number;
  positionsY: Float32Array;
  normals: Float32Array;
  slopesDeg: Float32Array;
  ao: Float32Array;
  horizonSectorA: Uint8Array; // RGBA: Az 0°, 45°, 90°, 135°
  horizonSectorB: Uint8Array; // RGBA: Az 180°, 225°, 270°, 315°
}

const R_MOON_M = 1_737_400.0;
const SECTOR_AZIMUTHS_DEG = [0, 45, 90, 135, 180, 225, 270, 315];

function encodeHorizonDegToByte(deg: number): number {
  // Maps [-5.0°, +25.0°] linearly into [0..255]
  const clamped = Math.max(-5.0, Math.min(25.0, deg));
  return Math.round(((clamped + 5.0) / 30.0) * 255);
}

export function computeTerrainBuffers(input: TerrainWorkerInput): TerrainWorkerOutput {
  const { requestId, elevations, patchSizeKm, verticalExaggeration, baseElevM } = input;
  const N = elevations.length;
  const totalVerts = N * N;

  const positionsY = new Float32Array(totalVerts);
  const normals = new Float32Array(totalVerts * 3);
  const slopesDeg = new Float32Array(totalVerts);
  const ao = new Float32Array(totalVerts);
  const horizonSectorA = new Uint8Array(totalVerts * 4);
  const horizonSectorB = new Uint8Array(totalVerts * 4);

  const patchMeters = patchSizeKm * 1000.0;
  const cellMeters = patchMeters / Math.max(1, N - 1);
  const sceneScale = 20.0 / Math.max(1, N - 1);

  // 1. Populate Y heights (rowFromNorth 0 -> demRow N-1)
  for (let rowFromNorth = 0; rowFromNorth < N; rowFromNorth++) {
    const demRow = N - 1 - rowFromNorth;
    const rowArr = elevations[demRow] || [];
    for (let col = 0; col < N; col++) {
      const idx = rowFromNorth * N + col;
      const zM = rowArr[col] ?? baseElevM;
      positionsY[idx] = ((zM - baseElevM) / 1000.0) * verticalExaggeration;
    }
  }

  // Helper to sample physical elevation in meters at (demRow, col)
  const getZ = (demRow: number, col: number): number => {
    const r = Math.max(0, Math.min(N - 1, demRow));
    const c = Math.max(0, Math.min(N - 1, col));
    return elevations[r]?.[c] ?? baseElevM;
  };

  // Precompute ray unit steps for 8 compass azimuths (0°=North (+demRow), 90°=East (+col))
  const sectorSteps = SECTOR_AZIMUTHS_DEG.map((az) => {
    const rad = (az * Math.PI) / 180.0;
    return {
      dCol: Math.sin(rad),
      dRow: Math.cos(rad),
      stepDistM: cellMeters * Math.hypot(Math.sin(rad), Math.cos(rad)),
    };
  });

  // 2. Compute Normals, Slopes, DEM Ambient Occlusion & 8-Sector Horizon Angles
  for (let rowFromNorth = 0; rowFromNorth < N; rowFromNorth++) {
    const demRow = N - 1 - rowFromNorth;
    for (let col = 0; col < N; col++) {
      const idx = rowFromNorth * N + col;
      const zCenter = getZ(demRow, col);

      // Finite-difference physical slope & exaggerated scene normal
      const zW = getZ(demRow, col - 1);
      const zE = getZ(demRow, col + 1);
      const zS = getZ(demRow - 1, col);
      const zN = getZ(demRow + 1, col);

      const dzDxPhys = (zE - zW) / (2.0 * cellMeters);
      const dzDyPhys = (zN - zS) / (2.0 * cellMeters);
      const gradMag = Math.hypot(dzDxPhys, dzDyPhys);
      slopesDeg[idx] = (Math.atan(gradMag) * 180.0) / Math.PI;

      const yW = ((zW - baseElevM) / 1000.0) * verticalExaggeration;
      const yE = ((zE - baseElevM) / 1000.0) * verticalExaggeration;
      const yS = ((zS - baseElevM) / 1000.0) * verticalExaggeration;
      const yN = ((zN - baseElevM) / 1000.0) * verticalExaggeration;

      let nx = -(yE - yW) / (2.0 * sceneScale);
      let ny = 1.0;
      let nz = (yN - yS) / (2.0 * sceneScale);
      const nLen = Math.hypot(nx, ny, nz) || 1.0;
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;
      normals[idx * 3] = nx;
      normals[idx * 3 + 1] = ny;
      normals[idx * 3 + 2] = nz;

      // Multi-ring cavity ambient occlusion (crater bowls darker, ridges brighter)
      const avgRing1 = (zW + zE + zS + zN) * 0.25;
      const avgRing2 =
        (getZ(demRow - 3, col - 3) +
          getZ(demRow - 3, col + 3) +
          getZ(demRow + 3, col - 3) +
          getZ(demRow + 3, col + 3)) *
        0.25;
      const cavityM = (avgRing1 - zCenter) * 0.55 + (avgRing2 - zCenter) * 0.45;
      const occlusion = Math.max(0.35, Math.min(1.12, 1.0 - cavityM / 380.0));
      ao[idx] = occlusion;

      // 8-Sector Horizon Elevation Raycast across the DEM patch
      for (let sIdx = 0; sIdx < 8; sIdx++) {
        const { dCol, dRow, stepDistM } = sectorSteps[sIdx];
        let maxElDeg = -5.0;
        let curCol = col + dCol;
        let curRow = demRow + dRow;
        let stepNum = 1;

        while (curCol >= 0 && curCol <= N - 1 && curRow >= 0 && curRow <= N - 1) {
          const r0 = Math.floor(curRow);
          const c0 = Math.floor(curCol);
          const r1 = Math.min(N - 1, r0 + 1);
          const c1 = Math.min(N - 1, c0 + 1);
          const fr = curRow - r0;
          const fc = curCol - c0;

          const zSample =
            (1 - fr) * ((1 - fc) * getZ(r0, c0) + fc * getZ(r0, c1)) +
            fr * ((1 - fc) * getZ(r1, c0) + fc * getZ(r1, c1));

          const distM = stepNum * stepDistM;
          const curvDropM = (distM * distM) / (2.0 * R_MOON_M);
          const elDeg = (Math.atan2(zSample - zCenter - curvDropM, distM) * 180.0) / Math.PI;

          if (elDeg > maxElDeg) {
            maxElDeg = elDeg;
          }

          curCol += dCol;
          curRow += dRow;
          stepNum++;
        }

        const encoded = encodeHorizonDegToByte(maxElDeg);
        if (sIdx < 4) {
          horizonSectorA[idx * 4 + sIdx] = encoded;
        } else {
          horizonSectorB[idx * 4 + (sIdx - 4)] = encoded;
        }
      }
    }
  }

  return {
    requestId,
    gridSize: N,
    positionsY,
    normals,
    slopesDeg,
    ao,
    horizonSectorA,
    horizonSectorB,
  };
}

interface WorkerScopeLike {
  onmessage: ((event: MessageEvent<TerrainWorkerInput>) => void) | null;
  postMessage: (message: TerrainWorkerOutput, transfer: Transferable[]) => void;
}

const workerScope = self as unknown as WorkerScopeLike;

if (typeof workerScope !== 'undefined' && typeof workerScope.postMessage === 'function') {
  workerScope.onmessage = (event: MessageEvent<TerrainWorkerInput>) => {
    const result = computeTerrainBuffers(event.data);
    workerScope.postMessage(result, [
      result.positionsY.buffer,
      result.normals.buffer,
      result.slopesDeg.buffer,
      result.ao.buffer,
      result.horizonSectorA.buffer,
      result.horizonSectorB.buffer,
    ]);
  };
}