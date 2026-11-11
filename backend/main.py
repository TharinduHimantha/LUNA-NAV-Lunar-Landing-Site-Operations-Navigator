"""
LUNA-NAV FastAPI Backend Application.
Exposes REST API endpoints for lunar landing site selection, topocentric Sun & Earth
ephemeris evaluation, 360° LOLA horizon ray-casting, launch-slip sensitivity sweeps,
and multi-site / multi-date trade-off comparisons.
"""

from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sites_catalog import CURATED_SITES
from physics_engine import evaluate_mission_cached

app = FastAPI(
    title="LUNA-NAV Mission Operations & Ephemeris API",
    description="2026 NASA Space Apps Challenge — Lunar Landing Site & Operations Navigator",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    )


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {"status": "nominal", "service": "LUNA-NAV Backend v2.0"}


@app.get("/api/sites")
def get_sites() -> Dict[str, Any]:
    return {"sites": CURATED_SITES}


@app.post("/api/evaluate")
def evaluate_site(req: EvaluateRequest) -> Dict[str, Any]:
    try:
        return _run_eval(req)
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
            "horizon_profile": data["horizon_profile"],
            "timeline": data["timeline"],
        })

    # Identify highest viability backup scenario
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

