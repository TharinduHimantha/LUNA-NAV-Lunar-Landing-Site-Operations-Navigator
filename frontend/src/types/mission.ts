export type SolarArrayType = 'vertical_cylindrical' | 'dual_axis_tracking' | 'horizontal_deck';

export type FeasibilityVerdict = 'OPTIMAL' | 'MARGINAL' | 'CRITICAL_RISK';

export type PersonaMode = 'engineering' | 'educator';

export type WorkspaceViewMode = 'compare' | 'single';

export interface LunarSite {
  id: string;
  name: string;
  subtitle: string;
  program_tags: string[];
  lat_deg: number;
  lon_deg: number;
  elev_m: number;
  terrain_type: string;
  patch_size_km: number;
  description: string;
  engineering_notes: string;
}

export interface CustomSiteInput {
  name?: string;
  lat_deg: number;
  lon_deg: number;
  elev_m: number;
  terrain_type: string;
}

export interface EvaluateRequest {
  site_id: string;
  custom_site?: CustomSiteInput | null;
  start_datetime_utc: string;
  duration_days: number;
  step_hours: number;
  launch_slip_days: number;
  array_type: SolarArrayType;
  array_area_m2: number;
  comms_margin_deg: number;
  dem_grid_size?: number;
}

export interface HorizonPoint {
  azimuth: number;
  elevation_deg: number;
}

export interface TimelineStep {
  step_index: number;
  timestamp_utc: string;
  mission_hour: number;
  sun_az: number;
  sun_el: number;
  sun_horizon_el: number;
  sun_clearance_deg: number;
  sun_fraction: number;
  sun_visible: boolean;
  earth_az: number;
  earth_el: number;
  earth_horizon_el: number;
  earth_clearance_deg: number;
  earth_visible: boolean;
  solar_irradiance_wm2: number;
  incidence_efficiency: number;
  power_kw: number;
  local_temp_k?: number;
  joint_operational: boolean;
  sun_countdown_mode: 'UNTIL_SET' | 'UNTIL_RISE' | 'CONTINUOUS_VISIBLE' | 'CONTINUOUS_BLOCKED';
  hours_until_sun_transition: number;
  earth_countdown_mode: 'UNTIL_SET' | 'UNTIL_RISE' | 'CONTINUOUS_VISIBLE' | 'CONTINUOUS_BLOCKED';
  hours_until_earth_transition: number;
}

export interface ThermalMetrics {
  source: string;
  local_temp_k?: number;
  local_temp_c?: number;
  temp_max_k: number;
  temp_min_k: number;
  temp_max_c: number;
  temp_min_c: number;
  cryogenic_hazard: boolean;
  high_temp_hazard: boolean;
  survival_limit_min_k: number;
  thermal_safety_score: number;
  thermal_verdict: string;
}

export interface RadarMetrics {
  illumination: number;
  dte_comms: number;
  thermal_safety: number;
  terrain_flatness: number;
}

export interface MissionKPIs {
  sunlight_percentage: number;
  total_sunlight_hours: number;
  max_continuous_darkness_hours: number;
  dte_comms_percentage: number;
  total_dte_hours: number;
  joint_window_percentage: number;
  average_power_kw: number;
  peak_power_kw: number;
  peak_solar_el_deg: number;
  viability_score: number;
  feasibility_verdict: FeasibilityVerdict;
  local_temp_k?: number;
  temp_max_k?: number;
  temp_min_k?: number;
  temp_max_c?: number;
  temp_min_c?: number;
  thermal_safety_score?: number;
  terrain_flatness_score?: number;
  mean_slope_deg?: number;
  psr_area_percentage?: number;
}

export interface TerrainGridData {
  grid_size: number;
  patch_size_km: number;
  dem_source?: string;
  elevations_m: number[][];
  min_elev_m: number;
  max_elev_m: number;
  lander_pos: {
    x_m: number;
    y_m: number;
    z_m: number;
    grid_row: number;
    grid_col: number;
  };
  lroc_texture_url?: string;
  lroc_psr_texture_url?: string;
  lroc_texture_base64?: string;
  lroc_psr_texture_base64?: string;
  psr_area_percentage?: number;
  mean_slope_deg?: number;
  landing_pad_slope_deg?: number;
  terrain_flatness_score?: number;
}

export interface MissionEvaluationResponse {
  site: LunarSite;
  ephemeris_engine: string;
  effective_start_utc: string;
  duration_days: number;
  step_hours: number;
  launch_slip_days: number;
  hardware: {
    array_type: SolarArrayType;
    array_area_m2: number;
    comms_margin_deg: number;
  };
  terrain_grid: TerrainGridData;
  local_temp_k?: number;
  thermal_metrics?: ThermalMetrics;
  radar_metrics?: RadarMetrics;
  horizon_profile: HorizonPoint[];
  timeline: TimelineStep[];
  kpis: MissionKPIs;
}

export interface ScenarioComparisonDeltas {
  sunlight_hours_delta_b_vs_a: number;
  sunlight_pct_delta_b_vs_a: number;
  max_eclipse_hours_delta_b_vs_a: number;
  dte_hours_delta_b_vs_a: number;
  dte_pct_delta_b_vs_a: number;
  temp_min_k_delta_b_vs_a: number;
  temp_max_k_delta_b_vs_a: number;
  peak_solar_el_delta_b_vs_a: number;
  viability_score_delta_b_vs_a: number;
  winners: {
    power_window: 'A' | 'B' | 'TIE';
    battery_stress: 'A' | 'B' | 'TIE';
    comms_window: 'A' | 'B' | 'TIE';
    thermal_extremes: 'A' | 'B' | 'TIE';
    peak_solar_el: 'A' | 'B' | 'TIE';
    overall_viability: 'A' | 'B' | 'TIE';
  };
  summary_callouts: string[];
}

export interface RadarComparisonAxisPoint {
  axis: string;
  ScenarioA: number;
  ScenarioB: number;
  fullMark: number;
}

export interface DualScenarioComparisonResponse {
  scenario_a: MissionEvaluationResponse;
  scenario_b: MissionEvaluationResponse;
  deltas: ScenarioComparisonDeltas;
  radar_comparison: RadarComparisonAxisPoint[];
}

export interface LaunchSlipSweepPoint {
  slip_days: number;
  effective_start_utc: string;
  sunlight_pct: number;
  dte_comms_pct: number;
  joint_window_pct: number;
  max_darkness_hours: number;
  average_power_kw: number;
  viability_score: number;
  feasibility_verdict: FeasibilityVerdict;
}

export interface LaunchSlipSweepResponse {
  site_id: string;
  base_start_utc: string;
  sweep: LaunchSlipSweepPoint[];
}

export interface PinnedScenario {
  scenario_id: string;
  label: string;
  evaluation: MissionEvaluationResponse;
}
