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
  // Format Sun countdown badge
  const renderSunBadge = () => {
    const { sun_countdown_mode, hours_until_sun_transition, sun_visible } = currentStep;
    if (sun_countdown_mode === 'CONTINUOUS_VISIBLE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          CONTINUOUS SUN ({hours_until_sun_transition}h+)
        </span>
      );
    }
    if (sun_countdown_mode === 'CONTINUOUS_BLOCKED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
          PERMANENT SHADOW ({hours_until_sun_transition}h+)
        </span>
      );
    }
    if (sun_visible) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
          SUNSET IN {hours_until_sun_transition}h
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-500/25 text-red-300 border border-red-500/50 animate-pulse">
        ECLIPSE — SUNRISE IN {hours_until_sun_transition}h
      </span>
    );
  };

  // Format Earth DTE countdown badge
  const renderEarthBadge = () => {
    const { earth_countdown_mode, hours_until_earth_transition, earth_visible } = currentStep;
    if (earth_countdown_mode === 'CONTINUOUS_VISIBLE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
          CONTINUOUS DTE ({hours_until_earth_transition}h+)
        </span>
      );
    }
    if (earth_countdown_mode === 'CONTINUOUS_BLOCKED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
          DTE OCCLUDED ({hours_until_earth_transition}h+)
        </span>
      );
    }
    if (earth_visible) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
          EARTHSET IN {hours_until_earth_transition}h
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-500/25 text-red-300 border border-red-500/50 animate-pulse">
        COMMS BLACKOUT — RISE IN {hours_until_earth_transition}h
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
      label: 'MARGINAL / CAUTION',
      color: 'text-amber-400',
      bg: 'bg-amber-500/15 border-amber-500/40',
      Icon: AlertTriangle,
    },
    CRITICAL_RISK: {
      label: 'CRITICAL RISK',
      color: 'text-red-400',
      bg: 'bg-red-500/15 border-red-500/40',
      Icon: XOctagon,
    },
  }[kpis.feasibility_verdict];

  const VerdictIcon = verdictConfig.Icon;

  return (
    <section
      aria-label="Real-Time Operational KPI and Countdown Strip"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 px-4 py-2.5 bg-[#0B0F19] border-b border-gray-800/80"
    >
      {/* Card 1: Sun Status & Countdown */}
      <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 flex flex-col justify-between shadow-inner">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-gray-300 flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            Solar Tracking
          </span>
          <span className="font-mono text-[11px] text-gray-400">
            Az {currentStep.sun_az.toFixed(1)}°
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span
            className={`text-xl font-mono font-bold ${
              currentStep.sun_visible ? 'text-amber-400' : 'text-red-400'
            }`}
          >
            {currentStep.sun_el >= 0 ? `+${currentStep.sun_el.toFixed(2)}°` : `${currentStep.sun_el.toFixed(2)}°`}
          </span>
          <span className="text-xs font-mono text-gray-400">
            ({currentStep.sun_clearance_deg >= 0 ? `+${currentStep.sun_clearance_deg.toFixed(2)}°` : `${currentStep.sun_clearance_deg.toFixed(2)}°`} vs Rim)
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          {renderSunBadge()}
        </div>
      </div>

      {/* Card 2: Earth DTE Comms & Countdown */}
      <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 flex flex-col justify-between shadow-inner">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-gray-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            Earth DTE Link
          </span>
          <span className="font-mono text-[11px] text-gray-400">
            Az {currentStep.earth_az.toFixed(1)}°
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span
            className={`text-xl font-mono font-bold ${
              currentStep.earth_visible ? 'text-sky-400' : 'text-red-400'
            }`}
          >
            {currentStep.earth_el >= 0 ? `+${currentStep.earth_el.toFixed(2)}°` : `${currentStep.earth_el.toFixed(2)}°`}
          </span>
          <span className="text-xs font-mono text-gray-400">
            ({currentStep.earth_clearance_deg >= 0 ? `+${currentStep.earth_clearance_deg.toFixed(2)}°` : `${currentStep.earth_clearance_deg.toFixed(2)}°`} Margin)
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          {renderEarthBadge()}
        </div>
      </div>

      {/* Card 3: Instantaneous Power Output */}
      <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 flex flex-col justify-between shadow-inner">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-gray-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            Array Power
          </span>
          <span className="font-mono text-[11px] text-emerald-400/90">
            Avg {kpis.average_power_kw.toFixed(2)} kW
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span className="text-xl font-mono font-bold text-white">
            {currentStep.power_kw.toFixed(2)} <span className="text-sm font-normal text-gray-400">kW</span>
          </span>
          <span className="text-xs font-mono text-amber-300/90">
            {Math.round(currentStep.solar_irradiance_wm2)} W/m²
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-gray-400">
          <span>Incidence η: {(currentStep.incidence_efficiency * 100).toFixed(0)}%</span>
          <span>Sun Disk: {(currentStep.sun_fraction * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Card 4: Total Illumination Window */}
      <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 flex flex-col justify-between shadow-inner">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-gray-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Mission Sunlight
          </span>
          <span className="font-mono text-[11px] text-sky-400">
            DTE: {kpis.dte_comms_percentage.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span className="text-xl font-mono font-bold text-amber-400">
            {kpis.sunlight_percentage.toFixed(1)}%
          </span>
          <span className="text-xs font-mono text-gray-400">
            ({kpis.total_sunlight_hours.toFixed(0)}h sunlit)
          </span>
        </div>
        <div className="mt-1.5 w-full bg-gray-800 h-2 rounded-full overflow-hidden flex">
          <div
            className="bg-amber-400 h-full transition-all duration-300"
            style={{ width: `${Math.min(100, kpis.sunlight_percentage)}%` }}
          />
        </div>
      </div>

      {/* Card 5: Max Eclipse (Battery Stress) */}
      <div
        className={`rounded-lg p-3 flex flex-col justify-between border transition-colors ${
          isBatteryCritical
            ? 'bg-red-950/30 border-red-500/60'
            : 'bg-[#111827] border-gray-800'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold tracking-wider uppercase text-gray-300 flex items-center gap-1.5">
            <BatteryWarning
              className={`w-3.5 h-3.5 ${
                isBatteryCritical ? 'text-red-400 animate-bounce' : 'text-emerald-400'
              }`}
            />
            Max Eclipse
          </span>
          <span className="font-mono text-[10px] text-gray-400">LIMIT: 50.0h</span>
        </div>
        <div className="flex items-baseline gap-2 my-0.5">
          <span
            className={`text-xl font-mono font-bold ${
              isBatteryCritical ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {kpis.max_continuous_darkness_hours.toFixed(1)}h
          </span>
          <span className="text-xs font-mono text-gray-400">continuous dark</span>
        </div>
        <div className="mt-1.5 text-[11px] font-mono">
          {isBatteryCritical ? (
            <span className="text-red-300 font-semibold">
              EXCEEDS 50h LANDER BATTERY SPEC
            </span>
          ) : (
            <span className="text-emerald-300/90">
              WITHIN SURVIVAL BATTERY MARGIN
            </span>
          )}
        </div>
      </div>

      {/* Card 6: Mission Viability Score */}
      <div className="bg-[#111827] border border-gray-800 rounded-lg p-3 flex flex-col justify-between shadow-inner">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
          <span className="font-semibold tracking-wider uppercase text-gray-300">
            Viability Index
          </span>
          <span className="font-mono text-[11px] text-gray-400">
            Joint: {kpis.joint_window_percentage.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-baseline justify-between my-0.5">
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-mono font-extrabold ${verdictConfig.color}`}>
              {kpis.viability_score.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-gray-500">/ 100</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${verdictConfig.bg} ${verdictConfig.color}`}
          >
            <VerdictIcon className="w-3 h-3" />
            {verdictConfig.label}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-gray-400 truncate">
          {personaMode === 'educator'
            ? 'Combines solar power, battery survival & Earth comms'
            : `Peak Sun El: ${kpis.peak_solar_el_deg.toFixed(2)}° | DTE: ${kpis.total_dte_hours.toFixed(0)}h`}
        </div>
      </div>
    </section>
  );
};
