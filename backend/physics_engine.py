"""
LUNA-NAV Core Physics, Astrodynamics & Topographic Ray-Casting Engine.
Implements:
1. Selenographic Topocentric Ephemeris (Skyfield de421.bsp + IAU Mean Earth / Polar Axis rotation
   with deterministic analytical fallback for offline environments).
2. Atmosphereless 360° Horizon Ray-Caster across 64x64 LOLA-calibrated DEM grids with
   lunar curvature drop-off (-d^2 / 2*R_moon) and elevated peak spherical dip.
3. Partial Solar Limb Eclipse Fraction (r_sun = 0.266°) & Direct-to-Earth (DTE) clearance windows.
4. Hardware-Aware Solar Array Power Output Model (Vertical Cylinder, Dual-Axis Tracking, Flat Deck).
5. Operational Countdown Timers (Hours until Sunset/Sunrise & Earthset/Earthrise) & Mission KPIs.
"""

from __future__ import annotations
import os
import math
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Dict, List, Any, Tuple, Optional

import numpy as np
from scipy.ndimage import map_coordinates

from sites_catalog import R_MOON_M, get_site_by_id, generate_terrain_dem

# Constants
SOLAR_CONSTANT_WM2 = 1361.0
SOLAR_RADIUS_DEG = 0.266
DEFAULT_CELL_EFFICIENCY = 0.28

# Optional Skyfield loader (auto-caches de421.bsp if network available, else uses analytical IAU solver)
_SKYFIELD_DATA: Dict[str, Any] = {"loaded": False, "ts": None, "eph": None, "mode": "analytical_iau"}


def _init_skyfield() -> None:
    if _SKYFIELD_DATA["loaded"]:
        return
    _SKYFIELD_DATA["loaded"] = True
    try:
        import urllib.request
        from skyfield.api import Loader
        cache_dir = os.path.join(os.path.dirname(__file__), ".skyfield_cache")
        os.makedirs(cache_dir, exist_ok=True)
        load = Loader(cache_dir)
        ts = load.timescale()
        bsp_path = os.path.join(cache_dir, "de421.bsp")
        if not os.path.exists(bsp_path):
            # Fast probe (1.5s timeout) to download de421.bsp if internet is reachable
            url = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de421.bsp"
            req = urllib.request.Request(url, headers={"User-Agent": "LUNA-NAV/1.0"})
            with urllib.request.urlopen(req, timeout=1.5) as resp, open(bsp_path, "wb") as out_f:
                out_f.write(resp.read())
        if os.path.exists(bsp_path):
            eph = load("de421.bsp")
            _SKYFIELD_DATA["ts"] = ts
            _SKYFIELD_DATA["eph"] = eph
            _SKYFIELD_DATA["mode"] = "skyfield_de421"
    except Exception:
        # Fallback cleanly to analytical IAU selenographic ephemeris when offline
        _SKYFIELD_DATA["mode"] = "analytical_iau"


def _julian_date(dt: datetime) -> float:
    """Compute Julian Date (UTC/TT approx) from a timezone-aware UTC datetime."""
    ts = dt.timestamp()
    return ts / 86400.0 + 2440587.5


def _iau_moon_orientation_matrix(jd: float) -> np.ndarray:
    """
    Computes the 3x3 rotation matrix from J2000 ICRF Equatorial (x, y, z)
    to the IAU Selenographic Mean Earth / Polar Axis (ME) frame, capturing:
      - Mean precession & nodal regression of the lunar orbit (18.6-year period)
      - 1.5424° lunar axial tilt to the ecliptic (Cassini's Laws)
      - Physical and optical libration terms (L1..L7)
    Reference: IAU Working Group on Cartographic Coordinates and Rotational Elements.
    """
    d = jd - 2451545.0  # Days since J2000.0
    T = d / 36525.0     # Julian centuries since J2000.0

    # Fundamental arguments (degrees) representing lunar libration & nodal precession
    E1 = np.radians(125.045 - 0.0529921 * d)
    E2 = np.radians(250.089 - 0.1059842 * d)
    E3 = np.radians(260.008 + 13.0120009 * d)
    E4 = np.radians(176.625 + 13.3407154 * d)
    E5 = np.radians(357.529 + 0.9856003 * d)
    E6 = np.radians(311.589 + 26.4057084 * d)
    E7 = np.radians(134.963 + 13.0649930 * d)
    E8 = np.radians(276.617 + 0.3287146 * d)
    E9 = np.radians(34.226 + 1.7484877 * d)
    E10 = np.radians(15.134 - 0.1589763 * d)

    # IAU 2015 Lunar North Pole Right Ascension (alpha_0), Declination (delta_0), Prime Meridian (W)
    alpha0_deg = (
        269.9949
        + 0.0031 * T
        - 3.8787 * np.sin(E1)
        - 0.1204 * np.sin(E2)
        + 0.0700 * np.sin(E3)
        - 0.0172 * np.sin(E4)
        + 0.0072 * np.sin(E6)
        - 0.0052 * np.sin(E10)
    )
    delta0_deg = (
        66.5392
        + 0.0130 * T
        + 1.5419 * np.cos(E1)
        + 0.0239 * np.cos(E2)
        - 0.0278 * np.cos(E3)
        + 0.0068 * np.cos(E4)
        - 0.0029 * np.cos(E6)
        + 0.0009 * np.cos(E7)
        + 0.0008 * np.cos(E10)
    )
    W_deg = (
        38.3213
        + 13.17635815 * d
        - 1.4e-12 * (d**2)
        + 3.5610 * np.sin(E1)
        + 0.1208 * np.sin(E2)
        - 0.0642 * np.sin(E3)
        + 0.0158 * np.sin(E4)
        + 0.0252 * np.sin(E5)
        - 0.0066 * np.sin(E6)
        - 0.0047 * np.sin(E7)
        - 0.0046 * np.sin(E8)
        + 0.0028 * np.sin(E9)
        + 0.0052 * np.sin(E10)
    )

    a = np.radians(alpha0_deg)
    de = np.radians(delta0_deg)
    w = np.radians(W_deg % 360.0)

    # Rotation R = Rz(w) * Rx(90° - delta0) * Rz(90° + alpha0)
    phi1 = a + np.pi / 2.0
    theta = np.pi / 2.0 - de
    phi2 = w

    c1, s1 = np.cos(phi1), np.sin(phi1)
    ct, st = np.cos(theta), np.sin(theta)
    c2, s2 = np.cos(phi2), np.sin(phi2)

    Rz1 = np.array([[c1, s1, 0.0], [-s1, c1, 0.0], [0.0, 0.0, 1.0]])
    Rx = np.array([[1.0, 0.0, 0.0], [0.0, ct, st], [0.0, -st, ct]])
    Rz2 = np.array([[c2, s2, 0.0], [-s2, c2, 0.0], [0.0, 0.0, 1.0]])

    return Rz2 @ Rx @ Rz1


def _analytical_moon_sun_earth_icrf(jd: float) -> Tuple[np.ndarray, np.ndarray]:
    """
    High-precision analytical lunar & solar ephemeris in J2000 ICRF equatorial coordinates (km).
    Returns:
      - r_moon_to_sun_icrf (3-vector in km)
      - r_moon_to_earth_icrf (3-vector in km)
    Accurately models anomalistic month (equation of center ±6.29°, evection ±1.27°, variation ±0.66°)
    and draconic month (±5.145° orbital inclination to ecliptic) for realistic optical libration loops.
    """
    d = jd - 2451545.0
    T = d / 36525.0

    # Obliquity of the ecliptic
    eps = np.radians(23.439291 - 0.0130042 * T)
    ce, se = np.cos(eps), np.sin(eps)

    # --- 1. Sun Position Relative to Earth (J2000 Ecliptic -> Equatorial) ---
    L_sun = np.radians((280.46646 + 0.98564736 * d) % 360.0)
    M_sun = np.radians((357.52911 + 0.98560028 * d) % 360.0)
    lam_sun = L_sun + np.radians(1.914602 * np.sin(M_sun) + 0.019993 * np.sin(2.0 * M_sun))
    r_sun_au = 1.00014 - 0.01671 * np.cos(M_sun) - 0.00014 * np.cos(2.0 * M_sun)
    r_sun_km = r_sun_au * 149597870.7

    x_sun_ecl = r_sun_km * np.cos(lam_sun)
    y_sun_ecl = r_sun_km * np.sin(lam_sun)
    r_earth_to_sun = np.array([x_sun_ecl, y_sun_ecl * ce, y_sun_ecl * se])

    # --- 2. Moon Position Relative to Earth (Meeus / ELP2000 Principal Terms) ---
    Lp = np.radians((218.3164477 + 13.17639648 * d) % 360.0)  # Mean longitude
    D = np.radians((297.8501921 + 12.19074912 * d) % 360.0)   # Mean elongation
    M = M_sun                                                  # Sun mean anomaly
    Mp = np.radians((134.9633964 + 13.06499295 * d) % 360.0)  # Moon mean anomaly
    F = np.radians((93.2720950 + 13.22935024 * d) % 360.0)    # Argument of latitude

    # Ecliptic longitude perturbations (degrees)
    d_lon_deg = (
        6.288774 * np.sin(Mp)
        + 1.274027 * np.sin(2 * D - Mp)
        + 0.658314 * np.sin(2 * D)
        + 0.213618 * np.sin(2 * Mp)
        - 0.185116 * np.sin(M)
        - 0.114332 * np.sin(2 * F)
        + 0.058793 * np.sin(2 * D - 2 * Mp)
        + 0.057066 * np.sin(2 * D - M - Mp)
        + 0.053322 * np.sin(2 * D + Mp)
        + 0.045758 * np.sin(2 * D - M)
    )
    # Ecliptic latitude perturbations (degrees)
    d_lat_deg = (
        5.128122 * np.sin(F)
        + 0.280602 * np.sin(Mp + F)
        + 0.277693 * np.sin(Mp - F)
        + 0.173237 * np.sin(2 * D - F)
        + 0.055413 * np.sin(2 * D - Mp + F)
        + 0.046271 * np.sin(2 * D - Mp - F)
        + 0.032573 * np.sin(2 * D + F)
    )
    # Distance (km)
    r_moon_km = (
        385000.56
        - 20905.355 * np.cos(Mp)
        - 3699.111 * np.cos(2 * D - Mp)
        - 2955.968 * np.cos(2 * D)
        - 569.925 * np.cos(2 * Mp)
    )

    lam_moon = Lp + np.radians(d_lon_deg)
    bet_moon = np.radians(d_lat_deg)

    cb = np.cos(bet_moon)
    x_m_ecl = r_moon_km * cb * np.cos(lam_moon)
    y_m_ecl = r_moon_km * cb * np.sin(lam_moon)
    z_m_ecl = r_moon_km * np.sin(bet_moon)

    r_earth_to_moon = np.array([
        x_m_ecl,
        y_m_ecl * ce - z_m_ecl * se,
        y_m_ecl * se + z_m_ecl * ce,
    ])

    r_moon_to_earth = -r_earth_to_moon
    r_moon_to_sun = r_earth_to_sun - r_earth_to_moon
    return r_moon_to_sun, r_moon_to_earth


def compute_topocentric_ephemeris(
    lat_deg: float,
    lon_deg: float,
    elev_m: float,
    timestamps_utc: List[datetime],
) -> List[Dict[str, float]]:
    """
    Computes topocentric Azimuth [0°, 360°) and Elevation [-90°, +90°] of the Sun center
    and Earth center from a given lunar site (lat_deg, lon_deg, elev_m) for each UTC timestamp.
    """
    _init_skyfield()

    lat_rad = np.radians(lat_deg)
    lon_rad = np.radians(lon_deg)
    clat, slat = np.cos(lat_rad), np.sin(lat_rad)
    clon, slon = np.cos(lon_rad), np.sin(lon_rad)

    # Site position vector in Selenographic Mean Earth (ME) Cartesian coordinates (km)
    r_site_km = (R_MOON_M + elev_m) / 1000.0
    site_me = np.array([
        r_site_km * clat * clon,
        r_site_km * clat * slon,
        r_site_km * slat,
    ])

    # Local East-North-Up (ENU) basis vectors in Selenographic ME frame
    east_vec = np.array([-slon, clon, 0.0])
    north_vec = np.array([-slat * clon, -slat * slon, clat])
    up_vec = np.array([clat * clon, clat * slon, slat])

    use_skyfield = _SKYFIELD_DATA["mode"] == "skyfield_de421" and _SKYFIELD_DATA["eph"] is not None
    if use_skyfield:
        ts = _SKYFIELD_DATA["ts"]
        eph = _SKYFIELD_DATA["eph"]
        moon_body = eph["moon"]
        sun_body = eph["sun"]
        earth_body = eph["earth"]

    results: List[Dict[str, float]] = []

    for dt in timestamps_utc:
        jd = _julian_date(dt)
        R_icrf_to_me = _iau_moon_orientation_matrix(jd)

        if use_skyfield:
            t_sf = ts.from_datetime(dt)
            m_pos = moon_body.at(t_sf)
            r_moon_to_sun_icrf = (sun_body.at(t_sf) - m_pos).position.km
            r_moon_to_earth_icrf = (earth_body.at(t_sf) - m_pos).position.km
        else:
            r_moon_to_sun_icrf, r_moon_to_earth_icrf = _analytical_moon_sun_earth_icrf(jd)

        # Rotate into Selenographic ME frame and subtract topocentric site offset
        sun_me = (R_icrf_to_me @ r_moon_to_sun_icrf) - site_me
        earth_me = (R_icrf_to_me @ r_moon_to_earth_icrf) - site_me

        # Project onto local ENU tangent plane
        sun_norm = sun_me / np.linalg.norm(sun_me)
        earth_norm = earth_me / np.linalg.norm(earth_me)

        s_e = float(np.dot(sun_norm, east_vec))
        s_n = float(np.dot(sun_norm, north_vec))
        s_u = float(np.dot(sun_norm, up_vec))

        e_e = float(np.dot(earth_norm, east_vec))
        e_n = float(np.dot(earth_norm, north_vec))
        e_u = float(np.dot(earth_norm, up_vec))

        sun_az = (math.degrees(math.atan2(s_e, s_n)) + 360.0) % 360.0
        sun_el = math.degrees(math.asin(max(-1.0, min(1.0, s_u))))

        earth_az = (math.degrees(math.atan2(e_e, e_n)) + 360.0) % 360.0
        earth_el = math.degrees(math.asin(max(-1.0, min(1.0, e_u))))

        results.append({
            "sun_az": round(sun_az, 3),
            "sun_el": round(sun_el, 3),
            "earth_az": round(earth_az, 3),
            "earth_el": round(earth_el, 3),
        })

    return results


def compute_horizon_profile_360(
    Z: np.ndarray,
    patch_size_m: float,
    lander_z_offset_m: float = 2.0,
) -> np.ndarray:
    """
    Ray-marches 360° (1° azimuth resolution, Az = 0..359°) outward from the center of the
    DEM grid Z(y, x) to compute the local topographic skyline elevation angle H(Az) in degrees.

    Includes:
      1. Exact lunar curvature drop-off term: -d^2 / (2 * R_moon)
      2. Spherical horizon dip angle for elevated peaks:
         theta_dip = -arccos(R_moon / (R_moon + max(0, h_rel)))
    """
    grid_size = Z.shape[0]
    half_m = patch_size_m / 2.0
    mid = grid_size // 2

    z0 = float(Z[mid, mid]) + lander_z_offset_m
    min_surrounding = float(np.percentile(Z, 15))
    h_rel = max(0.0, z0 - min_surrounding)

    # Spherical horizon dip angle (degrees) for an elevated peak on an airless sphere
    theta_dip_rad = -math.acos(R_MOON_M / (R_MOON_M + max(0.0, h_rel)))
    theta_dip_deg = math.degrees(theta_dip_rad)

    # Ray-marching distances from 300m out to patch boundary (9,800m)
    num_steps = 48
    distances = np.linspace(300.0, half_m * 0.98, num_steps)  # shape (num_steps,)

    azimuths_deg = np.arange(360, dtype=float)
    azimuths_rad = np.radians(azimuths_deg)

    # X = d * sin(Az) [East], Y = d * cos(Az) [North]
    # Grid indices: col j corresponds to X in [-half_m, +half_m], row i corresponds to Y in [-half_m, +half_m]
    sin_az = np.sin(azimuths_rad)[:, None]  # (360, 1)
    cos_az = np.cos(azimuths_rad)[:, None]  # (360, 1)
    d_mat = distances[None, :]              # (1, num_steps)

    X_ray = d_mat * sin_az                  # (360, num_steps)
    Y_ray = d_mat * cos_az                  # (360, num_steps)

    col_coords = (X_ray + half_m) / patch_size_m * (grid_size - 1)
    row_coords = (Y_ray + half_m) / patch_size_m * (grid_size - 1)

    # Bilinear interpolation across DEM grid
    sampled_z = map_coordinates(
        Z, [row_coords.ravel(), col_coords.ravel()], order=1, mode="nearest"
    ).reshape(360, num_steps)

    # Curvature correction: -d^2 / (2 * R_moon)
    curvature_drop = (d_mat**2) / (2.0 * R_MOON_M)
    delta_z = sampled_z - z0 - curvature_drop

    elevation_angles_deg = np.degrees(np.arctan2(delta_z, d_mat))
    max_Angles = np.max(elevation_angles_deg, axis=1)

    # Enforce spherical horizon dip floor
    horizon_deg = np.maximum(theta_dip_deg, max_Angles)
    return np.round(horizon_deg, 3)


def _interpolate_horizon(horizon_360: np.ndarray, az_deg: float) -> float:
    """Linearly interpolates the 360-degree horizon profile at fractional azimuth az_deg."""
    az = az_deg % 360.0
    idx0 = int(math.floor(az)) % 360
    idx1 = (idx0 + 1) % 360
    frac = az - math.floor(az)
    return float((1.0 - frac) * horizon_360[idx0] + frac * horizon_360[idx1])


def compute_solar_limb_fraction(sun_el_deg: float, horizon_el_deg: float) -> float:
    """
    Computes fractional visibility f_sun in [0, 1] of the solar disk (semi-diameter r_sun = 0.266°)
    relative to the local terrain horizon elevation angle.
    """
    delta_theta = sun_el_deg - horizon_el_deg
    if delta_theta >= SOLAR_RADIUS_DEG:
        return 1.0
    if delta_theta <= -SOLAR_RADIUS_DEG:
        return 0.0
    # Smooth circular/linear solar limb occlusion transition
    return round((delta_theta + SOLAR_RADIUS_DEG) / (2.0 * SOLAR_RADIUS_DEG), 4)


def compute_array_power_kw(
    sun_el_deg: float,
    sun_fraction: float,
    array_type: str,
    array_area_m2: float,
    efficiency: float = DEFAULT_CELL_EFFICIENCY,
) -> Tuple[float, float, float]:
    """
    Computes instantaneous solar irradiance (W/m^2), incidence factor eta_inc, and electrical
    power output (kW) for the selected lander solar array geometry.
    """
    if sun_fraction <= 0.0:
        return 0.0, 0.0, 0.0

    clamped_el_rad = math.radians(max(0.0, sun_el_deg))
    if array_type == "vertical_cylindrical":
        eta_inc = math.cos(clamped_el_rad)
    elif array_type == "dual_axis_tracking":
        eta_inc = 1.0
    elif array_type == "horizontal_deck":
        eta_inc = math.sin(clamped_el_rad)
    else:
        eta_inc = math.cos(clamped_el_rad)

    effective_irradiance = SOLAR_CONSTANT_WM2 * sun_fraction * eta_inc
    power_kw = (effective_irradiance * array_area_m2 * efficiency) / 1000.0
    return round(effective_irradiance, 2), round(power_kw, 3), round(eta_inc, 4)


def _compute_countdown_hours(
    bool_series: List[bool], current_idx: int, step_hours: float
) -> Tuple[str, float]:
    """
    Scans forward from current_idx in a boolean visibility series to find the hours until
    the next state transition (e.g., Sunset/Sunrise or Earthset/Earthrise).
    """
    n = len(bool_series)
    current_state = bool_series[current_idx]
    steps_ahead = 0
    found_transition = False
    for idx in range(current_idx + 1, n):
        steps_ahead += 1
        if bool_series[idx] != current_state:
            found_transition = True
            break

    hours = round(steps_ahead * step_hours, 1)
    if not found_transition:
        return ("CONTINUOUS_VISIBLE" if current_state else "CONTINUOUS_BLOCKED"), hours
    return ("UNTIL_SET" if current_state else "UNTIL_RISE"), hours


@lru_cache(maxsize=256)
def evaluate_mission_cached(
    site_id: str,
    custom_lat: Optional[float],
    custom_lon: Optional[float],
    custom_elev: Optional[float],
    custom_terrain_type: Optional[str],
     custom_name: Optional[str],
    start_datetime_iso: str,
    duration_days: int,
    step_hours: float,
    launch_slip_days: float,
    array_type: str,
    array_area_m2: float,
    comms_margin_deg: float,
) -> Dict[str, Any]:
    """
    Cached end-to-end mission evaluation engine.
    Computes 3D DEM, 360° horizon skyline, topocentric Sun/Earth trajectories,
    power generation, operational countdowns, and mission viability KPIs.
    """
    if site_id == "custom" and custom_lat is not None and custom_lon is not None:
        site = {
            "id": "custom",
            "name": custom_name or f"Custom Site ({custom_lat:.2f}°, {custom_lon:.2f}°)",
            "subtitle": "User-Defined Selenographic Coordinates",
            "program_tags": ["Custom Coordinates", "User Exploration"],
            "lat_deg": float(custom_lat),
            "lon_deg": float(custom_lon),
            "elev_m": float(custom_elev if custom_elev is not None else 0.0),
            "terrain_type": custom_terrain_type or "custom",
            "patch_size_km": 20.0,
            "description": (
                f"Custom lunar landing site at Lat {custom_lat:.2f}°, Lon {custom_lon:.2f}°, "
                f"Elev {custom_elev or 0.0:.0f}m with procedural LOLA terrain profile."
            ),
            "engineering_notes": "Dynamically generated 64x64 DEM and 360° ray-cast horizon mask.",
        }
    else:
        site = get_site_by_id(site_id)

    # Parse base start UTC and apply launch slip
    clean_iso = start_datetime_iso.replace("Z", "+00:00")
    try:
        base_dt = datetime.fromisoformat(clean_iso)
        if base_dt.tzinfo is None:
            base_dt = base_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        base_dt = datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc)

    effective_start_dt = base_dt + timedelta(days=float(launch_slip_days))

    # Generate 64x64 DEM and 360° Horizon Mask
    Z_dem, patch_size_m, lander_pos = generate_terrain_dem(site, grid_size=64)
    horizon_360 = compute_horizon_profile_360(Z_dem, patch_size_m)

    horizon_profile = [
        {"azimuth": int(az), "elevation_deg": float(horizon_360[az])}
        for az in range(360)
    ]

    # Build UTC timestamp sequence
    total_hours = float(duration_days) * 24.0
    num_steps = max(2, int(round(total_hours / step_hours)) + 1)
    timestamps_utc = [
        effective_start_dt + timedelta(hours=i * step_hours)
        for i in range(num_steps)
    ]

    # Compute topocentric Sun & Earth Az/El
    ephem_list = compute_topocentric_ephemeris(
        lat_deg=float(site["lat_deg"]),
        lon_deg=float(site["lon_deg"]),
        elev_m=float(site["elev_m"]),
        timestamps_utc=timestamps_utc,
    )

    timeline: List[Dict[str, Any]] = []
    sun_vis_flags: List[bool] = []
    earth_vis_flags: List[bool] = []

    for idx, (dt, eph) in enumerate(zip(timestamps_utc, ephem_list)):
        s_az, s_el = eph["sun_az"], eph["sun_el"]
        e_az, e_el = eph["earth_az"], eph["earth_el"]

        s_horiz = round(_interpolate_horizon(horizon_360, s_az), 3)
        e_horiz = round(_interpolate_horizon(horizon_360, e_az), 3)

        s_frac = compute_solar_limb_fraction(s_el, s_horiz)
        s_vis = s_frac > 0.05
        e_vis = e_el > (e_horiz + comms_margin_deg)

        irradiance_wm2, power_kw, eta_inc = compute_array_power_kw(
            sun_el_deg=s_el,
            sun_fraction=s_frac,
            array_type=array_type,
            array_area_m2=array_area_m2,
        )

        sun_vis_flags.append(s_vis)
        earth_vis_flags.append(e_vis)

        timeline.append({
            "step_index": idx,
            "timestamp_utc": dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "mission_hour": round(idx * step_hours, 2),
            "sun_az": s_az,
            "sun_el": s_el,
            "sun_horizon_el": s_horiz,
            "sun_clearance_deg": round(s_el - s_horiz, 3),
            "sun_fraction": s_frac,
            "sun_visible": s_vis,
            "earth_az": e_az,
            "earth_el": e_el,
            "earth_horizon_el": e_horiz,
            "earth_clearance_deg": round(e_el - (e_horiz + comms_margin_deg), 3),
            "earth_visible": e_vis,
            "solar_irradiance_wm2": irradiance_wm2,
            "incidence_efficiency": eta_inc,
            "power_kw": power_kw,
            "joint_operational": bool(s_vis and e_vis),
        })

    # Populate operational countdowns on each step
    for idx, step in enumerate(timeline):
        s_mode, s_hrs = _compute_countdown_hours(sun_vis_flags, idx, step_hours)
        e_mode, e_hrs = _compute_countdown_hours(earth_vis_flags, idx, step_hours)
        step["sun_countdown_mode"] = s_mode
        step["hours_until_sun_transition"] = s_hrs
        step["earth_countdown_mode"] = e_mode
        step["hours_until_earth_transition"] = e_hrs

    # Compute Mission KPIs
    n_total = len(timeline)
    sunlit_steps = sum(1 for s in timeline if s["sun_visible"])
    fractional_sun_hours = sum(s["sun_fraction"] * step_hours for s in timeline)
    dte_steps = sum(1 for s in timeline if s["earth_visible"])
    joint_steps = sum(1 for s in timeline if s["joint_operational"])

    sunlight_pct = round((sunlit_steps / n_total) * 100.0, 1)
    dte_pct = round((dte_steps / n_total) * 100.0, 1)
    joint_pct = round((joint_steps / n_total) * 100.0, 1)

    # Max continuous darkness hours (critical battery sizing metric)
    max_dark_steps = 0
    current_dark_steps = 0
    for s in timeline:
        if not s["sun_visible"]:
            current_dark_steps += 1
            if current_dark_steps > max_dark_steps:
                max_dark_steps = current_dark_steps
        else:
            current_dark_steps = 0
    max_continuous_darkness_hours = round(max_dark_steps * step_hours, 1)

    avg_power_kw = round(float(np.mean([s["power_kw"] for s in timeline])), 2)
    peak_power_kw = round(float(np.max([s["power_kw"] for s in timeline])), 2)
    peak_solar_el_deg = round(float(np.max([s["sun_el"] for s in timeline])), 2)

    # Composite Mission Viability Score (0 - 100)
    # Weights: 45% illumination, 30% battery eclipse survival penalty, 25% DTE comms
    darkness_score = max(0.0, 100.0 - (max_continuous_darkness_hours / 1.5))
    viability_score = round(
        0.45 * sunlight_pct + 0.30 * darkness_score + 0.25 * dte_pct, 1
    )

    if viability_score >= 72.0 and max_continuous_darkness_hours <= 60.0:
        verdict = "OPTIMAL"
    elif viability_score >= 45.0 and max_continuous_darkness_hours <= 130.0:
        verdict = "MARGINAL"
    else:
        verdict = "CRITICAL_RISK"

    return {
        "site": site,
        "ephemeris_engine": _SKYFIELD_DATA["mode"],
        "effective_start_utc": effective_start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "duration_days": duration_days,
        "step_hours": step_hours,
        "launch_slip_days": launch_slip_days,
        "hardware": {
            "array_type": array_type,
            "array_area_m2": array_area_m2,
            "comms_margin_deg": comms_margin_deg,
        },
        "terrain_grid": {
            "grid_size": 64,
            "patch_size_km": float(site.get("patch_size_km", 20.0)),
            "elevations_m": Z_dem.tolist(),
            "min_elev_m": float(np.min(Z_dem)),
            "max_elev_m": float(np.max(Z_dem)),
            "lander_pos": lander_pos,
        },
        "horizon_profile": horizon_profile,
        "timeline": timeline,
        "kpis": {
            "sunlight_percentage": sunlight_pct,
            "total_sunlight_hours": round(fractional_sun_hours, 1),
            "max_continuous_darkness_hours": max_continuous_darkness_hours,
            "dte_comms_percentage": dte_pct,
            "total_dte_hours": round(dte_steps * step_hours, 1),
            "joint_window_percentage": joint_pct,
            "average_power_kw": avg_power_kw,
            "peak_power_kw": peak_power_kw,
            "peak_solar_el_deg": peak_solar_el_deg,
            "viability_score": viability_score,
            "feasibility_verdict": verdict,
        },
    }
