from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from rasterio.vrt import WarpedVRT


R_MOON_M = 1_737_400.0

LOLA_DEM_PATH = (
    Path(__file__).resolve().parent
    / "data"
    / "lola"
    / "LDEM_80S_80MPP_ADJ.TIF"
)


class LolaDemError(RuntimeError):
    """Raised when the scientific LOLA DEM cannot be used."""


def _normalise_longitude(longitude_deg: float) -> float:
    """Convert longitude to the -180 to +180 interval."""
    return ((float(longitude_deg) + 180.0) % 360.0) - 180.0


def _convert_vertical_values(
    elevation: np.ndarray,
) -> tuple[np.ndarray, str]:
    """
    Convert the GeoTIFF values into metres relative to the lunar datum.

    Some lunar products store absolute radius near 1,737,400 m.
    Others already store elevation relative to the reference sphere.
    """
    valid_values = elevation[np.isfinite(elevation)]

    if valid_values.size == 0:
        raise LolaDemError("The selected LOLA patch contains no valid elevations.")

    median_value = float(np.median(valid_values))

    if 1_700_000.0 < median_value < 1_780_000.0:
        return (
            elevation - R_MOON_M,
            "absolute_radius_minus_1737400_m",
        )

    if -20_000.0 < median_value < 20_000.0:
        return (
            elevation,
            "elevation_relative_to_1737400_m",
        )

    raise LolaDemError(
        "Unexpected LOLA vertical values. "
        f"Median value was {median_value:.2f} m."
    )


@lru_cache(maxsize=64)
def _read_cached_patch(
    latitude_deg: float,
    longitude_deg: float,
    patch_size_m: float,
    grid_size: int,
) -> tuple[np.ndarray, float, dict[str, float], str]:
    if not LOLA_DEM_PATH.exists():
        raise LolaDemError(
            "NASA LOLA DEM is missing. Download "
            "LDEM_80S_80MPP_ADJ.TIF into backend/data/lola/."
        )

    if not -90.0 <= latitude_deg <= -80.0:
        raise LolaDemError(
            "The installed LOLA south-pole DEM covers only "
            "80°S to 90°S."
        )

    if grid_size < 32 or grid_size > 1024:
        raise LolaDemError("grid_size must be between 32 and 1024.")

    projection_longitude = _normalise_longitude(longitude_deg)

    # A local projection centred on the landing site. Its X and Y coordinates
    # are metres from the selected landing location.
    local_crs = CRS.from_proj4(
        f"+proj=aeqd "
        f"+lat_0={latitude_deg} "
        f"+lon_0={projection_longitude} "
        f"+R={R_MOON_M} "
        f"+units=m "
        f"+no_defs"
    )

    half_size_m = patch_size_m / 2.0

    destination_transform = from_bounds(
        -half_size_m,
        -half_size_m,
        half_size_m,
        half_size_m,
        grid_size,
        grid_size,
    )

    with rasterio.open(LOLA_DEM_PATH) as source:
        if source.crs is None:
            raise LolaDemError(
                "The LOLA GeoTIFF does not contain a readable CRS."
            )

        with WarpedVRT(
            source,
            crs=local_crs,
            transform=destination_transform,
            width=grid_size,
            height=grid_size,
            resampling=Resampling.bilinear,
            nodata=np.nan,
            dtype="float64",
        ) as vrt:
            masked_elevation = vrt.read(1, masked=True)

    elevation = np.asarray(
        masked_elevation.filled(np.nan),
        dtype=np.float64,
    )

    missing_fraction = float(np.mean(~np.isfinite(elevation)))

    if missing_fraction > 0.05:
        raise LolaDemError(
            f"{missing_fraction * 100.0:.1f}% of the requested "
            "LOLA patch is outside the available DEM."
        )

    if np.any(~np.isfinite(elevation)):
        fill_value = float(np.nanmedian(elevation))
        elevation = np.where(
            np.isfinite(elevation),
            elevation,
            fill_value,
        )

    elevation, vertical_mode = _convert_vertical_values(elevation)

    # Raster row zero is north. The current LUNA-NAV grid expects the first
    # row to represent the southern side of the patch.
    elevation = np.flipud(elevation)

    centre = grid_size // 2
    centre_elevation_m = float(elevation[centre, centre])

    source_description = (
        "NASA_PGDA_LOLA:"
        "LDEM_80S_80MPP_ADJ.TIF:"
        f"{vertical_mode}"
    )

    lander_position = {
        "x_m": 0.0,
        "y_m": 0.0,
        "z_m": centre_elevation_m,
        "latitude_deg": float(latitude_deg),
        "longitude_deg": float(longitude_deg),
    }

    return (
        elevation,
        float(patch_size_m),
        lander_position,
        source_description,
    )


def read_lola_geotiff_patch(
    site: dict[str, Any],
    grid_size: int = 128,
) -> tuple[np.ndarray, float, dict[str, float], str]:
    """
    Return a real georeferenced LOLA elevation patch.

    The resulting array contains metres relative to the lunar reference
    radius. No min/max normalisation is performed.
    """
    latitude_deg = float(site["lat_deg"])
    longitude_deg = float(site["lon_deg"])

    patch_size_m = float(
        site.get("dem_patch_size_m", 20_000.0)
    )

    return _read_cached_patch(
        round(latitude_deg, 8),
        round(longitude_deg, 8),
        round(patch_size_m, 3),
        int(grid_size),
    )