"""
LUNA-NAV FastAPI Backend Application (Phase 2).
Exposes REST API endpoints for lunar landing site selection, topocentric Sun & Earth
ephemeris evaluation, 128x128 LOLA DEM & LROC/Diviner dataset ingestion,
head-to-head dual scenario comparison (`POST /api/compare_scenarios`),
multi-site comparison (`POST /api/compare`), and launch-slip sensitivity sweeps.
"""

from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from sites_catalog import CURATED_SITES
from physics_engine import evaluate_mission_cached
from data_ingestion import DATA_DIR

from horizons_client import HorizonsError
from lola_dem import LolaDemError

app = FastAPI(
    title="LUNA-NAV Mission Operations & Planetary Dataset API",
    description="2026 NASA Space Apps Challenge — Phase 2 Real Dataset Integration & Comparison UX",
    version="2.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount `/static/` route serving `backend/data/` (including cropped LROC visual textures)
app.mount("/static", StaticFiles(directory=DATA_DIR), name="static")


class CustomSiteInput(BaseModel):
    name: Optional[str] = "Custom Lunar Landing Site"
    lat_deg: float = Field(..., ge=-90.0, le=90.0)
    lon_deg: float = Field(..., ge=-180.0, le=360.0)
    elev_m: float = Field(default=0.0, ge=-9000.0, le=12000.0)
    terrain_type: str = Field(default="ridge")


class EvaluateRequest(BaseModel):
    site_id: str = Field(default="shackleton_ridge")
    custom_site: Optional[CustomSiteInput] = None
    start_datetime_utc: str = Field(default="2026-12-01T00:00:00Z")
    duration_days: int = Field(default=30, ge=1, le=90)
    step_hours: float = Field(default=2.0, ge=0.5, le=12.0)
    launch_slip_days: float = Field(default=0.0, ge=-30.0, le=60.0)
    array_type: str = Field(default="vertical_cylindrical")
    array_area_m2: float = Field(default=12.0, ge=1.0, le=500.0)
    comms_margin_deg: float = Field(default=1.0, ge=0.0, le=15.0)
    dem_grid_size: int = Field(default=128, ge=32, le=128)


class DualScenarioCompareRequest(BaseModel):
    scenario_a: EvaluateRequest
    scenario_b: EvaluateRequest


class CompareScenarioItem(BaseModel):
    scenario_id: str
    label: str
    site_id: str = "shackleton_ridge"
    custom_site: Optional[CustomSiteInput] = None
    start_datetime_utc: str = "2026-12-01T00:00:00Z"
    duration_days: int = 30
    step_hours: float = 2.0
    launch_slip_days: float = 0.0
    array_type: str = "vertical_cylindrical"
    array_area_m2: float = 12.0
    comms_margin_deg: float = 1.0


class CompareRequest(BaseModel):
    scenarios: List[CompareScenarioItem] = Field(..., min_length=1, max_length=6)


class LaunchSlipSweepRequest(BaseModel):
    site_id: str = "shackleton_ridge"
    custom_site: Optional[CustomSiteInput] = None
    start_datetime_utc: str = "2026-12-01T00:00:00Z"
    duration_days: int = 30
    step_hours: float = 4.0
    min_slip_days: int = -14
    max_slip_days: int = 28
    increment_days: int = 2
    array_type: str = "vertical_cylindrical"
    array_area_m2: float = 12.0
    comms_margin_deg: float = 1.0


def _run_eval(req: EvaluateRequest) -> Dict[str, Any]:
    c = req.custom_site
    return evaluate_mission_cached(
        site_id=req.site_id,
        custom_lat=c.lat_deg if c else None,
        custom_lon=c.lon_deg if c else None,
        custom_elev=c.elev_m if c else None,
        custom_terrain_type=c.terrain_type if c else None,
        custom_name=c.name if c else None,
        start_datetime_iso=req.start_datetime_utc,
        duration_days=req.duration_days,
        step_hours=req.step_hours,
        launch_slip_days=req.launch_slip_days,
        array_type=req.array_type,
        array_area_m2=req.array_area_m2,
        comms_margin_deg=req.comms_margin_deg,
        dem_grid_size=req.dem_grid_size,
    )


def _winner(val_a: float, val_b: float, higher_is_better: bool = True, tol: float = 0.05) -> str:
    if abs(val_a - val_b) <= tol:
        return "TIE"
    if higher_is_better:
        return "A" if val_a > val_b else "B"
    return "A" if val_a < val_b else "B"


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {"status": "nominal", "service": "LUNA-NAV Backend v2.5 (Phase 2 Real Datasets)"}


@app.get("/api/sites")
def get_sites() -> Dict[str, Any]:
    return {"sites": CURATED_SITES}


@app.post("/api/evaluate")
def evaluate_site(request: EvaluateRequest):
    try:
        return _run_eval(request)
    except (LolaDemError, HorizonsError) as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@app.post("/api/compare_scenarios")
def compare_two_scenarios(req: DualScenarioCompareRequest) -> Dict[str, Any]:
    """
    Phase 2 Head-to-Head Scenario Comparison Endpoint.
    Evaluates Scenario A and Scenario B simultaneously and returns full 3D DEM + LROC + Diviner
    payloads alongside delta metrics, winner flags, and normalized 4-axis Radar chart series.
    """
    try:
        eval_a = _run_eval(req.scenario_a)
        eval_b = _run_eval(req.scenario_b)

        ka = eval_a["kpis"]
        kb = eval_b["kpis"]

        sun_hrs_diff = round(kb["total_sunlight_hours"] - ka["total_sunlight_hours"], 1)
        sun_pct_diff = round(kb["sunlight_percentage"] - ka["sunlight_percentage"], 1)
        eclipse_diff = round(kb["max_continuous_darkness_hours"] - ka["max_continuous_darkness_hours"], 1)
        dte_hrs_diff = round(kb["total_dte_hours"] - ka["total_dte_hours"], 1)
        dte_pct_diff = round(kb["dte_comms_percentage"] - ka["dte_comms_percentage"], 1)
        tmin_diff_k = round(kb["temp_min_k"] - ka["temp_min_k"], 1)
        tmax_diff_k = round(kb["temp_max_k"] - ka["temp_max_k"], 1)
        peak_el_diff = round(kb["peak_solar_el_deg"] - ka["peak_solar_el_deg"], 2)
        viability_diff = round(kb["viability_score"] - ka["viability_score"], 1)

        deltas = {
            "sunlight_hours_delta_b_vs_a": sun_hrs_diff,
            "sunlight_pct_delta_b_vs_a": sun_pct_diff,
            "max_eclipse_hours_delta_b_vs_a": eclipse_diff,
            "dte_hours_delta_b_vs_a": dte_hrs_diff,
            "dte_pct_delta_b_vs_a": dte_pct_diff,
            "temp_min_k_delta_b_vs_a": tmin_diff_k,
            "temp_max_k_delta_b_vs_a": tmax_diff_k,
            "peak_solar_el_delta_b_vs_a": peak_el_diff,
            "viability_score_delta_b_vs_a": viability_diff,
            "winners": {
                "power_window": _winner(ka["total_sunlight_hours"], kb["total_sunlight_hours"], True),
                "battery_stress": _winner(
                    ka["max_continuous_darkness_hours"],
                    kb["max_continuous_darkness_hours"],
                    False,
                ),
                "comms_window": _winner(ka["total_dte_hours"], kb["total_dte_hours"], True),
                "thermal_extremes": _winner(
                    ka["thermal_safety_score"], kb["thermal_safety_score"], True
                ),
                "peak_solar_el": _winner(ka["peak_solar_el_deg"], kb["peak_solar_el_deg"], True),
                "overall_viability": _winner(ka["viability_score"], kb["viability_score"], True),
            },
            "summary_callouts": [
                (
                    f"Scenario B provides {'+' if sun_hrs_diff >= 0 else ''}{sun_hrs_diff}h "
                    f"({'+' if sun_pct_diff >= 0 else ''}{sun_pct_diff}%) sunlight compared to Scenario A."
                ),
                (
                    f"Scenario B max continuous eclipse is {'+' if eclipse_diff >= 0 else ''}{eclipse_diff}h "
                    f"vs Scenario A ({kb['max_continuous_darkness_hours']}h vs {ka['max_continuous_darkness_hours']}h)."
                ),
                (
                    f"Scenario B DTE communication window is {'+' if dte_hrs_diff >= 0 else ''}{dte_hrs_diff}h "
                    f"({'+' if dte_pct_diff >= 0 else ''}{dte_pct_diff}%) vs Scenario A."
                ),
            ],
        }

        radar_comparison = [
            {
                "axis": "Illumination",
                "ScenarioA": eval_a["radar_metrics"]["illumination"],
                "ScenarioB": eval_b["radar_metrics"]["illumination"],
                "fullMark": 100,
            },
            {
                "axis": "DTE Comms",
                "ScenarioA": eval_a["radar_metrics"]["dte_comms"],
                "ScenarioB": eval_b["radar_metrics"]["dte_comms"],
                "fullMark": 100,
            },
            {
                "axis": "Thermal Safety",
                "ScenarioA": eval_a["radar_metrics"]["thermal_safety"],
                "ScenarioB": eval_b["radar_metrics"]["thermal_safety"],
                "fullMark": 100,
            },
            {
                "axis": "Terrain Flatness",
                "ScenarioA": eval_a["radar_metrics"]["terrain_flatness"],
                "ScenarioB": eval_b["radar_metrics"]["terrain_flatness"],
                "fullMark": 100,
            },
        ]

        return {
            "scenario_a": eval_a,
            "scenario_b": eval_b,
            "deltas": deltas,
            "radar_comparison": radar_comparison,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/compare")
def compare_scenarios(req: CompareRequest) -> Dict[str, Any]:
    results = []
    for item in req.scenarios[:6]:
        eval_req = EvaluateRequest(
            site_id=item.site_id,
            custom_site=item.custom_site,
            start_datetime_utc=item.start_datetime_utc,
            duration_days=item.duration_days,
            step_hours=item.step_hours,
            launch_slip_days=item.launch_slip_days,
            array_type=item.array_type,
            array_area_m2=item.array_area_m2,
            comms_margin_deg=item.comms_margin_deg,
            dem_grid_size=64,
        )
        data = _run_eval(eval_req)
        results.append({
            "scenario_id": item.scenario_id,
            "label": item.label,
            "site": data["site"],
            "effective_start_utc": data["effective_start_utc"],
            "launch_slip_days": item.launch_slip_days,
            "hardware": data["hardware"],
            "kpis": data["kpis"],
            "thermal_metrics": data["thermal_metrics"],
            "radar_metrics": data["radar_metrics"],
            "horizon_profile": data["horizon_profile"],
            "timeline": data["timeline"],
        })

    best_scenario = max(results, key=lambda r: r["kpis"]["viability_score"]) if results else None
    return {
        "scenarios": results,
        "recommended_scenario_id": best_scenario["scenario_id"] if best_scenario else None,
    }


@app.post("/api/launch-slip-sweep")
def launch_slip_sweep(req: LaunchSlipSweepRequest) -> Dict[str, Any]:
    c = req.custom_site
    sweep_points = []
    step_inc = max(1, req.increment_days)
    for slip in range(req.min_slip_days, req.max_slip_days + 1, step_inc):
        res = evaluate_mission_cached(
            site_id=req.site_id,
            custom_lat=c.lat_deg if c else None,
            custom_lon=c.lon_deg if c else None,
            custom_elev=c.elev_m if c else None,
            custom_terrain_type=c.terrain_type if c else None,
            custom_name=c.name if c else None,
            start_datetime_iso=req.start_datetime_utc,
            duration_days=req.duration_days,
            step_hours=req.step_hours,
            launch_slip_days=float(slip),
            array_type=req.array_type,
            array_area_m2=req.array_area_m2,
            comms_margin_deg=req.comms_margin_deg,
            dem_grid_size=64,
            prefer_local_ephemeris=True,
        )
        kpis = res["kpis"]
        sweep_points.append({
            "slip_days": slip,
            "effective_start_utc": res["effective_start_utc"],
            "sunlight_pct": kpis["sunlight_percentage"],
            "dte_comms_pct": kpis["dte_comms_percentage"],
            "joint_window_pct": kpis["joint_window_percentage"],
            "max_darkness_hours": kpis["max_continuous_darkness_hours"],
            "average_power_kw": kpis["average_power_kw"],
            "viability_score": kpis["viability_score"],
            "feasibility_verdict": kpis["feasibility_verdict"],
        })

    return {
        "site_id": req.site_id,
        "base_start_utc": req.start_datetime_utc,
        "sweep": sweep_points,
    }
