# 05 // Technical Architecture, Dataset Pipeline & File Reference

This document maps every file in the **LUNA-NAV** repository (`backend/` and `frontend/`) to its role in the mathematical physics engine, the NASA TIFF ingestion pipeline, the REST API, and the React/Three.js UI.

---

## 1. Repository Directory Structure

```text
Luna Nav/
├── backend/
│   ├── data/
│   │   ├── south_pole_dem.tif       # 16-bit NASA LOLA South Pole Elevation TIFF
│   │   ├── south_pole_visual.tif    # LROC WAC South Pole Optical Albedo Mosaic TIFF
│   │   └── textures/                # Auto-generated 128x128 site PNG textures served at /static/
│   ├── main.py                      # FastAPI Server, /static/ mount, & 5 REST API endpoints
│   ├── physics_engine.py            # Skyfield de421.bsp + IAU Selenographic Ephemeris & Power Engine
│   ├── data_ingestion.py            # PIL + NumPy 128x128 DEM Extractor, 360° Ray-Caster & Thermal Model
│   ├── sites_catalog.py             # 6 Curated NASA Landing Sites & LOLA Macro-Topography Synthesizer
│   ├── fetch_nasa_data.py           # NASA SVS 4720 (CGI Moon Kit) Downloader & South Pole Cropper
│   └── requirements.txt             # Python dependencies (FastAPI, Uvicorn, Skyfield, NumPy, SciPy, Pillow)
├── frontend/
│   └── src/
│       ├── App.tsx                  # Master State Orchestrator & 60 FPS Synchronized Playback Loop
│       ├── types/
│       │   └── mission.ts           # Complete TypeScript interfaces matching FastAPI schemas
│       ├── api/
│       │   └── client.ts            # REST API fetch layer + deterministic offline physics fallback
│       └── components/
│           ├── HeaderBar.tsx                # Module A: Scenario controls, Hardware popover, Polar Map Picker
│           ├── TelemetryStrip.tsx           # Module B: 6 Real-Time KPI & Sunset/Earthset Countdown Cards
│           ├── LunarTerrain3D.tsx           # Module C: Three.js 128x128 DEM, LROC Texture & PSR Hazard Overlay
│           ├── PolarSkyChart.tsx            # Module D: 360° SVG Polar Azimuthal Horizon Sky-Radar
│           ├── MissionTimelineDock.tsx      # Module E: Dual Sliders, Gantt Ribbon, & Schedule Cliff Curve
│           ├── ScenarioCompareDashboard.tsx # Phase 2 Split-Screen 3D Comparator, Delta Matrix & Spider Radar
│           ├── ComparisonMatrix.tsx         # 4-Scenario Trade-Off Pinboard & Bar Chart
│           └── EducatorOverlay.tsx          # Guided Physics Cards, 4-Step Interactive Tutorial & Ops Manual
└── documentation/                   # This comprehensive documentation & visual asset library
```

---

## 2. Backend Module Reference (`backend/`)

### 2.1 `backend/data_ingestion.py` (NASA Dataset Pipeline — `Pillow` & `numpy`)
- **`_load_master_tiff_arrays()`**:
  - Uses `PIL.Image.open` to load `backend/data/south_pole_dem.tif` and `backend/data/south_pole_visual.tif` into `numpy` arrays cached via `@lru_cache`.
  - Scales raw DEM pixel values into a `[-4000.0m, +4000.0m]` relative elevation range and resizes the visual mosaic to match the DEM dimensions for 1-to-1 pixel alignment.
- **`read_lola_dem_patch(site, grid_size=128)`**:
  - Maps the target site's `(lat_deg, lon_deg)` to a $128 \times 128$ pixel window in the South Pole TIFF and combines the extracted micro-topography with the site's LOLA reference elevation datum.
- **`compute_vectorized_horizon_360(Z, patch_size_m)`**:
  - Uses vectorized `numpy` arrays and `scipy.ndimage.map_coordinates` to march $64$ distance steps along all $360$ compass azimuths ($0^\circ \dots 359^\circ$) simultaneously.
  - Applies the lunar curvature drop-off $-\frac{d^2}{2 R_{\text{moon}}}$ and spherical horizon dip floor $\theta_{\text{dip}}$ to return the 360-element skyline array.
- **`compute_instantaneous_temp_k(...)` & `read_diviner_thermal_metrics(...)`**:
  - Computes procedural South Pole temperatures (`local_temp_k`) from solar illumination fraction (`~220 K` in polar sunlight, `~40 K` in shadowed PSRs, `~390 K` at equatorial noon) and flags cryogenic hazards ($<70\text{ K}$).
- **`extract_lroc_texture_and_psr_mask(site, Z, patch_size_m)`**:
  - Crops the aligned $128 \times 128$ visual texture from `south_pole_visual.tif`, computes the slope gradient matrix $\nabla Z(x, y)$ (`mean_slope_deg`, `terrain_flatness_score`), generates the indigo-blue Permanently Shadowed Region (PSR) hazard overlay texture, saves static PNGs to `backend/data/textures/`, and encodes Base64 PNG data URIs.

### 2.2 `backend/physics_engine.py` (Astrodynamics & Selenographic Ephemeris)
- **`compute_topocentric_ephemeris(lat_deg, lon_deg, elev_m, timestamps_utc)`**:
  - Uses NASA JPL `de421.bsp` via `skyfield` (or the deterministic IAU 2015 Selenographic / ELP2000 analytical solver when offline) to compute J2000 ICRF position vectors of the Sun and Earth relative to the Moon.
  - Applies the IAU Mean Earth / Polar Axis rotation matrix `_iau_moon_orientation_matrix(jd)` (incorporating Cassini nodal precession and optical libration harmonics $E_1 \dots E_{10}$) and projects into the landing site's local East-North-Up ($\text{ENU}$) tangent plane.
- **`compute_solar_limb_fraction(sun_el_deg, horizon_el_deg)`**:
  - Computes fractional visibility $f_{\text{sun}} \in [0, 1]$ of the $r_\odot = 0.266^\circ$ solar disk across local mountain ridges.
- **`compute_array_power_kw(...)`**:
  - Evaluates electrical power output for `vertical_cylindrical` ($\cos\text{El}$), `dual_axis_tracking` ($1.0$), and `horizontal_deck` ($\sin\text{El}$) solar arrays.
- **`evaluate_mission_cached(...)`**:
  - `@lru_cache(maxsize=256)` master evaluator combining the $128 \times 128$ DEM, $360^\circ$ horizon profile, hourly timeline, sunset/earthset countdown timers, `local_temp_k`, and composite viability KPIs.

### 2.3 `backend/main.py` (FastAPI REST Server & Static Mount)
- **`GET /static/*`**: Serves `backend/data/` (including `/static/textures/<site_id>_visual.png` and `/static/textures/<site_id>_psr.png`).
- **`GET /api/sites`**: Returns the 6 curated landing sites from `sites_catalog.py`.
- **`POST /api/evaluate`**: Evaluates a single landing site/date configuration and returns the full $128 \times 128$ DEM, LROC textures, thermal metrics, $360^\circ$ horizon profile, timeline, and KPIs.
- **`POST /api/compare_scenarios`**: Evaluates `scenario_a` and `scenario_b` simultaneously and returns full payloads plus head-to-head delta metrics (`deltas`), category winner flags (`"A" | "B" | "TIE"`), and the 4-axis normalized `radar_comparison` array.
- **`POST /api/launch-slip-sweep`**: Evaluates 22 launch slip increments from $-14\text{d}$ to $+28\text{d}$ to generate the Schedule Cliff Sensitivity Curve.
- **`POST /api/compare`**: Evaluates up to 4 pinned scenarios for the bottom multi-site comparison pinboard.

---

## 3. Frontend Component Reference (`frontend/src/`)

| Component File | UI Module | Key Responsibilities |
| :--- | :--- | :--- |
| **`App.tsx`** | Root Orchestrator | Manages `workspaceViewMode` (`'compare' | 'single'`), Scenario A & B state, 60 FPS playback timer, and modal triggers. |
| **`components/ScenarioCompareDashboard.tsx`** | Phase 2 Split-Screen Comparator | Renders the Dual Scenario A/B configurators, 1-click trade-study presets, synchronized 60 FPS scrubber + dual ops ribbons, dual Three.js 3D viewports, high-contrast Trade-Off Matrix table, and 4-axis Recharts `<RadarChart>`. |
| **`components/LunarTerrain3D.tsx`** | Module C (3D DEM Viewport) | Renders the $128 \times 128$ displaced `THREE.PlaneGeometry`, applies the LROC WAC diffuse texture or PSR Cold-Trap overlay texture (`Show PSRs` button), animates the directional Sun shadow light and lander beacon, and switches between Orbital and Lander Surface cameras. |
| **`components/PolarSkyChart.tsx`** | Module D (360° Sky-Radar) | Renders the interactive SVG azimuthal radar with radial zoom ($[-5^\circ, +14^\circ]$ polar or $[-10^\circ, +90^\circ]$ equatorial), terrain mask polygon $H(\text{Az})$, $360^\circ$ Sun track, and Earth libration loop. |
| **`components/TelemetryStrip.tsx`** | Module B (6 KPI Cards) | Displays real-time Solar Tracking, Earth DTE Link, Array Power, Mission Sunlight %, Max Eclipse battery alert ($>50\text{h}$), and Composite Viability Verdict. |
| **`components/MissionTimelineDock.tsx`** | Module E (Single-Site Dock) | Houses the Mission Elapsed Time scrubber, Launch Slip slider ($-14\text{d}$ to $+28\text{d}$), clickable Operational Status Gantt ribbon, and 3 Recharts telemetry & schedule-cliff graphs. |
| **`components/HeaderBar.tsx`** | Module A (Top Control Bar) | Site selector, interactive South Pole Map Coordinate Picker modal, UTC date/duration controls, Hardware popover, and view mode switchers. |
| **`components/EducatorOverlay.tsx`** | Educator & Manual Modals | Renders the 4-card Educator Physics Banner, the 4-step Interactive Walkthrough Tutorial modal, and the 3-tab in-app Operations & Technical Manual. |

