export type RailPanelId =
  | 'sites'
  | 'layers'
  | 'tools'
  | 'bookmarks'
  | 'compare'
  | 'guide';

export type ProjectionMode = '3d_terrain' | '2d_polar' | 'split';

export type CameraPresetId = 'orbit' | 'top_down' | 'low_oblique';

export type ActiveToolId =
  | 'none'
  | 'point_inspect'
  | 'distance'
  | 'area'
  | 'circle'
  | 'profile';

export type ColormapId = 'cividis' | 'viridis' | 'inferno' | 'grayscale';

export type LayerGroupId =
  | 'Basemap'
  | 'Elevation'
  | 'Slope'
  | 'Illumination'
  | 'Visibility'
  | 'Features'
  | 'Sites';

export interface LayerItemState {
  id: string;
  label: string;
  group: LayerGroupId;
  visible: boolean;
  opacity: number; // 0..1
  colormap?: ColormapId;
  unit?: string;
  minVal?: number;
  maxVal?: number;
  minBound?: number;
  maxBound?: number;
  gamma?: number;
  sourceNote: string;
  instrumentMeta?: string;
  resolutionMeta?: string;
  datumMeta?: string;
}

export interface ContourSettings {
  visible: boolean;
  intervalM: number;
}

export interface GraticuleSettings {
  visible: boolean;
  rangeRings: boolean;
}

export interface BookmarkItem {
  id: string;
  name: string;
  siteId: string;
  startDateStr: string;
  launchSlipDays: number;
  projection: ProjectionMode;
  createdAtUtc: string;
}

export interface CursorTelemetry {
  latDeg: number;
  lonDeg: number;
  elevM: number;
  slopeDeg: number;
  sunlit: boolean;
  earthVisible: boolean;
}

export interface MeasurePoint3D {
  id: string;
  sceneX: number; // [-10..10] East
  sceneZ: number; // [-10..10] South
  latDeg: number;
  lonDeg: number;
  elevM: number;
  slopeDeg: number;
}

export interface ProfileSamplePoint {
  t: number; // 0..1 normalized along transect
  distanceKm: number;
  sceneX: number;
  sceneZ: number;
  latDeg: number;
  lonDeg: number;
  elevM: number;
  slopeDeg: number;
}