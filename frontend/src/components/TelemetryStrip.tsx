import React from 'react';
import {
  Sun,
  Radio,
  Zap,
  Clock,
  BatteryWarning,
  ShieldCheck,
  AlertTriangle,
  XOctagon,
} from 'lucide-react';
import type { MissionKPIs, TimelineStep, PersonaMode } from '../types/mission';
import { InfoTooltip } from './InfoTooltip';

interface TelemetryStripProps {
  currentStep: TimelineStep;
  kpis: MissionKPIs;
  personaMode: PersonaMode;
}

export const TelemetryStrip: React.FC<TelemetryStripProps> = ({
  currentStep,
  kpis,
  personaMode,
}) => {
  const renderSunBadge = () => {
    const { sun_countdown_mode, hours_until_sun_transition, sun_visible } = currentStep;
    if (sun_countdown_mode === 'CONTINUOUS_VISIBLE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35">
          CONTINUOUS SUN ({hours_until_sun_transition}h+)
        </span>
      );
    }
    if (sun_countdown_mode === 'CONTINUOUS_BLOCKED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/35">
          PERMANENT SHADOW ({hours_until_sun_transition}h+)
        </span>
      );
    }
    if (sun_visible) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35">
          SUNSET IN {hours_until_sun_transition}h
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/45 animate-pulse">
        ECLIPSE • RISE IN {hours_until_sun_transition}h
      </span>
    );
  };

  const renderEarthBadge = () => {
    const { earth_countdown_mode, hours_until_earth_transition, earth_visible } = currentStep;
    if (earth_countdown_mode === 'CONTINUOUS_VISIBLE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/35">
          CONTINUOUS DTE ({hours_until_earth_transition}h+)
        </span>
      );
    }
    if (earth_countdown_mode === 'CONTINUOUS_BLOCKED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/35">
          DTE OCCLUDED ({hours_until_earth_transition}h+)
        </span>
      );
    }
    if (earth_visible) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/35">
          EARTHSET IN {hours_until_earth_transition}h
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/45 animate-pulse">
        BLACKOUT • RISE IN {hours_until_earth_transition}h
      </span>
    );
  };

  const isBatteryCritical = kpis.max_continuous_darkness_hours > 50;

  const verdictConfig = {
    OPTIMAL: {
      label: 'OPTIMAL SITE',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15 border-emerald-500/40',
      Icon: ShieldCheck,
    },
    MARGINAL: {
      label: 'MARGINAL',
      color: 'text-amber-400',
      bg: 'bg-amber-500/15 border-amber-500/40',
      Icon: AlertTriangle,
    },
    CRITICAL_RISK: {
      label: 'CRITICAL RISK',
      color: 'text-rose-400',
      bg: 'bg-rose-500/15 border-rose-500/40',
      Icon: XOctagon,
    },
  }[kpis.feasibility_verdict];

  const VerdictIcon = verdictConfig.Icon;

  return (
    <section
      aria-label="Real-Time Operational KPI and Countdown Strip"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 px-4 py-2.5 bg-[#080C14] border-b border-slate-800/80"
    >
      {/* Card 1: Solar Tracking */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Solar Angle</span>
            <InfoTooltip
              title="Topocentric Solar Elevation"
              content="Height of the Sun above the flat horizon compared against local LOLA crater rim obstacles. At the Lunar South Pole, the Sun grazes within ±1.5° of the horizon."
            />
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Az {currentStep.sun_az.toFixed(1)}°
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span
            className={`text-xl font-mono font-bold ${
              currentStep.sun_visible ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {currentStep.sun_el >= 0
              ? `+${currentStep.sun_el.toFixed(2)}°`
              : `${currentStep.sun_el.toFixed(2)}°`}
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            ({currentStep.sun_clearance_deg >= 0 ? '+' : ''}
            {currentStep.sun_clearance_deg.toFixed(2)}° rim)
          </span>
        </div>
        <div className="mt-1.5">{renderSunBadge()}</div>
      </div>

      {/* Card 2: Earth DTE Link */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span>Earth DTE</span>
            <InfoTooltip
              title="Direct-to-Earth Radio Link"
              content="Line-of-sight elevation to Earth over the 27.3-day optical libration cycle. Requires clearing the local terrain ridge plus your configured antenna clearance margin."
            />
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Az {currentStep.earth_az.toFixed(1)}°
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span
            className={`text-xl font-mono font-bold ${
              currentStep.earth_visible ? 'text-sky-400' : 'text-rose-400'
            }`}
          >
            {currentStep.earth_el >= 0
              ? `+${currentStep.earth_el.toFixed(2)}°`
              : `${currentStep.earth_el.toFixed(2)}°`}
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            ({currentStep.earth_clearance_deg >= 0 ? '+' : ''}
            {currentStep.earth_clearance_deg.toFixed(2)}° mgn)
          </span>
        </div>
        <div className="mt-1.5">{renderEarthBadge()}</div>
      </div>

      {/* Card 3: Array Power */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Array Power</span>
            <InfoTooltip
              title="Triple-Junction GaAs Solar Output"
              content="Instantaneous electrical power (28% cell efficiency) accounting for partial solar disk eclipse fraction and array incidence geometry (cos El for vertical masts vs sin El for flat decks)."
            />
          </span>
          <span className="font-mono text-[11px] text-emerald-400">
            Avg {kpis.average_power_kw.toFixed(2)} kW
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span className="text-xl font-mono font-bold text-white">
            {currentStep.power_kw.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">kW</span>
          </span>
          <span className="text-[11px] font-mono text-amber-300/90">
            {Math.round(currentStep.solar_irradiance_wm2)} W/m²
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Incidence η: {(currentStep.incidence_efficiency * 100).toFixed(0)}%</span>
          <span>Disk: {(currentStep.sun_fraction * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Card 4: Mission Sunlight */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Illumination</span>
            <InfoTooltip
              title="Cumulative Sunlight Duty Cycle"
              content="Percentage of total mission hours with direct solar line-of-sight above surrounding crater rims."
            />
          </span>
          <span className="font-mono text-[11px] text-sky-400">
            DTE {kpis.dte_comms_percentage.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span className="text-xl font-mono font-bold text-amber-400">
            {kpis.sunlight_percentage.toFixed(1)}%
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            ({kpis.total_sunlight_hours.toFixed(0)}h sunlit)
          </span>
        </div>
        <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-amber-400 h-full transition-all duration-300"
            style={{ width: `${Math.min(100, kpis.sunlight_percentage)}%` }}
          />
        </div>
      </div>

      {/* Card 5: Max Eclipse (Battery Stress) */}
      <div
        className={`rounded-xl p-3 flex flex-col justify-between border transition-colors ${
          isBatteryCritical
            ? 'bg-rose-950/30 border-rose-500/50'
            : 'bg-[#0F172A] border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
            <BatteryWarning
              className={`w-3.5 h-3.5 ${
                isBatteryCritical ? 'text-rose-400 animate-bounce' : 'text-emerald-400'
              }`}
            />
            <span>Max Eclipse</span>
            <InfoTooltip
              title="Longest Continuous Darkness"
              content="Longest uninterrupted shadow interval during the mission. Standard Artemis/CLPS lander batteries are sized for ≤50.0 hours of survival heater load without solar recharge."
            />
          </span>
          <span className="font-mono text-[10px] text-slate-400">SPEC ≤50h</span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span
            className={`text-xl font-mono font-bold ${
              isBatteryCritical ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {kpis.max_continuous_darkness_hours.toFixed(1)}h
          </span>
          <span className="text-[11px] font-mono text-slate-400">continuous</span>
        </div>
        <div className="mt-1.5 text-[10px] font-mono">
          {isBatteryCritical ? (
            <span className="text-rose-300 font-semibold">EXCEEDS 50h BATTERY LIMIT</span>
          ) : (
            <span className="text-emerald-300/90">WITHIN BATTERY MARGIN</span>
          )}
        </div>
      </div>

      {/* Card 6: Mission Viability Score */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-slate-300 flex items-center gap-1.5">
            <span>Viability</span>
            <InfoTooltip
              title="Composite Site Viability Index"
              content="Weighted aerospace feasibility score (0–100) combining solar power availability, battery eclipse survival, Direct-to-Earth communications coverage, and terrain slope."
            />
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Joint {kpis.joint_window_percentage.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-baseline justify-between my-0.5">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-mono font-extrabold ${verdictConfig.color}`}>
              {kpis.viability_score.toFixed(0)}
            </span>
            <span className="text-xs font-mono text-slate-500">/100</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold ${verdictConfig.bg} ${verdictConfig.color}`}
          >
            <VerdictIcon className="w-3 h-3" />
            {verdictConfig.label}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400 truncate font-mono">
          {personaMode === 'educator'
            ? 'Power + Battery + DTE Score'
            : `Peak Sun ${kpis.peak_solar_el_deg.toFixed(1)}° • DTE ${kpis.total_dte_hours.toFixed(0)}h`}
        </div>
      </div>
    </section>
  );
};