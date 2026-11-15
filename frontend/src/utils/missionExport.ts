import type {
  CustomSiteInput,
  MissionEvaluationResponse,
  SolarArrayType,
  TimelineStep,
} from '../types/mission';
import type {
  CameraPresetId,
  MeasurePoint3D,
  ProjectionMode,
} from '../types/workbench';

export interface HydratedWorkbenchState {
  siteId?: string;
  customSite?: CustomSiteInput | null;
  startDateStr?: string;
  durationDays?: number;
  launchSlipDays?: number;
  arrayType?: SolarArrayType;
  projection?: ProjectionMode;
  cameraPreset?: CameraPresetId;
  stepIndex?: number;
}

const VALID_PROJECTIONS: ProjectionMode[] = ['3d_terrain', '2d_polar', 'split'];
const VALID_CAMERA_PRESETS: CameraPresetId[] = ['orbit', 'top_down', 'low_oblique'];
const VALID_ARRAYS: SolarArrayType[] = [
  'vertical_cylindrical',
  'dual_axis_tracking',
  'horizontal_deck',
];

/**
 * Parse and validate shareable workbench parameters from window.location.search.
 */
export function parseInitialWorkbenchUrlState(): HydratedWorkbenchState {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: HydratedWorkbenchState = {};

  const site = params.get('site');
  if (site) {
    out.siteId = site;
    if (site === 'custom') {
      const lat = Number(params.get('lat'));
      const lon = Number(params.get('lon'));
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        out.customSite = {
          lat_deg: Math.max(-90, Math.min(90, lat)),
          lon_deg: ((lon % 360) + 360) % 360,
          elev_m: 1500,
          terrain_type: 'ridge',
        };
      }
    }
  }

  const date = params.get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    out.startDateStr = date;
  }

  const dur = Number(params.get('dur'));
  if ([14, 30, 60].includes(dur)) {
    out.durationDays = dur;
  }

  const slipRaw = params.get('slip');
  if (slipRaw !== null && slipRaw !== '') {
    const slip = Number(slipRaw);
    if (Number.isFinite(slip)) {
      out.launchSlipDays = Math.max(-14, Math.min(28, Math.round(slip)));
    }
  }

  const array = params.get('array') as SolarArrayType | null;
  if (array && VALID_ARRAYS.includes(array)) {
    out.arrayType = array;
  }

  const proj = params.get('proj') as ProjectionMode | null;
  if (proj && VALID_PROJECTIONS.includes(proj)) {
    out.projection = proj;
  }

  const cam = params.get('cam') as CameraPresetId | null;
  if (cam && VALID_CAMERA_PRESETS.includes(cam)) {
    out.cameraPreset = cam;
  }

  const stepRaw = params.get('step');
  if (stepRaw !== null && stepRaw !== '') {
    const step = Number(stepRaw);
    if (Number.isInteger(step) && step >= 0) {
      out.stepIndex = step;
    }
  }

  return out;
}

/**
 * Build a full reproducible URL representing the active site, epoch, hardware, and camera state.
 */
export function buildShareableWorkbenchUrl(state: {
  siteId: string;
  customSite: CustomSiteInput | null;
  startDateStr: string;
  durationDays: number;
  launchSlipDays: number;
  arrayType: SolarArrayType;
  projection: ProjectionMode;
  cameraPreset: CameraPresetId;
  stepIndex: number;
}): string {
  const params = new URLSearchParams({
    site: state.siteId,
    date: state.startDateStr,
    dur: String(state.durationDays),
    slip: String(state.launchSlipDays),
    array: state.arrayType,
    proj: state.projection,
    cam: state.cameraPreset,
    step: String(state.stepIndex),
  });

  if (state.siteId === 'custom' && state.customSite) {
    params.set('lat', state.customSite.lat_deg.toFixed(4));
    params.set('lon', state.customSite.lon_deg.toFixed(3));
  }

  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Capture the active WebGL terrain canvas and composite an SVS-style telemetry caption bar.
 */
export function captureViewportPngSnapshot(
  evaluation: MissionEvaluationResponse,
  currentStep: TimelineStep
): boolean {
  const webglCanvas = document.querySelector('canvas');
  if (!webglCanvas || webglCanvas.width === 0 || webglCanvas.height === 0) {
    return false;
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = webglCanvas.width;
  outCanvas.height = webglCanvas.height;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return false;

  ctx.drawImage(webglCanvas, 0, 0);

  // SVS-style bottom telemetry caption strip
  const barHeight = Math.max(44, Math.round(outCanvas.height * 0.055));
  const y0 = outCanvas.height - barHeight;
  ctx.fillStyle = 'rgba(5, 7, 11, 0.86)';
  ctx.fillRect(0, y0, outCanvas.width, barHeight);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y0);
  ctx.lineTo(outCanvas.width, y0);
  ctx.stroke();

  const fontSize = Math.max(12, Math.round(barHeight * 0.34));
  const padX = Math.max(16, Math.round(outCanvas.width * 0.015));
  ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = '#F8FAFC';
  ctx.textBaseline = 'middle';

  const latStr =
    evaluation.site.lat_deg >= 0
      ? `${evaluation.site.lat_deg.toFixed(2)}°N`
      : `${Math.abs(evaluation.site.lat_deg).toFixed(2)}°S`;
  const leftText = `LUNA-NAV • ${evaluation.site.name} (${latStr}, ${evaluation.site.lon_deg.toFixed(1)}°E) • ${currentStep.timestamp_utc.replace('T', ' ').slice(0, 16)} UTC`;
  ctx.fillText(leftText, padX, y0 + barHeight * 0.5);

  const rightText = `SUN ${currentStep.sun_el.toFixed(1)}° EL / ${currentStep.sun_az.toFixed(0)}° AZ • EARTH ${currentStep.earth_visible ? 'DTE' : 'LOS BLOCKED'}`;
  ctx.fillStyle = '#38BDF8';
  const rightWidth = ctx.measureText(rightText).width;
  ctx.fillText(rightText, Math.max(padX, outCanvas.width - padX - rightWidth), y0 + barHeight * 0.5);

  const safeSiteId = evaluation.site.id.replace(/[^a-z0-9_-]/gi, '_');
  const dateTag = currentStep.timestamp_utc.slice(0, 10);

  outCanvas.toBlob((blob) => {
    if (blob) {
      triggerBlobDownload(blob, `luna-nav_${safeSiteId}_${dateTag}.png`);
    }
  }, 'image/png');

  return true;
}

/**
 * Export structured mission trade-study evaluation report as formatted JSON.
 */
export function exportMissionReportJson(
  evaluation: MissionEvaluationResponse,
  params: {
    startDateStr: string;
    durationDays: number;
    launchSlipDays: number;
    arrayType: SolarArrayType;
    arrayAreaM2: number;
    commsMarginDeg: number;
    measurePoints: MeasurePoint3D[];
  }
): void {
  const { elevations_m: _omitElevations, ...terrainSummary } = evaluation.terrain_grid;
  void _omitElevations;

  const report = {
    schema: 'LUNA-NAV Mission Trade Report v1.0',
    exported_at_utc: new Date().toISOString(),
    ephemeris_engine: evaluation.ephemeris_engine,
    site: evaluation.site,
    mission_parameters: {
      start_date_utc: params.startDateStr,
      duration_days: params.durationDays,
      launch_slip_days: params.launchSlipDays,
      array_type: params.arrayType,
      array_area_m2: params.arrayAreaM2,
      comms_margin_deg: params.commsMarginDeg,
    },
    kpis: evaluation.kpis,
    terrain_summary: terrainSummary,
    geodesic_measurements: params.measurePoints,
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json',
  });
  const safeSiteId = evaluation.site.id.replace(/[^a-z0-9_-]/gi, '_');
  triggerBlobDownload(blob, `luna-nav_report_${safeSiteId}_${params.startDateStr}.json`);
}

/**
 * Export the full ephemeris, illumination, Earth DTE, and power timeline as CSV.
 */
export function exportTimelineCsv(
  siteId: string,
  startDateStr: string,
  timeline: TimelineStep[]
): void {
  if (timeline.length === 0) return;
  const headers = Object.keys(timeline[0]) as (keyof TimelineStep)[];
  const lines = [
    headers.join(','),
    ...timeline.map((row) =>
      headers.map((key) => JSON.stringify(row[key] ?? '')).join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const safeSiteId = siteId.replace(/[^a-z0-9_-]/gi, '_');
  triggerBlobDownload(blob, `luna-nav_timeline_${safeSiteId}_${startDateStr}.csv`);
}