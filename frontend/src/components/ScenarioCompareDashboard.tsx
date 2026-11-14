import React, { useState, useMemo } from 'react';
import {
  Sun,
  Radio,
  BatteryWarning,
  Thermometer,
  TrendingUp,
  Award,
  Snowflake,
  ArrowLeftRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Compass,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type {
  LunarSite,
  DualScenarioComparisonResponse,
  SolarArrayType,
} from '../types/mission';
import { LunarTerrain3D } from './LunarTerrain3D';
import { PolarSkyChart } from './PolarSkyChart';
import { InfoTooltip } from './InfoTooltip';

interface ScenarioCompareDashboardProps {
  sites: LunarSite[];
  comparisonData: DualScenarioComparisonResponse;
  siteAId: string;
  onChangeSiteA: (id: string) => void;
  slipADays: number;
  onChangeSlipA: (days: number) => void;
  siteBId: string;
  onChangeSiteB: (id: string) => void;
  slipBDays: number;
  onChangeSlipB: (days: number) => void;
  currentStepIndex: number;
  onChangeStepIndex: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: 1 | 5 | 20;
  onChangePlaybackSpeed: (spd: 1 | 5 | 20) => void;
  arrayType: SolarArrayType;
  commsMarginDeg: number;
  onApplyPreset: (siteA: string, slipA: number, siteB: string, slipB: number) => void;
}

export const ScenarioCompareDashboard: React.FC<ScenarioCompareDashboardProps> = ({
  sites,
  comparisonData,
  siteAId,
  onChangeSiteA,
  slipADays,
  onChangeSlipA,
  siteBId,
  onChangeSiteB,
  slipBDays,
  onChangeSlipB,
  currentStepIndex,
  onChangeStepIndex,
  isPlaying,
  playbackSpeed,
  arrayType,
  commsMarginDeg,
  onApplyPreset,
}) => {
  const [showPsrOverlay, setShowPsrOverlay] = useState<boolean>(true);
  const [showPolarRadars, setShowPolarRadars] = useState<boolean>(false);

  const { scenario_a, scenario_b, deltas, radar_comparison } = comparisonData;
  const stepA = scenario_a.timeline[currentStepIndex] || scenario_a.timeline[0];
  const stepB = scenario_b.timeline[currentStepIndex] || scenario_b.timeline[0];
  const ka = scenario_a.kpis;
  const kb = scenario_b.kpis;
  const ta = scenario_a.thermal_metrics;
  const tb = scenario_b.thermal_metrics;

  const dualTimelineData = useMemo(
    () =>
      scenario_a.timeline.map((tA, idx) => {
        const tB = scenario_b.timeline[idx] || tA;
        return {
          mission_hour: tA.mission_hour,
          sun_el_a: tA.sun_el,
          sun_el_b: tB.sun_el,
          power_kw_a: tA.power_kw,
          power_kw_b: tB.power_kw,
        };
      }),
    [scenario_a.timeline, scenario_b.timeline]
  );

  const getCellWinnerClasses = (side: 'A' | 'B', winner: 'A' | 'B' | 'TIE') => {
    if (winner === 'TIE') {
      return 'bg-slate-900/70 border-slate-700 text-slate-200';
    }
    if (winner === side) {
      return 'bg-emerald-950/35 border-emerald-500/50 text-emerald-300 font-bold';
    }
    return 'bg-rose-950/25 border-rose-500/35 text-rose-300';
  };

  const executiveVerdict = useMemo(() => {
    const winnerSide = deltas.winners.overall_viability;
    const scoreDiff = Math.abs(deltas.viability_score_delta_b_vs_a).toFixed(1);
    const sunDiff = Math.abs(deltas.sunlight_hours_delta_b_vs_a).toFixed(0);
    const dteDiff = Math.abs(deltas.dte_hours_delta_b_vs_a).toFixed(0);

    if (winnerSide === 'TIE') {
      return {
        headline: `Statistical Tie: ${scenario_a.site.name} and ${scenario_b.site.name} offer comparable mission viability.`,
        detail: `Both configurations score within ${scoreDiff} viability points. Select based on secondary science objectives or terrain slope constraints.`,
        accent: 'border-slate-700 bg-slate-900/70',
        badgeClass: 'bg-slate-700 text-white',
        badgeText: 'COMPARABLE TRADE-OFF',
      };
    }

    const isAWinner = winnerSide === 'A';
    const winSite = isAWinner ? scenario_a.site.name : scenario_b.site.name;
    const winKpi = isAWinner ? ka : kb;
    const loseKpi = isAWinner ? kb : ka;
    const winSlip = isAWinner ? slipADays : slipBDays;
    const slipLabel =
      winSlip === 0 ? 'Nominal Schedule' : winSlip > 0 ? `+${winSlip}d Slip` : `${winSlip}d Early`;

    const reasons: string[] = [];
    if (winKpi.total_sunlight_hours > loseKpi.total_sunlight_hours + 5) {
      reasons.push(`delivers ${sunDiff} more hours of solar power`);
    }
    if (winKpi.total_dte_hours > loseKpi.total_dte_hours + 5) {
      reasons.push(`provides ${dteDiff} additional hours of Direct-to-Earth link`);
    }
    if (loseKpi.max_continuous_darkness_hours > 50 && winKpi.max_continuous_darkness_hours <= 50) {
      reasons.push(
        `avoids the ${loseKpi.max_continuous_darkness_hours.toFixed(0)}-hour battery-exceeding eclipse`
      );
    } else if (winKpi.max_continuous_darkness_hours < loseKpi.max_continuous_darkness_hours - 2) {
      reasons.push(
        `cuts peak eclipse duration to ${winKpi.max_continuous_darkness_hours.toFixed(1)}h`
      );
    }

    const reasonText =
      reasons.length > 0
        ? `It ${reasons.join(', ')}.`
        : `It achieves a higher composite viability index (${winKpi.viability_score.toFixed(0)} vs ${loseKpi.viability_score.toFixed(0)}).`;

    return {
      headline: `Executive Recommendation: Scenario ${winnerSide} (${winSite} • ${slipLabel}) is recommended (+${scoreDiff} pts).`,
      detail: reasonText,
      accent: isAWinner
        ? 'border-amber-500/45 bg-gradient-to-r from-amber-950/30 via-[#0F172A] to-[#0F172A]'
        : 'border-sky-500/45 bg-gradient-to-r from-sky-950/30 via-[#0F172A] to-[#0F172A]',
      badgeClass: isAWinner ? 'bg-amber-500 text-slate-950' : 'bg-sky-400 text-slate-950',
      badgeText: `RECOMMENDED: SCENARIO ${winnerSide}`,
    };
  }, [deltas, scenario_a.site.name, scenario_b.site.name, ka, kb, slipADays, slipBDays]);

  return (
    <div className="space-y-4">
      {/* Top Scenario A vs Scenario B Controls & Quick Trade-Study Presets */}
      <section className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 shadow-xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  Side-by-Side Site &amp; Schedule Comparator
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/90 text-[10px] font-mono text-slate-300 border border-slate-700">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  Synced at MET T+{stepA?.mission_hour.toFixed(0)}h
                  {isPlaying ? ` (${playbackSpeed}x)` : ''}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Compare two landing sites or launch dates simultaneously using 128×128 LOLA DEMs, LROC WAC imagery &amp; Diviner thermal extrema
              </p>
            </div>
          </div>

          {/* Quick Trade-Study Preset Buttons & Overlay Toggles */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 mr-0.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
            </span>
            <button
              type="button"
              onClick={() => onApplyPreset('shackleton_ridge', 0, 'malapert_massif', 0)}
              className="px-2 py-1 rounded-md bg-[#080C14] hover:bg-slate-800 text-[11px] font-mono text-amber-300 border border-slate-700 transition"
            >
              Shackleton vs Malapert
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('nobile_rim', 0, 'nobile_rim', 10)}
              className="px-2 py-1 rounded-md bg-[#080C14] hover:bg-slate-800 text-[11px] font-mono text-sky-300 border border-slate-700 transition"
            >
              Nobile Nominal vs +10d
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('shackleton_ridge', 0, 'haworth_floor', 0)}
              className="px-2 py-1 rounded-md bg-[#080C14] hover:bg-slate-800 text-[11px] font-mono text-indigo-300 border border-slate-700 transition"
            >
              Peak vs Cold Trap
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('shackleton_ridge', 0, 'apollo_11', 0)}
              className="px-2 py-1 rounded-md bg-[#080C14] hover:bg-slate-800 text-[11px] font-mono text-emerald-300 border border-slate-700 transition"
            >
              South Pole vs Apollo 11
            </button>

            <span className="h-4 w-px bg-slate-800 mx-0.5 hidden md:inline-block" />

            <button
              type="button"
              onClick={() => setShowPsrOverlay((p) => !p)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition ${
                showPsrOverlay
                  ? 'bg-indigo-600/30 text-indigo-200 border-indigo-400/70'
                  : 'bg-[#080C14] text-slate-300 border-slate-700'
              }`}
              title="Toggle Permanently Shadowed Region cold-trap overlay on both 3D viewports"
            >
              <Snowflake className="w-3 h-3 text-sky-300" />
              <span>PSRs: {showPsrOverlay ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPolarRadars((p) => !p)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition ${
                showPolarRadars
                  ? 'bg-sky-600/30 text-sky-200 border-sky-400/70'
                  : 'bg-[#080C14] text-slate-300 border-slate-700'
              }`}
            >
              <Compass className="w-3 h-3 text-sky-400" />
              <span>{showPolarRadars ? 'Hide Sky-Radars' : '360° Sky-Radars'}</span>
            </button>
          </div>
        </div>

        {/* Dual Scenario Selector Cards + Synchronized Operational Ribbons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Scenario A Card (Gold Theme) */}
          <div className="bg-[#080C14] border border-amber-500/40 rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-extrabold text-xs">
                  SCENARIO A
                </span>
                <select
                  value={siteAId}
                  onChange={(e) => onChangeSiteA(e.target.value)}
                  aria-label="Scenario A Landing Site"
                  className="bg-[#0F172A] border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.lat_deg}°)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Slip:</span>
                <input
                  type="range"
                  min={-14}
                  max={28}
                  step={1}
                  value={slipADays}
                  onChange={(e) => onChangeSlipA(Number(e.target.value))}
                  aria-label="Scenario A Launch Slip Days"
                  className="w-24 accent-amber-400 cursor-pointer"
                />
                <span className="text-amber-300 font-bold w-11 text-right">
                  {slipADays >= 0 ? `+${slipADays}d` : `${slipADays}d`}
                </span>
              </div>
            </div>

            {/* Scenario A Operational Ribbon */}
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span>
                  Start: <strong className="text-slate-200">{stepA?.timestamp_utc.slice(0, 10)}</strong>
                </span>
                <span className={stepA?.sun_visible ? 'text-amber-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {stepA?.sun_visible ? `SUNLIT • ${stepA.power_kw.toFixed(2)} kW` : 'IN SHADOW'}
                </span>
              </div>
              <div className="w-full h-2.5 rounded overflow-hidden flex bg-slate-900 border border-slate-800 cursor-pointer">
                {scenario_a.timeline.map((s, idx) => {
                  const bg = s.joint_operational
                    ? 'bg-emerald-500/85'
                    : s.sun_visible
                    ? 'bg-amber-400/85'
                    : s.earth_visible
                    ? 'bg-sky-400/85'
                    : 'bg-rose-600/85';
                  return (
                    <div
                      key={s.step_index}
                      onClick={() => onChangeStepIndex(idx)}
                      style={{ width: `${100 / scenario_a.timeline.length}%` }}
                      className={`${bg} h-full ${idx === currentStepIndex ? 'ring-2 ring-white z-10' : ''}`}
                      title={`T+${s.mission_hour}h: Sun ${s.sun_el.toFixed(1)}°, Earth ${s.earth_el.toFixed(1)}°`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scenario B Card (Cyan Theme) */}
          <div className="bg-[#080C14] border border-sky-500/40 rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-sky-400 text-slate-950 font-mono font-extrabold text-xs">
                  SCENARIO B
                </span>
                <select
                  value={siteBId}
                  onChange={(e) => onChangeSiteB(e.target.value)}
                  aria-label="Scenario B Landing Site"
                  className="bg-[#0F172A] border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-white focus:outline-none"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.lat_deg}°)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Slip:</span>
                <input
                  type="range"
                  min={-14}
                  max={28}
                  step={1}
                  value={slipBDays}
                  onChange={(e) => onChangeSlipB(Number(e.target.value))}
                  aria-label="Scenario B Launch Slip Days"
                  className="w-24 accent-sky-400 cursor-pointer"
                />
                <span className="text-sky-300 font-bold w-11 text-right">
                  {slipBDays >= 0 ? `+${slipBDays}d` : `${slipBDays}d`}
                </span>
              </div>
            </div>

            {/* Scenario B Operational Ribbon */}
            <div>
              <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span>
                  Start: <strong className="text-slate-200">{stepB?.timestamp_utc.slice(0, 10)}</strong>
                </span>
                <span className={stepB?.sun_visible ? 'text-sky-300 font-semibold' : 'text-rose-400 font-semibold'}>
                  {stepB?.sun_visible ? `SUNLIT • ${stepB.power_kw.toFixed(2)} kW` : 'IN SHADOW'}
                </span>
              </div>
              <div className="w-full h-2.5 rounded overflow-hidden flex bg-slate-900 border border-slate-800 cursor-pointer">
                {scenario_b.timeline.map((s, idx) => {
                  const bg = s.joint_operational
                    ? 'bg-emerald-500/85'
                    : s.sun_visible
                    ? 'bg-amber-400/85'
                    : s.earth_visible
                    ? 'bg-sky-400/85'
                    : 'bg-rose-600/85';
                  return (
                    <div
                      key={s.step_index}
                      onClick={() => onChangeStepIndex(idx)}
                      style={{ width: `${100 / scenario_b.timeline.length}%` }}
                      className={`${bg} h-full ${idx === currentStepIndex ? 'ring-2 ring-white z-10' : ''}`}
                      title={`T+${s.mission_hour}h: Sun ${s.sun_el.toFixed(1)}°, Earth ${s.earth_el.toFixed(1)}°`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Split-Screen Synchronized 3D Viewports */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <div className="min-h-[370px]">
          <LunarTerrain3D
            site={scenario_a.site}
            terrainGrid={scenario_a.terrain_grid}
            timeline={scenario_a.timeline}
            currentStepIndex={currentStepIndex}
            arrayType={arrayType}
            thermalMetrics={scenario_a.thermal_metrics}
            scenarioBadge={`A • ${slipADays >= 0 ? `+${slipADays}d` : `${slipADays}d`}`}
            compactMode
            externalShowPsr={showPsrOverlay}
            onTogglePsr={setShowPsrOverlay}
          />
        </div>

        <div className="min-h-[370px]">
          <LunarTerrain3D
            site={scenario_b.site}
            terrainGrid={scenario_b.terrain_grid}
            timeline={scenario_b.timeline}
            currentStepIndex={currentStepIndex}
            arrayType={arrayType}
            thermalMetrics={scenario_b.thermal_metrics}
            scenarioBadge={`B • ${slipBDays >= 0 ? `+${slipBDays}d` : `${slipBDays}d`}`}
            compactMode
            externalShowPsr={showPsrOverlay}
            onTogglePsr={setShowPsrOverlay}
          />
        </div>
      </section>

      {/* Optional Synchronized 360° Polar Azimuthal Sky-Radars */}
      {showPolarRadars && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <PolarSkyChart
            horizonProfile={scenario_a.horizon_profile}
            timeline={scenario_a.timeline}
            currentStepIndex={currentStepIndex}
            latDeg={scenario_a.site.lat_deg}
            commsMarginDeg={commsMarginDeg}
            personaMode="engineering"
            onSelectStep={onChangeStepIndex}
          />
          <PolarSkyChart
            horizonProfile={scenario_b.horizon_profile}
            timeline={scenario_b.timeline}
            currentStepIndex={currentStepIndex}
            latDeg={scenario_b.site.lat_deg}
            commsMarginDeg={commsMarginDeg}
            personaMode="engineering"
            onSelectStep={onChangeStepIndex}
          />
        </section>
      )}

      {/* Executive Winner Verdict Summary Banner */}
      <section className={`border rounded-xl p-4 shadow-lg ${executiveVerdict.accent}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded font-mono font-extrabold text-[10px] tracking-wider ${executiveVerdict.badgeClass}`}
              >
                {executiveVerdict.badgeText}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Flight Readiness Trade Synthesis
              </span>
            </div>
            <h3 className="text-sm md:text-base font-bold text-white">
              {executiveVerdict.headline}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {executiveVerdict.detail}
            </p>
          </div>
        </div>
      </section>

      {/* Trade-Off Matrix Table + 4-Axis Radar & Dual Solar Elevation Curve */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left 7 Cols: Grouped Delta Metrics Table */}
        <div className="xl:col-span-7 bg-[#0F172A] border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                      Delta Telemetry &amp; Flight-Rule Matrix
                    </h3>
                    <InfoTooltip
                      title="Category-by-Category Trade Comparison"
                      content="Green cells indicate the superior metric in each category. Crimson flags inferior metrics or survival flight-rule violations (such as continuous eclipse >50 hours or cryogenic PSR temperatures <70K)."
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Green highlights category winner • Crimson flags inferior metric or flight-rule limit
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                    <th className="py-2 pr-3">Evaluation Metric</th>
                    <th className="py-2 px-3 text-amber-300">
                      Scenario A ({scenario_a.site.name.split(' ')[0]})
                    </th>
                    <th className="py-2 px-3 text-sky-300">
                      Scenario B ({scenario_b.site.name.split(' ')[0]})
                    </th>
                    <th className="py-2 pl-3">Delta (B vs A)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-slate-200 flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div>1. Power &amp; Illumination</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Total Sunlit Hours &amp; Duty Cycle
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${getCellWinnerClasses(
                          'A',
                          deltas.winners.power_window
                        )}`}
                      >
                        {ka.total_sunlight_hours.toFixed(1)}h ({ka.sunlight_percentage.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${getCellWinnerClasses(
                          'B',
                          deltas.winners.power_window
                        )}`}
                      >
                        {kb.total_sunlight_hours.toFixed(1)}h ({kb.sunlight_percentage.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span
                        className={
                          deltas.sunlight_hours_delta_b_vs_a >= 0
                            ? 'text-emerald-400 font-semibold'
                            : 'text-rose-400 font-semibold'
                        }
                      >
                        {deltas.sunlight_hours_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.sunlight_hours_delta_b_vs_a}h (
                        {deltas.sunlight_pct_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.sunlight_pct_delta_b_vs_a}%)
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-slate-200 flex items-center gap-2">
                      <BatteryWarning className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <div>2. Battery Stress (Max Eclipse)</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Flight Rule Limit: &le;50.0h Dark
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          ka.max_continuous_darkness_hours > 50
                            ? 'bg-rose-950/60 border-rose-500 text-rose-300 font-extrabold'
                            : getCellWinnerClasses('A', deltas.winners.battery_stress)
                        }`}
                      >
                        {ka.max_continuous_darkness_hours.toFixed(1)}h{' '}
                        {ka.max_continuous_darkness_hours > 50 && '• >50h LIMIT'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          kb.max_continuous_darkness_hours > 50
                            ? 'bg-rose-950/60 border-rose-500 text-rose-300 font-extrabold'
                            : getCellWinnerClasses('B', deltas.winners.battery_stress)
                        }`}
                      >
                        {kb.max_continuous_darkness_hours.toFixed(1)}h{' '}
                        {kb.max_continuous_darkness_hours > 50 && '• >50h LIMIT'}
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span
                        className={
                          deltas.max_eclipse_hours_delta_b_vs_a <= 0
                            ? 'text-emerald-400 font-semibold'
                            : 'text-rose-400 font-semibold'
                        }
                      >
                        {deltas.max_eclipse_hours_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.max_eclipse_hours_delta_b_vs_a}h dark
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-slate-200 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        <div>3. Direct-to-Earth (DTE) Link</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Earth Visibility (&gt;{commsMarginDeg}° Margin)
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${getCellWinnerClasses(
                          'A',
                          deltas.winners.comms_window
                        )}`}
                      >
                        {ka.total_dte_hours.toFixed(1)}h ({ka.dte_comms_percentage.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${getCellWinnerClasses(
                          'B',
                          deltas.winners.comms_window
                        )}`}
                      >
                        {kb.total_dte_hours.toFixed(1)}h ({kb.dte_comms_percentage.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span
                        className={
                          deltas.dte_hours_delta_b_vs_a >= 0
                            ? 'text-emerald-400 font-semibold'
                            : 'text-rose-400 font-semibold'
                        }
                      >
                        {deltas.dte_hours_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.dte_hours_delta_b_vs_a}h ({deltas.dte_pct_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.dte_pct_delta_b_vs_a}%)
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-slate-200 flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div>4. Thermal Extremes (Diviner)</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Surface Min / Max (K &amp; °C)
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          ta?.cryogenic_hazard
                            ? 'bg-rose-950/55 border-rose-500 text-rose-300'
                            : getCellWinnerClasses('A', deltas.winners.thermal_extremes)
                        }`}
                      >
                        <div>
                          {ka.temp_min_k}K to {ka.temp_max_k}K
                        </div>
                        <div className="text-[10px] opacity-80">
                          ({ka.temp_min_c}°C to {ka.temp_max_c}°C)
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          tb?.cryogenic_hazard
                            ? 'bg-rose-950/55 border-rose-500 text-rose-300'
                            : getCellWinnerClasses('B', deltas.winners.thermal_extremes)
                        }`}
                      >
                        <div>
                          {kb.temp_min_k}K to {kb.temp_max_k}K
                        </div>
                        <div className="text-[10px] opacity-80">
                          ({kb.temp_min_c}°C to {kb.temp_max_c}°C)
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span
                        className={
                          deltas.temp_min_k_delta_b_vs_a >= 0
                            ? 'text-emerald-400 font-semibold'
                            : 'text-rose-400 font-semibold'
                        }
                      >
                        Min: {deltas.temp_min_k_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.temp_min_k_delta_b_vs_a}K
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-slate-200 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div>5. Peak Solar Elevation</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          Max Topocentric Sun Angle
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${getCellWinnerClasses(
                          'A',
                          deltas.winners.peak_solar_el
                        )}`}
                      >
                        +{ka.peak_solar_el_deg.toFixed(2)}° ({ka.average_power_kw} kW avg)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border ${getCellWinnerClasses(
                          'B',
                          deltas.winners.peak_solar_el
                        )}`}
                      >
                        +{kb.peak_solar_el_deg.toFixed(2)}° ({kb.average_power_kw} kW avg)
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span className="text-slate-300">
                        {deltas.peak_solar_el_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.peak_solar_el_delta_b_vs_a}° El
                      </span>
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-bold text-white">
                      6. Composite Viability Score
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${getCellWinnerClasses(
                          'A',
                          deltas.winners.overall_viability
                        )}`}
                      >
                        <span>{ka.viability_score.toFixed(0)}/100</span>
                        <span className="text-[10px] flex items-center gap-1">
                          {ka.feasibility_verdict === 'OPTIMAL' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : ka.feasibility_verdict === 'MARGINAL' ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <XOctagon className="w-3 h-3" />
                          )}
                          {ka.feasibility_verdict.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between ${getCellWinnerClasses(
                          'B',
                          deltas.winners.overall_viability
                        )}`}
                      >
                        <span>{kb.viability_score.toFixed(0)}/100</span>
                        <span className="text-[10px] flex items-center gap-1">
                          {kb.feasibility_verdict === 'OPTIMAL' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : kb.feasibility_verdict === 'MARGINAL' ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <XOctagon className="w-3 h-3" />
                          )}
                          {kb.feasibility_verdict.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span
                        className={
                          deltas.viability_score_delta_b_vs_a >= 0
                            ? 'text-emerald-400 font-bold'
                            : 'text-rose-400 font-bold'
                        }
                      >
                        {deltas.viability_score_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.viability_score_delta_b_vs_a} pts
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Engineering Callout Bullets */}
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-1 text-xs">
            {deltas.summary_callouts.map((msg, i) => (
              <div key={i} className="text-slate-300 font-mono text-[11px] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span>{msg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Cols: 4-Axis Radar Chart + Dual Solar Elevation Curve */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 shadow-xl flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  Normalized 4-Axis Structural Radar
                </h3>
                <p className="text-[11px] text-slate-400">
                  Illumination • DTE Comms • Diviner Thermal Safety • LOLA Flatness
                </p>
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="74%" data={radar_comparison}>
                  <PolarGrid stroke="var(--border-strong)" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                  />
                  <Radar
                    name={`Scenario A (${scenario_a.site.name.split(' ')[0]})`}
                    dataKey="ScenarioA"
                    stroke="#D97706"
                    strokeWidth={2}
                    fill="#F59E0B"
                    fillOpacity={0.32}
                  />
                  <Radar
                    name={`Scenario B (${scenario_b.site.name.split(' ')[0]})`}
                    dataKey="ScenarioB"
                    stroke="#0284C7"
                    strokeWidth={2}
                    fill="#38BDF8"
                    fillOpacity={0.32}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: "'Times New Roman', Times, serif",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 shadow-xl">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono mb-2">
              Synchronized Solar Elevation Comparison (A vs B)
            </div>
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dualTimelineData}
                  onClick={(state) => {
                    const idx = Number(state?.activeTooltipIndex);
                    if (!Number.isNaN(idx)) onChangeStepIndex(idx);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="mission_hour"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    tickFormatter={(v) => `${v}°`}
                    width={34}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: "'Times New Roman', Times, serif",
                    }}
                  />
                  <ReferenceLine x={stepA?.mission_hour} stroke="#059669" strokeWidth={1.5} />
                  <Line
                    type="monotone"
                    dataKey="sun_el_a"
                    name="Scenario A Sun El (°)"
                    stroke="#D97706"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sun_el_b"
                    name="Scenario B Sun El (°)"
                    stroke="#0284C7"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};