from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from functools import lru_cache

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
_HORIZONS_SESSION = requests.Session()

_HORIZONS_SESSION.mount(
    "https://",
    HTTPAdapter(
        max_retries=Retry(
            total=1,
            connect=1,
            read=1,
            status=1,
            backoff_factor=0.3,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset({"GET"}),
            respect_retry_after_header=True,
        )
    ),
)


class HorizonsError(RuntimeError):
    """Raised when JPL Horizons data cannot be obtained or parsed."""


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def _horizons_datetime(dt: datetime) -> str:
    return _utc(dt).strftime("%Y-%m-%d %H:%M")


def _step_size(step_hours: float) -> str:
    minutes = int(round(float(step_hours) * 60.0))

    if minutes <= 0:
        raise HorizonsError("Horizons step size must be positive.")

    if minutes % 60 == 0:
        return f"{minutes // 60}h"

    return f"{minutes}m"


def _source_ephemeris(text: str) -> str:
    matches = re.findall(r"\bDE\d+\b", text)

    if matches:
        return matches[0]

    return "unknown_JPL_ephemeris"


def _parse_observer_csv(
    text: str,
) -> tuple[list[dict[str, float | datetime]], str]:
    if "$$SOE" not in text or "$$EOE" not in text:
        compact = " ".join(text.split())
        raise HorizonsError(
            "Horizons returned no ephemeris table: "
            f"{compact[:400]}"
        )

    table_text = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]

    records: list[dict[str, float | datetime]] = []

    reader = csv.reader(io.StringIO(table_text))

    for row in reader:
        if not row:
            continue

        row = [column.strip() for column in row]

        # QUANTITIES='4' normally produces:
        # date, calendar flag, solar-presence flag, azimuth, elevation
        if len(row) < 5:
            continue

        try:
            timestamp = datetime.strptime(
                row[0],
                "%Y-%b-%d %H:%M",
            ).replace(tzinfo=timezone.utc)

            azimuth_deg = float(row[3])
            elevation_deg = float(row[4])
        except (ValueError, IndexError):
            continue

        records.append(
            {
                "timestamp": timestamp,
                "azimuth_deg": azimuth_deg % 360.0,
                "elevation_deg": elevation_deg,
            }
        )

    if not records:
        raise HorizonsError(
            "Horizons response was received, but no azimuth/elevation "
            "rows could be parsed."
        )

    return records, _source_ephemeris(text)


@lru_cache(maxsize=256)
def _fetch_target_cached(
    command: str,
    latitude_deg: float,
    longitude_deg: float,
    elevation_km: float,
    start_time: str,
    stop_time: str,
    step_size: str,
) -> tuple[tuple[tuple[str, float, float], ...], str]:
    parameters = {
        "format": "text",
        "COMMAND": f"'{command}'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": (
            f"'{longitude_deg:.8f},"
            f"{latitude_deg:.8f},"
            f"{elevation_km:.8f}'"
        ),
        "START_TIME": f"'{start_time}'",
        "STOP_TIME": f"'{stop_time}'",
        "STEP_SIZE": f"'{step_size}'",
        "QUANTITIES": "'4'",
        "APPARENT": "'AIRLESS'",
        "TIME_TYPE": "'UT'",
        "TIME_DIGITS": "'MINUTES'",
        "ANG_FORMAT": "'DEG'",
        "CSV_FORMAT": "'YES'",
        "OBJ_DATA": "'NO'",
    }

    try:
        response = _HORIZONS_SESSION.get(
            HORIZONS_URL,
            params=parameters,
            headers={
                "User-Agent": "LUNA-NAV-Hackathon/1.0",
            },
            timeout=3.5,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HorizonsError(
            f"Could not contact NASA/JPL Horizons: {exc}"
        ) from exc

    parsed_rows, ephemeris_source = _parse_observer_csv(
        response.text
    )

    serialised_rows = tuple(
        (
            row["timestamp"].isoformat(),
            float(row["azimuth_deg"]),
            float(row["elevation_deg"]),
        )
        for row in parsed_rows
    )

    return serialised_rows, ephemeris_source


def _fetch_target(
    command: str,
    latitude_deg: float,
    longitude_deg: float,
    elevation_m: float,
    start_dt: datetime,
    stop_dt: datetime,
    step_hours: float,
) -> tuple[list[dict[str, float | datetime]], str]:
    rows, ephemeris_source = _fetch_target_cached(
        command,
        round(float(latitude_deg), 8),
        round(float(longitude_deg), 8),
        round(float(elevation_m) / 1000.0, 8),
        _horizons_datetime(start_dt),
        _horizons_datetime(stop_dt),
        _step_size(step_hours),
    )

    return (
        [
            {
                "timestamp": datetime.fromisoformat(timestamp),
                "azimuth_deg": azimuth_deg,
                "elevation_deg": elevation_deg,
            }
            for timestamp, azimuth_deg, elevation_deg in rows
        ],
        ephemeris_source,
    )


def fetch_sun_earth_ephemeris(
    latitude_deg: float,
    longitude_deg: float,
    elevation_m: float,
    start_dt: datetime,
    stop_dt: datetime,
    step_hours: float,
) -> tuple[list[dict], str]:
    """
    Obtain apparent Sun and Earth azimuth/elevation from JPL Horizons.

    Horizons object IDs:
      10  = Sun
      399 = Earth

    Observer centre:
      coord@301 = a user-specified coordinate on the Moon
    """
    sun_rows, sun_source = _fetch_target(
        command="10",
        latitude_deg=latitude_deg,
        longitude_deg=longitude_deg,
        elevation_m=elevation_m,
        start_dt=start_dt,
        stop_dt=stop_dt,
        step_hours=step_hours,
    )

    earth_rows, earth_source = _fetch_target(
        command="399",
        latitude_deg=latitude_deg,
        longitude_deg=longitude_deg,
        elevation_m=elevation_m,
        start_dt=start_dt,
        stop_dt=stop_dt,
        step_hours=step_hours,
    )

    earth_by_time = {
        row["timestamp"]: row
        for row in earth_rows
    }

    combined: list[dict] = []

    for sun in sun_rows:
        timestamp = sun["timestamp"]
        earth = earth_by_time.get(timestamp)

        if earth is None:
            raise HorizonsError(
                "Sun and Earth Horizons timestamps do not match."
            )

        combined.append(
            {
                "timestamp": timestamp,
                "sun_azimuth_deg": float(sun["azimuth_deg"]),
                "sun_elevation_deg": float(sun["elevation_deg"]),
                "earth_azimuth_deg": float(earth["azimuth_deg"]),
                "earth_elevation_deg": float(
                    earth["elevation_deg"]
                ),
            }
        )

    source = (
        "NASA/JPL_Horizons:"
        f"Sun={sun_source}:"
        f"Earth={earth_source}:"
        "observer=coord@301:"
        "apparent=airless"
    )

    return combined, source