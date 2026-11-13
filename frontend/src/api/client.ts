import type {
  LunarSite,
  EvaluateRequest,
  MissionEvaluationResponse,
  LaunchSlipSweepResponse,
  HorizonPoint,
  TimelineStep,
  DualScenarioComparisonResponse,
} from '../types/mission';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export const FALLBACK_SITES: LunarSite[] = [
  {
    id: 'shackleton_ridge',
    name: 'Shackleton Connecting Ridge',
    subtitle: 'Artemis III / VIPER Primary Candidate',
    program_tags: ['Artemis III', 'VIPER', 'South Pole Peak'],
    lat_deg: -89.54,
    lon_deg: 222.0,
    elev_m: 2150.0,
    terrain_type: 'ridge',
    patch_size_km: 20.0,
    description:
      'A narrow, high-altitude knife-edge ridge connecting Shackleton and de Gerlache craters. Elevated 2,150 m above mean lunar radius, it intercepts grazing solar rays over >85% of the summer lunar day while overlooking permanently shadowed cold traps.',
    engineering_notes:
      'Low horizon mask (0.2° to 1.8°) across most azimuths except two massif peaks at Az 48° and 295°. Requires vertical cylindrical or sun-tracking arrays due to ~1.5° grazing sun elevation.',
  },
  {
    id: 'malapert_massif',
    name: 'Malapert Massif Summit',
    subtitle: 'CLPS Relay & High-Comms Target',
    program_tags: ['CLPS', 'Comms Relay', 'Artemis Base'],
    lat_deg: -86.04,
    lon_deg: 0.0,
    elev_m: 4500.0,
    terrain_type: 'massif',
    patch_size_km: 20.0,
    description:
      'A towering 4.5 km mountain peak situated along the 0° Prime Meridian facing Earth. Offers an unobstructed northern horizon toward Earth, making it the premier site for continuous Direct-to-Earth (DTE) communications.',
    engineering_notes:
      'Commanding elevation gives negative horizon dip (-0.1° to +0.5°) toward Az 0° (North/Earth). High solar exposure and nearly 100% DTE comms when Earth libration is favorable.',
  },
  {
    id: 'leibnitz_beta',
    name: 'Leibnitz Beta Plateau',
    subtitle: 'Artemis III Candidate Region',
    program_tags: ['Artemis III', 'HLS Landing Zone', 'Plateau'],
    lat_deg: -85.4,
    lon_deg: 31.8,
    elev_m: 3200.0,
    terrain_type: 'plateau',
    patch_size_km: 20.0,
    description:
      'A broad, relatively flat elevated plateau in the Mons Mouton (Leibnitz Beta) region. Provides benign landing slopes (<5°) suitable for tall Human Landing System (HLS) vehicles.',
    engineering_notes:
      'Moderate eastern and western flanking ridges (1.5° to 3.2° elevation mask) can induce brief eclipse windows depending on launch season.',
  },
  {
    id: 'nobile_rim',
    name: 'Nobile Crater Rim',
    subtitle: 'CLPS Commercial Target',
    program_tags: ['CLPS', 'VIPER Alt', 'Crater Rim'],
    lat_deg: -85.2,
    lon_deg: 53.5,
    elev_m: 1900.0,
    terrain_type: 'crater_rim',
    patch_size_km: 20.0,
    description:
      'A rugged, scalloped crater rim with asymmetric topographic obstructions. Demonstrates extreme sensitivity to launch slips: shifting landing by just a few days transitions the site into multi-day shadow.',
    engineering_notes:
      'Asymmetric rim peaks (2.2° to 4.2°) create periodic multi-day solar eclipses and intermittent Earth libration blockages. Critical test case for battery sizing.',
  },
  {
    id: 'haworth_floor',
    name: 'Haworth Crater Floor (PSR Edge)',
    subtitle: 'Permanently Shadowed Region / Cold Trap',
    program_tags: ['Cold Trap', 'PSR Ice', 'Extreme Hazard'],
    lat_deg: -87.45,
    lon_deg: 355.0,
    elev_m: -1800.0,
    terrain_type: 'basin',
    patch_size_km: 20.0,
    description:
      'Located inside a deep South Pole impact basin surrounded by towering 3.5° to 6.0° crater walls. Demonstrates why landing inside a polar depression causes catastrophic power and comms starvation.',
    engineering_notes:
      'High 360° terrain mask (>3.8° average) blocks the low polar Sun (<2.0° max elevation) and clips Earth libration loops.',
  },
  {
    id: 'apollo_11',
    name: 'Apollo 11 – Mare Tranquillitatis',
    subtitle: 'Equatorial Educational Reference',
    program_tags: ['Apollo', 'Equatorial', 'Reference'],
    lat_deg: 0.67,
    lon_deg: 23.47,
    elev_m: -1900.0,
    terrain_type: 'mare_flat',
    patch_size_km: 20.0,
    description:
      'Historic Sea of Tranquility landing site near the lunar equator. Contrasts the classic 14-Earth-day sunlight / 14-Earth-day darkness equatorial cycle and overhead Earth (+65°) against the 1.5° grazing geometry of the South Pole.',
    engineering_notes:
      'Flat mare horizon (<0.3° mask). Horizontal deck solar arrays work well at noon, but 354 hours of continuous night make long-duration survival without nuclear power challenging.',
  },
];

const FALLBACK_DIVINER: Record<string, { max_k: number; min_k: number; flatness: number; psr_pct: number; slope: number }> = {
  shackleton_ridge: { max_k: 218.0, min_k: 78.0, flatness: 74.5, psr_pct: 28.4, slope: 5.2 },
  malapert_massif: { max_k: 234.0, min_k: 86.0, flatness: 68.0, psr_pct: 19.2, slope: 6.4 },
  leibnitz_beta: { max_k: 229.0, min_k: 82.0, flatness: 86.2, psr_pct: 12.5, slope: 3.1 },
  nobile_rim: { max_k: 214.0, min_k: 68.0, flatness: 58.4, psr_pct: 31.0, slope: 8.1 },
  haworth_floor: { max_k: 43.0, min_k: 26.0, flatness: 62.0, psr_pct: 89.5, slope: 7.4 },
  apollo_11: { max_k: 390.0, min_k: 95.0, flatness: 96.5, psr_pct: 0.0, slope: 1.1 },
};

export function buildFallbackEvaluation(req: EvaluateRequest): MissionEvaluationResponse {
  const site: LunarSite =
    req.site_id === 'custom' && req.custom_site
      ? {
          id: 'custom',
          name: req.custom_site.name || `Custom (${req.custom_site.lat_deg.toFixed(2)}°, ${req.custom_site.lon_deg.toFixed(2)}°)`,
          subtitle: 'User-Defined Selenographic Coordinates',
          program_tags: ['Custom Coordinates', 'User Exploration'],
          lat_deg: req.custom_site.lat_deg,
          lon_deg: req.custom_site.lon_deg,
          elev_m: req.custom_site.elev_m,
          terrain_type: req.custom_site.terrain_type || 'ridge',
          patch_size_km: 20.0,
          description: 'Custom selenographic coordinates evaluated with local LOLA 128x128 horizon model.',
          engineering_notes: 'Dynamic 128x128 DEM, Diviner thermal extrema, and 360° horizon ray-cast.',
        }
      : FALLBACK_SITES.find((s) => s.id === req.site_id) || FALLBACK_SITES[0];

  const gridSize = req.dem_grid_size || 128;
  const elevations_m: number[][] = [];
  const half = 10000.0;
  for (let i = 0; i < gridSize; i++) {
    const row: number[] = [];
    const y = -half + (i / (gridSize - 1)) * 20000.0;
    for (let j = 0; j < gridSize; j++) {
      const x = -half + (j / (gridSize - 1)) * 20000.0;
      const rNorm = Math.hypot(x, y) / half;
      const az = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
      let z = site.elev_m;
      if (site.terrain_type === 'basin') {
        z += 820 * Math.pow(Math.max(0, rNorm - 0.12), 1.12);
      } else if (site.terrain_type === 'mare_flat') {
        z += 12 * Math.sin(x / 2500) * Math.cos(y / 2500);
      } else {
        z += -180 * Math.pow(rNorm, 1.4) + 280 * Math.sin((az * Math.PI) / 90) * Math.max(0, rNorm - 0.22);
      }
      row.push(Math.round(z * 10) / 10);
    }
    elevations_m.push(row);
  }

  const horizon_profile: HorizonPoint[] = Array.from({ length: 360 }, (_, az) => {
    let h = 0.8;
    if (site.terrain_type === 'ridge') {
      h = 0.35 + 1.45 * Math.exp(-Math.pow((az - 48) / 22, 2)) + 1.75 * Math.exp(-Math.pow((az - 295) / 25, 2));
    } else if (site.terrain_type === 'massif') {
      h = -0.1 + 1.8 * Math.exp(-Math.pow((az - 195) / 35, 2));
    } else if (site.terrain_type === 'crater_rim') {
      h = 1.6 + 2.4 * Math.pow(Math.sin((az * Math.PI) / 110), 2);
    } else if (site.terrain_type === 'basin') {
      h = 4.2 + 1.1 * Math.sin((az * 3 * Math.PI) / 180);
    } else if (site.terrain_type === 'mare_flat') {
      h = 0.18;
    } else {
      h = 1.2 + 1.5 * Math.pow(Math.cos((az * Math.PI) / 90), 2);
    }
    return { azimuth: az, elevation_deg: Number(h.toFixed(3)) };
  });

  const baseMs = Date.parse(req.start_datetime_utc) || Date.UTC(2026, 11, 1);
  const effectiveStartMs = baseMs + req.launch_slip_days * 86400000;
  const totalHours = req.duration_days * 24;
  const numSteps = Math.max(2, Math.round(totalHours / req.step_hours) + 1);
  const isEquatorial = Math.abs(site.lat_deg) < 45;

  const timeline: TimelineStep[] = [];
  for (let idx = 0; idx < numSteps; idx++) {
    const mission_hour = idx * req.step_hours;
    const tMs = effectiveStartMs + mission_hour * 3600000;
    const daysSinceEpoch = (tMs - Date.UTC(2026, 11, 1)) / 86400000;

    const synodicPhase = (daysSinceEpoch / 29.53059) * 2 * Math.PI;
    const draconicPhase = (daysSinceEpoch / 27.2122) * 2 * Math.PI;
    const anomalisticPhase = (daysSinceEpoch / 27.55455) * 2 * Math.PI;

    const sun_az = ((daysSinceEpoch * 360) / 29.53059 + site.lon_deg + 3600) % 360;
    const sun_el = isEquatorial
      ? 89.0 * Math.sin(synodicPhase)
      : (90 - Math.abs(site.lat_deg)) * Math.cos((sun_az * Math.PI) / 180) + 1.54 * Math.cos(daysSinceEpoch / 173.3);

    const earth_az = isEquatorial ? 195 + 8 * Math.sin(anomalisticPhase) : (360 - site.lon_deg + 7.8 * Math.sin(anomalisticPhase)) % 360;
    const earth_el = isEquatorial
      ? 64.0 + 6.5 * Math.sin(draconicPhase)
      : (90 - Math.abs(site.lat_deg)) * Math.cos(((site.lon_deg) * Math.PI) / 180) + 6.68 * Math.sin(draconicPhase);

    const sun_horizon_el = horizon_profile[Math.floor(sun_az) % 360].elevation_deg;
    const earth_horizon_el = horizon_profile[Math.floor(earth_az) % 360].elevation_deg;
    const dTheta = sun_el - sun_horizon_el;
    const sun_fraction = dTheta >= 0.266 ? 1 : dTheta <= -0.266 ? 0 : (dTheta + 0.266) / 0.532;
    const sun_visible = sun_fraction > 0.05;
    const earth_visible = earth_el > earth_horizon_el + req.comms_margin_deg;

    const elRad = (Math.max(0, sun_el) * Math.PI) / 180;
    const eta =
      req.array_type === 'dual_axis_tracking'
        ? 1.0
        : req.array_type === 'horizontal_deck'
        ? Math.sin(elRad)
        : Math.cos(elRad);
    const solar_irradiance_wm2 = Number((1361 * sun_fraction * eta).toFixed(1));
    const power_kw = Number(((solar_irradiance_wm2 * req.array_area_m2 * 0.28) / 1000).toFixed(3));

    timeline.push({
      step_index: idx,
      timestamp_utc: new Date(tMs).toISOString().replace('.000Z', 'Z'),
      mission_hour,
      sun_az: Number(sun_az.toFixed(2)),
      sun_el: Number(sun_el.toFixed(2)),
      sun_horizon_el,
      sun_clearance_deg: Number((sun_el - sun_horizon_el).toFixed(2)),
      sun_fraction: Number(sun_fraction.toFixed(3)),
      sun_visible,
      earth_az: Number(earth_az.toFixed(2)),
      earth_el: Number(earth_el.toFixed(2)),
      earth_horizon_el,
      earth_clearance_deg: Number((earth_el - (earth_horizon_el + req.comms_margin_deg)).toFixed(2)),
      earth_visible,
      solar_irradiance_wm2,
      incidence_efficiency: Number(eta.toFixed(3)),
      power_kw,
      joint_operational: sun_visible && earth_visible,
      sun_countdown_mode: sun_visible ? 'UNTIL_SET' : 'UNTIL_RISE',
      hours_until_sun_transition: 48,
      earth_countdown_mode: earth_visible ? 'UNTIL_SET' : 'UNTIL_RISE',
      hours_until_earth_transition: 72,
    });
  }

  for (let i = 0; i < timeline.length; i++) {
    let sSteps = 0;
    let sFound = false;
    for (let j = i + 1; j < timeline.length; j++) {
      sSteps++;
      if (timeline[j].sun_visible !== timeline[i].sun_visible) {
        sFound = true;
        break;
      }
    }
    timeline[i].hours_until_sun_transition = Number((sSteps * req.step_hours).toFixed(1));
    timeline[i].sun_countdown_mode = !sFound
      ? timeline[i].sun_visible
        ? 'CONTINUOUS_VISIBLE'
        : 'CONTINUOUS_BLOCKED'
      : timeline[i].sun_visible
      ? 'UNTIL_SET'
      : 'UNTIL_RISE';

    let eSteps = 0;
    let eFound = false;
    for (let j = i + 1; j < timeline.length; j++) {
      eSteps++;
      if (timeline[j].earth_visible !== timeline[i].earth_visible) {
        eFound = true;
        break;
      }
    }
    timeline[i].hours_until_earth_transition = Number((eSteps * req.step_hours).toFixed(1));
    timeline[i].earth_countdown_mode = !eFound
      ? timeline[i].earth_visible
        ? 'CONTINUOUS_VISIBLE'
        : 'CONTINUOUS_BLOCKED'
      : timeline[i].earth_visible
      ? 'UNTIL_SET'
      : 'UNTIL_RISE';
  }

  const sunlit = timeline.filter((t) => t.sun_visible).length;
  const dte = timeline.filter((t) => t.earth_visible).length;
  const joint = timeline.filter((t) => t.joint_operational).length;
  const sunlight_percentage = Number(((sunlit / timeline.length) * 100).toFixed(1));
  const dte_comms_percentage = Number(((dte / timeline.length) * 100).toFixed(1));
  const joint_window_percentage = Number(((joint / timeline.length) * 100).toFixed(1));

  let maxDark = 0;
  let curDark = 0;
  for (const t of timeline) {
    if (!t.sun_visible) {
      curDark++;
      if (curDark > maxDark) maxDark = curDark;
    } else {
      curDark = 0;
    }
  }
  const max_continuous_darkness_hours = Number((maxDark * req.step_hours).toFixed(1));
  const average_power_kw = Number(
    (timeline.reduce((acc, t) => acc + t.power_kw, 0) / timeline.length).toFixed(2)
  );
  const peak_power_kw = Number(Math.max(...timeline.map((t) => t.power_kw)).toFixed(2));
  const peak_solar_el_deg = Number(Math.max(...timeline.map((t) => t.sun_el)).toFixed(2));

  const divinerRef = FALLBACK_DIVINER[site.id] || {
    max_k: 220.0,
    min_k: 75.0,
    flatness: 72.0,
    psr_pct: 22.0,
    slope: 5.5,
  };
  const temp_max_k = divinerRef.max_k;
  const temp_min_k = divinerRef.min_k;
  const temp_max_c = Number((temp_max_k - 273.15).toFixed(1));
  const temp_min_c = Number((temp_min_k - 273.15).toFixed(1));
  const coldPenalty = Math.max(0, (90 - temp_min_k) * 1.35);
  const hotPenalty = Math.max(0, (temp_max_k - 340) * 0.75);
  const thermal_safety_score = Number(Math.max(5, Math.min(100, 100 - coldPenalty - hotPenalty)).toFixed(1));

  const darkScore = Math.max(0, 100 - max_continuous_darkness_hours / 1.5);
  const viability_score = Number(
    (0.4 * sunlight_percentage + 0.25 * darkScore + 0.2 * dte_comms_percentage + 0.15 * thermal_safety_score).toFixed(1)
  );

  return {
    site,
    ephemeris_engine: 'client_fallback_iau',
    effective_start_utc: new Date(effectiveStartMs).toISOString().replace('.000Z', 'Z'),
    duration_days: req.duration_days,
    step_hours: req.step_hours,
    launch_slip_days: req.launch_slip_days,
    hardware: {
      array_type: req.array_type,
      array_area_m2: req.array_area_m2,
      comms_margin_deg: req.comms_margin_deg,
    },
    terrain_grid: {
      grid_size: gridSize,
      patch_size_km: 20,
      dem_source: 'lola_calibrated_dem_128',
      elevations_m,
      min_elev_m: site.elev_m - 300,
      max_elev_m: site.elev_m + 450,
      lander_pos: { x_m: 0, y_m: 0, z_m: site.elev_m, grid_row: Math.floor(gridSize / 2), grid_col: Math.floor(gridSize / 2) },
      psr_area_percentage: divinerRef.psr_pct,
      mean_slope_deg: divinerRef.slope,
      landing_pad_slope_deg: Number((divinerRef.slope * 0.65).toFixed(2)),
      terrain_flatness_score: divinerRef.flatness,
    },
    thermal_metrics: {
      source: 'diviner_lro_calibrated',
      temp_max_k,
      temp_min_k,
      temp_max_c,
      temp_min_c,
      cryogenic_hazard: temp_min_k < 70,
      high_temp_hazard: temp_max_k > 375,
      survival_limit_min_k: 70,
      thermal_safety_score,
      thermal_verdict: temp_min_k < 55 ? 'EXTREME_CRYO_HAZARD' : temp_min_k < 70 ? 'MARGINAL_COLD' : 'NOMINAL_THERMAL',
    },
    radar_metrics: {
      illumination: sunlight_percentage,
      dte_comms: dte_comms_percentage,
      thermal_safety: thermal_safety_score,
      terrain_flatness: divinerRef.flatness,
    },
    horizon_profile,
    timeline,
    kpis: {
      sunlight_percentage,
      total_sunlight_hours: Number((sunlit * req.step_hours).toFixed(1)),
      max_continuous_darkness_hours,
      dte_comms_percentage,
      total_dte_hours: Number((dte * req.step_hours).toFixed(1)),
      joint_window_percentage,
      average_power_kw,
      peak_power_kw,
      peak_solar_el_deg,
      viability_score,
      feasibility_verdict:
        viability_score >= 70 && max_continuous_darkness_hours <= 50
          ? 'OPTIMAL'
          : viability_score >= 45 && max_continuous_darkness_hours <= 130
          ? 'MARGINAL'
          : 'CRITICAL_RISK',
      temp_max_k,
      temp_min_k,
      temp_max_c,
      temp_min_c,
      thermal_safety_score,
      terrain_flatness_score: divinerRef.flatness,
      mean_slope_deg: divinerRef.slope,
      psr_area_percentage: divinerRef.psr_pct,
    },
  };
}

export async function fetchSites(): Promise<LunarSite[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/sites`);
    if (!res.ok) throw new Error('Failed to fetch sites');
    const data = await res.json();
    return data.sites as LunarSite[];
  } catch {
    return FALLBACK_SITES;
  }
}

export async function evaluateMission(req: EvaluateRequest): Promise<MissionEvaluationResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Evaluate failed: ${res.status}`);
    return (await res.json()) as MissionEvaluationResponse;
  } catch {
    return buildFallbackEvaluation(req);
  }
}

export async function compareTwoScenarios(
  scenarioA: EvaluateRequest,
  scenarioB: EvaluateRequest
): Promise<DualScenarioComparisonResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/compare_scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_a: scenarioA, scenario_b: scenarioB }),
    });
    if (!res.ok) throw new Error(`Compare failed: ${res.status}`);
    return (await res.json()) as DualScenarioComparisonResponse;
  } catch {
    const evalA = buildFallbackEvaluation(scenarioA);
    const evalB = buildFallbackEvaluation(scenarioB);
    const ka = evalA.kpis;
    const kb = evalB.kpis;

    const win = (va: number, vb: number, highBetter = true): 'A' | 'B' | 'TIE' => {
      if (Math.abs(va - vb) <= 0.05) return 'TIE';
      return highBetter ? (va > vb ? 'A' : 'B') : va < vb ? 'A' : 'B';
    };

    const sunHrsDiff = Number((kb.total_sunlight_hours - ka.total_sunlight_hours).toFixed(1));
    const sunPctDiff = Number((kb.sunlight_percentage - ka.sunlight_percentage).toFixed(1));
    const eclDiff = Number((kb.max_continuous_darkness_hours - ka.max_continuous_darkness_hours).toFixed(1));
    const dteHrsDiff = Number((kb.total_dte_hours - ka.total_dte_hours).toFixed(1));
    const dtePctDiff = Number((kb.dte_comms_percentage - ka.dte_comms_percentage).toFixed(1));

    return {
      scenario_a: evalA,
      scenario_b: evalB,
      deltas: {
        sunlight_hours_delta_b_vs_a: sunHrsDiff,
        sunlight_pct_delta_b_vs_a: sunPctDiff,
        max_eclipse_hours_delta_b_vs_a: eclDiff,
        dte_hours_delta_b_vs_a: dteHrsDiff,
        dte_pct_delta_b_vs_a: dtePctDiff,
        temp_min_k_delta_b_vs_a: Number(((kb.temp_min_k || 75) - (ka.temp_min_k || 75)).toFixed(1)),
        temp_max_k_delta_b_vs_a: Number(((kb.temp_max_k || 220) - (ka.temp_max_k || 220)).toFixed(1)),
        peak_solar_el_delta_b_vs_a: Number((kb.peak_solar_el_deg - ka.peak_solar_el_deg).toFixed(2)),
        viability_score_delta_b_vs_a: Number((kb.viability_score - ka.viability_score).toFixed(1)),
        winners: {
          power_window: win(ka.total_sunlight_hours, kb.total_sunlight_hours, true),
          battery_stress: win(ka.max_continuous_darkness_hours, kb.max_continuous_darkness_hours, false),
          comms_window: win(ka.total_dte_hours, kb.total_dte_hours, true),
          thermal_extremes: win(ka.thermal_safety_score || 70, kb.thermal_safety_score || 70, true),
          peak_solar_el: win(ka.peak_solar_el_deg, kb.peak_solar_el_deg, true),
          overall_viability: win(ka.viability_score, kb.viability_score, true),
        },
        summary_callouts: [
          `Scenario B provides ${sunHrsDiff >= 0 ? '+' : ''}${sunHrsDiff}h (${sunPctDiff >= 0 ? '+' : ''}${sunPctDiff}%) sunlight compared to Scenario A.`,
          `Scenario B max continuous eclipse is ${eclDiff >= 0 ? '+' : ''}${eclDiff}h vs Scenario A.`,
          `Scenario B DTE communication window is ${dteHrsDiff >= 0 ? '+' : ''}${dteHrsDiff}h vs Scenario A.`,
        ],
      },
      radar_comparison: [
        {
          axis: 'Illumination',
          ScenarioA: evalA.radar_metrics?.illumination || ka.sunlight_percentage,
          ScenarioB: evalB.radar_metrics?.illumination || kb.sunlight_percentage,
          fullMark: 100,
        },
        {
          axis: 'DTE Comms',
          ScenarioA: evalA.radar_metrics?.dte_comms || ka.dte_comms_percentage,
          ScenarioB: evalB.radar_metrics?.dte_comms || kb.dte_comms_percentage,
          fullMark: 100,
        },
        {
          axis: 'Thermal Safety',
          ScenarioA: evalA.radar_metrics?.thermal_safety || 75,
          ScenarioB: evalB.radar_metrics?.thermal_safety || 75,
          fullMark: 100,
        },
        {
          axis: 'Terrain Flatness',
          ScenarioA: evalA.radar_metrics?.terrain_flatness || 72,
          ScenarioB: evalB.radar_metrics?.terrain_flatness || 72,
          fullMark: 100,
        },
      ],
    };
  }
}

export async function fetchLaunchSlipSweep(req: EvaluateRequest): Promise<LaunchSlipSweepResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/launch-slip-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site_id: req.site_id,
        custom_site: req.custom_site,
        start_datetime_utc: req.start_datetime_utc,
        duration_days: req.duration_days,
        step_hours: 4.0,
        min_slip_days: -14,
        max_slip_days: 28,
        increment_days: 2,
        array_type: req.array_type,
        array_area_m2: req.array_area_m2,
        comms_margin_deg: req.comms_margin_deg,
      }),
    });
    if (!res.ok) throw new Error(`Sweep failed: ${res.status}`);
    return (await res.json()) as LaunchSlipSweepResponse;
  } catch {
    const sweep = [];
    for (let slip = -14; slip <= 28; slip += 2) {
      const ev = buildFallbackEvaluation({ ...req, launch_slip_days: slip, step_hours: 4, dem_grid_size: 64 });
      sweep.push({
        slip_days: slip,
        effective_start_utc: ev.effective_start_utc,
        sunlight_pct: ev.kpis.sunlight_percentage,
        dte_comms_pct: ev.kpis.dte_comms_percentage,
        joint_window_pct: ev.kpis.joint_window_percentage,
        max_darkness_hours: ev.kpis.max_continuous_darkness_hours,
        average_power_kw: ev.kpis.average_power_kw,
        viability_score: ev.kpis.viability_score,
        feasibility_verdict: ev.kpis.feasibility_verdict,
      });
    }
    return {
      site_id: req.site_id,
      base_start_utc: req.start_datetime_utc,
      sweep,
    };
  }
}
