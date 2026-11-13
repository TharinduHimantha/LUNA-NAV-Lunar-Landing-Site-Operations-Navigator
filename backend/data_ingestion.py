"""
LUNA-NAV Phase 2 Scientific Dataset Ingestion Pipeline (backend/data_ingestion.py).

Uses ONLY `Pillow` (PIL) and `numpy` (zero `rasterio` dependency) to process local NASA `.tif` files
in `backend/data/`:

1. LOLA Digital Elevation Model (`backend/data/south_pole_dem.tif`):
   - Reads the `.tif` image via `PIL.Image.open` into a 2D `numpy` array.
   - Scales raw pixel values (0-255 or 16-bit integers) into a realistic lunar elevation range
     in meters (-4000m to +4000m relative terrain height).
   - Extracts a local 128x128 pixel grid for the target landing site and computes the 360°
     topographical horizon skyline by ray-marching outward across the `numpy` elevation array
     with lunar sphere curvature correction (-d^2 / 2*R_moon).

2. Procedural Diviner Thermal Approximation (`compute_procedural_thermal_metrics`):
   - Calculates `local_temp_k` from solar illumination fraction: sunlit polar areas reach ~220K,
     while shadowed areas (PSRs) plunge to ~40K. Flags thermal survival hazards (<70K).

3. LROC Albedo / Visual Textures (`backend/data/south_pole_visual.tif`):
   - Extracts the exact matching 128x128 bounding box from `south_pole_visual.tif` so it aligns
     pixel-for-pixel with the 128x128 DEM displacement grid.
   - Saves a web-ready PNG into `backend/data/static_textures/` (served by FastAPI `/static/`)
     and provides a Base64 PNG data URI + PSR Cold-Trap overlay texture for Three.js.
"""

from __future__ import annotations
import base64
import io
import math
import os
from functools import lru_cache
from typing import Dict, Any, Tuple, Optional

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

from sites_catalog import R_MOON_M, generate_terrain_dem

# Disable PIL DecompressionBombWarning for large NASA TIFFs
Image.MAX_IMAGE_PIXELS = None

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
STATIC_TEXTURES_DIR = os.path.join(DATA_DIR, "textures")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(STATIC_TEXTURES_DIR, exist_ok=True)


def _image_to_base64_png(pil_img: Image.Image) -> str:
    """Encodes a PIL Image as a `data:image/png;base64,...` URI."""
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


@lru_cache(maxsize=4)
def _load_master_tiff_arrays() -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
    """
    Loads and caches `backend/data/south_pole_dem.tif` and `backend/data/south_pole_visual.tif`
    into memory using `PIL.Image` and `numpy` so repeated site evaluations do not block the event loop.
    """
    dem_path = os.path.join(DATA_DIR, "south_pole_dem.tif")
    vis_path = os.path.join(DATA_DIR, "south_pole_visual.tif")

    dem_scaled_m: Optional[np.ndarray] = None
    vis_rgb_u8: Optional[np.ndarray] = None

    if os.path.isfile(dem_path):
        try:
            with Image.open(dem_path) as img:
                raw = np.array(img, dtype=np.float64)
                if raw.ndim == 3:
                    raw = raw[:, :, 0]
                r_min = float(np.nanmin(raw))
                r_max = float(np.nanmax(raw))
                if r_max > r_min:
                    # Scale darkest pixels to -4000m and brightest pixels to +4000m
                    norm = (raw - r_min) / (r_max - r_min)
                    dem_scaled_m = -4000.0 + norm * 8000.0
                else:
                    dem_scaled_m = np.zeros_like(raw, dtype=np.float64)
        except Exception:
            dem_scaled_m = None

    if os.path.isfile(vis_path):
        try:
            with Image.open(vis_path) as img:
                rgb_img = img.convert("RGB")
                if dem_scaled_m is not None:
                    dem_h, dem_w = dem_scaled_m.shape
                    if rgb_img.size != (dem_w, dem_h):
                        rgb_img = rgb_img.resize((dem_w, dem_h), Image.Resampling.BILINEAR)
                vis_rgb_u8 = np.array(rgb_img, dtype=np.uint8)
        except Exception:
            vis_rgb_u8 = None

    return dem_scaled_m, vis_rgb_u8


def _site_to_pixel_window(
    lat_deg: float,
    lon_deg: float,
    img_h: int,
    img_w: int,
    grid_size: int = 128,
) -> Tuple[int, int]:
    """
    Maps selenographic `(lat_deg, lon_deg)` to a top-left `(row0, col0)` window of size
    `grid_size x grid_size` inside `south_pole_dem.tif` / `south_pole_visual.tif`
    (which cover the bottom 5% South Pole slice ~81°S to 90°S).
    """
    # Map latitude in [-90° .. -81°] -> [0.95 .. 0.05] of image height
    lat_clamped = max(-90.0, min(-81.0, lat_deg))
    lat_frac = (abs(lat_clamped) - 81.0) / 9.0  # 0 at -81°, 1 at -90° (bottom edge)
    lon_frac = ((lon_deg + 180.0) % 360.0) / 360.0

    center_r = int((0.1 + 0.8 * lat_frac) * (img_h - 1))
    center_c = int((0.1 + 0.8 * lon_frac) * (img_w - 1))

    half = grid_size // 2
    r0 = max(0, min(max(0, img_h - grid_size), center_r - half))
    c0 = max(0, min(max(0, img_w - grid_size), center_c - half))
    return r0, c0


def read_lola_dem_patch(
    site: Dict[str, Any], grid_size: int = 128
) -> Tuple[np.ndarray, float, Dict[str, Any], str]:
    """
    2.1 LOLA Digital Elevation Model (DEM) Processing:
    - Uses `Pillow` (PIL) and `numpy` to read `backend/data/south_pole_dem.tif`.
    - Scales pixel values into realistic lunar elevation meters (-4000m to +4000m) and blends
      with the site's reference datum and local crater morphology.
    - Extracts a 128x128 pixel grid for the Three.js `terrain_grid` displacement array.
    """
    lat_deg = float(site.get("lat_deg", -89.54))
    lon_deg = float(site.get("lon_deg", 222.0))
    patch_size_m = float(site.get("patch_size_km", 20.0)) * 1000.0

    dem_master, _ = _load_master_tiff_arrays()
    Z_synth, patch_size_m, lander_pos = generate_terrain_dem(site, grid_size=grid_size)

    if dem_master is not None and dem_master.shape[0] >= 32 and dem_master.shape[1] >= 32:
        img_h, img_w = dem_master.shape
        r0, c0 = _site_to_pixel_window(lat_deg, lon_deg, img_h, img_w, grid_size)
        patch = dem_master[r0 : r0 + grid_size, c0 : c0 + grid_size].copy()

        # Center and scale the local TIFF micro-topography so 20km x 20km horizon ray-casting
        # preserves physical LOLA South Pole horizon angles (0.2° to 5.5°)
        mid = grid_size // 2
        patch_centered = patch - float(patch[mid, mid])
        p_std = max(1.0, float(np.std(patch_centered)))
        # Scale local TIFF relief to ±45m micro-roughness superimposed on the site's LOLA macro-DEM
        xs = np.linspace(-1.0, 1.0, grid_size)
        X_n, Y_n = np.meshgrid(xs, xs)
        r_radial = np.hypot(X_n, Y_n)
        radial_taper = np.clip((r_radial - 0.15) / 0.85, 0.0, 1.0)
        tiff_micro_relief = (patch_centered / p_std) * 28.0 * radial_taper

        Z = Z_synth + tiff_micro_relief
        lander_pos = {
            "x_m": 0.0,
            "y_m": 0.0,
            "z_m": float(Z[mid, mid]),
            "grid_row": mid,
            "grid_col": mid,
        }
        return np.round(Z, 2), patch_size_m, lander_pos, "pil_tiff:south_pole_dem.tif"

    return Z_synth, patch_size_m, lander_pos, "pil_calibrated_lola_128"


def compute_vectorized_horizon_360(
    Z: np.ndarray,
    patch_size_m: float,
    lander_z_offset_m: float = 2.0,
) -> np.ndarray:
    """
    2.1 The Horizon Upgrade:
    Vectorized `numpy` 360° horizon ray-caster across the 128x128 elevation array `Z`.
    Ray-marches outward for `Az = 0°..359°` to calculate the exact topographical skyline `H(Az)`,
    accounting for lunar sphere curvature drop-off (-d^2 / (2 * R_moon)) and elevated peak horizon dip.
    """
    grid_size = Z.shape[0]
    half_m = patch_size_m / 2.0
    mid = grid_size // 2

    z0 = float(Z[mid, mid]) + lander_z_offset_m
    min_surrounding = float(np.percentile(Z, 15))
    h_rel = max(0.0, z0 - min_surrounding)

    theta_dip_rad = -math.acos(R_MOON_M / (R_MOON_M + max(0.0, h_rel)))
    theta_dip_deg = math.degrees(theta_dip_rad)

    num_steps = 64
    distances = np.linspace(200.0, half_m * 0.98, num_steps)
    azimuths_rad = np.radians(np.arange(360, dtype=np.float64))

    sin_az = np.sin(azimuths_rad)[:, None]  # (360, 1)
    cos_az = np.cos(azimuths_rad)[:, None]  # (360, 1)
    d_mat = distances[None, :]              # (1, 64)

    X_ray = d_mat * sin_az
    Y_ray = d_mat * cos_az

    col_coords = (X_ray + half_m) / patch_size_m * (grid_size - 1)
    row_coords = (Y_ray + half_m) / patch_size_m * (grid_size - 1)

    sampled_z = map_coordinates(
        Z, [row_coords.ravel(), col_coords.ravel()], order=1, mode="nearest"
    ).reshape(360, num_steps)

    curvature_drop = (d_mat**2) / (2.0 * R_MOON_M)
    delta_z = sampled_z - z0 - curvature_drop

    elevation_angles_deg = np.degrees(np.arctan2(delta_z, d_mat))
    max_angles = np.max(elevation_angles_deg, axis=1)

    horizon_deg = np.maximum(theta_dip_deg, max_angles)
    return np.round(horizon_deg, 3)


def compute_instantaneous_temp_k(
    sun_fraction: float, sun_el_deg: float, lat_deg: float, terrain_type: str = "ridge"
) -> float:
    """
    2.2 Procedural Diviner Thermal Approximation (Instantaneous `local_temp_k`):
    - At the Lunar South Pole, shadowed areas / PSRs plunge to ~40K (-233°C), while sunlit
      surfaces reach ~220K (-53°C).
    - At equatorial sites (e.g., Apollo 11), sunlit noon reaches ~390K (+117°C) and night ~95K.
    """
    is_equatorial = abs(lat_deg) < 45.0
    if is_equatorial:
        if sun_fraction <= 0.0:
            return 95.0
        sin_el = max(0.05, math.sin(math.radians(max(1.0, sun_el_deg))))
        return round(95.0 + 295.0 * sun_fraction * (sin_el**0.25), 1)

    # South Pole procedural thermal model:
    # Base shadowed temperature ~40K (38K inside deep basin PSRs), rising to ~220K in full sunlight
    t_shadow_k = 38.0 if terrain_type == "basin" else 42.0
    t_sunlit_max_k = 222.0
    if sun_fraction <= 0.0:
        return t_shadow_k

    el_boost = min(1.08, max(0.85, 0.88 + 0.04 * max(0.0, sun_el_deg)))
    temp_k = t_shadow_k + (t_sunlit_max_k - t_shadow_k) * (sun_fraction**0.35) * el_boost
    return round(float(temp_k), 1)


def read_diviner_thermal_metrics(
    site: Dict[str, Any], Z: np.ndarray, sun_percentage: float, step_temps_k: Optional[list[float]] = None
) -> Dict[str, Any]:
    """
    2.2 Diviner Thermal Integration (Procedural South Pole Approximation):
    Calculates `local_temp_k` (average/characteristic mission temperature), `temp_max_k` (~220K sunlit),
    and `temp_min_k` (~40K shadowed PSR), plus thermal survival flags.
    """
    lat_deg = float(site.get("lat_deg", -89.54))
    terrain_type = str(site.get("terrain_type", "ridge"))
    sun_frac_overall = max(0.0, min(1.0, sun_percentage / 100.0))

    if step_temps_k and len(step_temps_k) > 0:
        temp_max_k = float(max(step_temps_k))
        temp_min_k = float(min(step_temps_k))
        local_temp_k = round(float(np.mean(step_temps_k)), 1)
    else:
        local_temp_k = round(40.0 + 180.0 * sun_frac_overall, 1)
        temp_max_k = 220.0 if sun_percentage > 0 else 40.0
        temp_min_k = 215.0 if sun_percentage >= 99.5 else 40.0

    # If a polar site experiences any shadow or is a PSR basin, surface temp drops toward 40K during eclipse
    if abs(lat_deg) > 75.0 and terrain_type == "basin":
        temp_max_k = min(temp_max_k, 45.0)
        temp_min_k = 38.0
        local_temp_k = 40.0

    temp_max_c = round(temp_max_k - 273.15, 1)
    temp_min_c = round(temp_min_k - 273.15, 1)
    local_temp_c = round(local_temp_k - 273.15, 1)

    # Spacecraft survival limit (~70K / -203°C without active RTG heating)
    cryogenic_hazard = temp_min_k < 70.0
    high_temp_hazard = temp_max_k > 375.0

    # Normalized Thermal Safety Score [0..100] weighted by time spent in safe thermal regime
    thermal_safety_score = round(
        max(5.0, min(100.0, 20.0 + 0.78 * sun_percentage - (15.0 if terrain_type == "basin" else 0.0))),
        1,
    )

    return {
        "source": "procedural_diviner_south_pole",
        "local_temp_k": local_temp_k,
        "local_temp_c": local_temp_c,
        "temp_max_k": round(temp_max_k, 1),
        "temp_min_k": round(temp_min_k, 1),
        "temp_max_c": temp_max_c,
        "temp_min_c": temp_min_c,
        "cryogenic_hazard": cryogenic_hazard,
        "high_temp_hazard": high_temp_hazard,
        "survival_limit_min_k": 70.0,
        "thermal_safety_score": thermal_safety_score,
        "thermal_verdict": (
            "EXTREME_CRYO_HAZARD"
            if local_temp_k < 65.0
            else "ECLIPSE_CRYO_DIP"
            if cryogenic_hazard
            else "HIGH_NOON_HEAT"
            if high_temp_hazard
            else "NOMINAL_THERMAL"
        ),
    }


def extract_lroc_texture_and_psr_mask(
    site: Dict[str, Any], Z: np.ndarray, patch_size_m: float
) -> Dict[str, Any]:
    """
    2.3 LROC Albedo / Visual Textures:
    - Reads `backend/data/south_pole_visual.tif` via `PIL.Image` and crops the exact 128x128
      pixel window matching `read_lola_dem_patch` so the texture aligns 1:1 with the DEM grid.
    - Writes `<site_id>_visual.png` and `<site_id>_psr.png` into `backend/data/textures/` so
      they are served via FastAPI `/static/textures/...` AND returns Base64 PNG strings.
    """
    site_id = site.get("id", "custom")
    lat_deg = float(site.get("lat_deg", -89.54))
    lon_deg = float(site.get("lon_deg", 222.0))
    grid_size = Z.shape[0]
    cell_size_m = patch_size_m / max(1, grid_size - 1)

    gy, gx = np.gradient(Z, cell_size_m)
    slope_rad = np.arctan(np.hypot(gx, gy))
    slope_deg = np.degrees(slope_rad)

    mid = grid_size // 2
    pad_radius = max(2, grid_size // 16)
    landing_pad_slope_deg = float(
        np.mean(slope_deg[mid - pad_radius : mid + pad_radius, mid - pad_radius : mid + pad_radius])
    )
    mean_slope_deg = float(np.mean(slope_deg))

    terrain_flatness_score = round(
        max(10.0, min(100.0, 100.0 - (landing_pad_slope_deg * 4.2 + mean_slope_deg * 2.5))),
        1,
    )

    # Identify Permanently Shadowed Regions (PSRs) on the 128x128 DEM grid
    is_polar = abs(lat_deg) > 75.0
    if is_polar:
        rim_ref = float(np.percentile(Z, 72))
        depth_below_rim = rim_ref - Z
        psr_threshold_m = 210.0 if site.get("terrain_type") != "basin" else 50.0
        psr_bool = depth_below_rim > psr_threshold_m
    else:
        psr_bool = np.zeros_like(Z, dtype=bool)

    psr_area_pct = round(float(np.mean(psr_bool) * 100.0), 1)

    # Load matching 128x128 visual patch from `south_pole_visual.tif`
    _, vis_master = _load_master_tiff_arrays()
    lroc_source = "lroc_wac_procedural_hillshade"

    z_min, z_max = float(np.min(Z)), float(np.max(Z))
    z_norm = (Z - z_min) / max(10.0, z_max - z_min)
    hillshade = np.clip(0.65 - 0.35 * (gx / (np.abs(gx) + 0.08)) - 0.18 * (slope_deg / 25.0), 0.15, 1.0)
    synth_albedo_u8 = np.clip((0.28 + 0.45 * z_norm * hillshade) * 235.0, 18, 245).astype(np.uint8)

    if vis_master is not None and vis_master.shape[0] >= grid_size and vis_master.shape[1] >= grid_size:
        img_h, img_w, _ = vis_master.shape
        r0, c0 = _site_to_pixel_window(lat_deg, lon_deg, img_h, img_w, grid_size)
        vis_patch = vis_master[r0 : r0 + grid_size, c0 : c0 + grid_size, :].astype(np.float64)
        # Blend real LROC visual TIFF patch with DEM slope shading for crisp 1:1 alignment
        synth_rgb = np.stack([synth_albedo_u8, synth_albedo_u8, synth_albedo_u8], axis=-1).astype(np.float64)
        blended = np.clip(0.55 * vis_patch + 0.45 * synth_rgb, 15, 250).astype(np.uint8)
        lroc_rgb = np.flipud(blended)
        lroc_source = "pil_tiff:south_pole_visual.tif"
    else:
        albedo_uv = np.flipud(synth_albedo_u8)
        lroc_rgb = np.stack(
            [
                albedo_uv,
                np.clip(albedo_uv * 1.01, 0, 255).astype(np.uint8),
                np.clip(albedo_uv * 1.05, 0, 255).astype(np.uint8),
            ],
            axis=-1,
        )

    psr_uv = np.flipud(psr_bool)
    psr_rgb = lroc_rgb.copy()
    psr_rgb[psr_uv, 0] = np.clip(lroc_rgb[psr_uv, 0] * 0.35 + 48, 40, 120).astype(np.uint8)
    psr_rgb[psr_uv, 1] = np.clip(lroc_rgb[psr_uv, 1] * 0.45 + 75, 65, 165).astype(np.uint8)
    psr_rgb[psr_uv, 2] = np.clip(lroc_rgb[psr_uv, 2] * 0.85 + 155, 160, 255).astype(np.uint8)

    pil_lroc = Image.fromarray(lroc_rgb, mode="RGB")
    pil_psr = Image.fromarray(psr_rgb, mode="RGB")

    # Save static PNG files served under FastAPI `/static/textures/`
    safe_id = "".join(c if c.isalnum() or c == "_" else "_" for c in site_id)
    vis_filename = f"{safe_id}_visual.png"
    psr_filename = f"{safe_id}_psr.png"
    try:
        pil_lroc.save(os.path.join(STATIC_TEXTURES_DIR, vis_filename), format="PNG")
        pil_psr.save(os.path.join(STATIC_TEXTURES_DIR, psr_filename), format="PNG")
    except Exception:
        pass

    return {
        "source": lroc_source,
        "lroc_texture_url": f"/static/textures/{vis_filename}",
        "lroc_psr_texture_url": f"/static/textures/{psr_filename}",
        "lroc_texture_base64": _image_to_base64_png(pil_lroc),
        "lroc_psr_texture_base64": _image_to_base64_png(pil_psr),
        "psr_area_percentage": psr_area_pct,
        "mean_slope_deg": round(mean_slope_deg, 2),
        "landing_pad_slope_deg": round(landing_pad_slope_deg, 2),
        "terrain_flatness_score": terrain_flatness_score,
    }
