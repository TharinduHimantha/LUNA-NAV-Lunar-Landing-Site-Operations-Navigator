import React, { useState } from 'react';
import {
  Sun,
  Radio,
  BatteryWarning,
  Thermometer,
  TrendingUp,
  Award,
  Play,
  Pause,
  RotateCcw,
  Snowflake,
  ArrowLeftRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Compass,
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
  onTogglePlay,
  playbackSpeed,
  onChangePlaybackSpeed,
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

  // Build synchronized dual-power & elevation chart data
  const dualTimelineData = scenario_a.timeline.map((tA, idx) => {
    const tB = scenario_b.timeline[idx] || tA;
    return {
      mission_hour: tA.mission_hour,
      sun_el_a: tA.sun_el,
      sun_el_b: tB.sun_el,
      power_kw_a: tA.power_kw,
      power_kw_b: tB.power_kw,
    };
  });

  // Helper to style winner vs loser cells in the Trade-Off Matrix
  const getCellWinnerClasses = (side: 'A' | 'B', winner: 'A' | 'B' | 'TIE') => {
    if (winner === 'TIE') {
      return 'bg-gray-900/60 border-gray-700 text-gray-200';
    }
    if (winner === side) {
      return 'bg-emerald-950/35 border-emerald-500/60 text-emerald-300 font-bold';
    }
    return 'bg-red-950/25 border-red-500/40 text-red-300';
  };

  return (
    <div className="space-y-4">
      {/* Top Scenario A vs Scenario B Controls & Quick Trade-Study Presets */}
      <section className="bg-[#111827] border border-gray-800 rounded-xl p-3.5 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-400" />
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                Side-by-Side Scenario Trade-Off & Real NASA Dataset Comparator
              </h2>
              <p className="text-[11px] text-gray-400">
                Compare two landing sites or launch dates simultaneously with 128×128 LOLA DEMs, LROC textures & Diviner thermal extrema
              </p>
            </div>
          </div>

          {/* Quick Trade-Study Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-gray-400 mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
            </span>
            <button
              type="button"
              onClick={() => onApplyPreset('shackleton_ridge', 0, 'malapert_massif', 0)}
              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] font-mono text-amber-300 border border-gray-700 transition"
            >
              Shackleton vs Malapert
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('nobile_rim', 0, 'nobile_rim', 10)}
              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] font-mono text-sky-300 border border-gray-700 transition"
            >
              Nobile Nominal vs +10d Slip
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('shackleton_ridge', 0, 'haworth_floor', 0)}
              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] font-mono text-indigo-300 border border-gray-700 transition"
            >
              Peak of Light vs Cold Trap
            </button>
            <button
              type="button"
              onClick={() => onApplyPreset('shackleton_ridge', 0, 'apollo_11', 0)}
              className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] font-mono text-emerald-300 border border-gray-700 transition"
            >
              South Pole vs Apollo 11
            </button>
          </div>
        </div>

        {/* Dual Scenario Selector Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Scenario A Configurator */}
          <div className="bg-[#0B0F19] border border-amber-500/40 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-mono font-extrabold text-xs">
                SCENARIO A
              </span>
              <select
                value={siteAId}
                onChange={(e) => onChangeSiteA(e.target.value)}
                className="bg-[#111827] border border-gray-700 rounded px-2.5 py-1 text-xs font-semibold text-white"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.lat_deg}°)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-400">Launch Slip:</span>
              <input
                type="range"
                min={-14}
                max={28}
                step={1}
                value={slipADays}
                onChange={(e) => onChangeSlipA(Number(e.target.value))}
                className="w-24 accent-amber-400"
              />
              <span className="text-amber-300 font-bold w-12 text-right">
                {slipADays >= 0 ? `+${slipADays}d` : `${slipADays}d`}
              </span>
            </div>
          </div>

          {/* Scenario B Configurator */}
          <div className="bg-[#0B0F19] border border-sky-500/40 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-400 text-slate-950 font-mono font-extrabold text-xs">
                SCENARIO B
              </span>
              <select
                value={siteBId}
                onChange={(e) => onChangeSiteB(e.target.value)}
                className="bg-[#111827] border border-gray-700 rounded px-2.5 py-1 text-xs font-semibold text-white"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.lat_deg}°)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-400">Launch Slip:</span>
              <input
                type="range"
                min={-14}
                max={28}
                step={1}
                value={slipBDays}
                onChange={(e) => onChangeSlipB(Number(e.target.value))}
                className="w-24 accent-sky-400"
              />
              <span className="text-sky-300 font-bold w-12 text-right">
                {slipBDays >= 0 ? `+${slipBDays}d` : `${slipBDays}d`}
              </span>
            </div>
          </div>
        </div>

        {/* Synchronized Master Timeline Scrubber Bar */}
        <div className="bg-[#0B0F19] border border-gray-800 rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTogglePlay}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono font-bold transition ${
                  isPlaying
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'PAUSE SYNC' : 'SYNC PLAY 60FPS'}
              </button>

              <div className="inline-flex rounded bg-[#111827] border border-gray-700 p-0.5">
                {([1, 5, 20] as const).map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => onChangePlaybackSpeed(spd)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                      playbackSpeed === spd
                        ? 'bg-sky-500/25 text-sky-300 font-bold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onChangeStepIndex(0)}
                className="p-1 rounded bg-gray-800 text-gray-400 hover:text-white"
                title="Reset Scrubber to Hour 0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setShowPsrOverlay((p) => !p)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-semibold border transition ${
                  showPsrOverlay
                    ? 'bg-indigo-600/30 text-indigo-200 border-indigo-400'
                    : 'bg-gray-800 text-gray-300 border-gray-700'
                }`}
              >
                <Snowflake className="w-3.5 h-3.5 text-sky-300" />
                {showPsrOverlay ? 'PSR Cold-Trap Overlay: ON' : 'PSR Cold-Trap Overlay: OFF'}
              </button>

              <button
                type="button"
                onClick={() => setShowPolarRadars((p) => !p)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-semibold border transition ${
                  showPolarRadars
                    ? 'bg-sky-600/30 text-sky-200 border-sky-400'
                    : 'bg-gray-800 text-gray-300 border-gray-700'
                }`}
              >
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                {showPolarRadars ? 'Hide 360° Sky-Radars' : 'Show 360° Sky-Radars'}
              </button>
            </div>

            <div className="font-mono text-xs">
              <span className="text-amber-400 font-bold">
                SYNCHRONIZED MISSION HOUR: T+{stepA?.mission_hour.toFixed(0)}h
              </span>
              <span className="text-gray-400 ml-2">
                (A: {stepA?.timestamp_utc.slice(0, 10)} | B: {stepB?.timestamp_utc.slice(0, 10)})
              </span>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, scenario_a.timeline.length - 1)}
            value={currentStepIndex}
            onChange={(e) => onChangeStepIndex(Number(e.target.value))}
            className="w-full cursor-pointer"
          />

          {/* Dual Operational Status Ribbons (Scenario A vs Scenario B) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            <div>
              <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-0.5">
                <span>SCENARIO A OPS RIBBON ({scenario_a.site.name}):</span>
                <span className={stepA?.sun_visible ? 'text-amber-400' : 'text-red-400'}>
                  {stepA?.sun_visible ? `SUNLIT (${stepA.power_kw.toFixed(2)}kW)` : 'IN SHADOW'}
                </span>
              </div>
              <div className="w-full h-2.5 rounded overflow-hidden flex bg-gray-900 border border-gray-800 cursor-pointer">
                {scenario_a.timeline.map((s, idx) => {
                  const bg = s.joint_operational
                    ? 'bg-emerald-500/85'
                    : s.sun_visible
                    ? 'bg-amber-400/85'
                    : s.earth_visible
                    ? 'bg-sky-400/85'
                    : 'bg-red-600/85';
                  return (
                    <div
                      key={s.step_index}
                      onClick={() => onChangeStepIndex(idx)}
                      style={{ width: `${100 / scenario_a.timeline.length}%` }}
                      className={`${bg} h-full ${idx === currentStepIndex ? 'ring-1 ring-white z-10' : ''}`}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-0.5">
                <span>SCENARIO B OPS RIBBON ({scenario_b.site.name}):</span>
                <span className={stepB?.sun_visible ? 'text-sky-300' : 'text-red-400'}>
                  {stepB?.sun_visible ? `SUNLIT (${stepB.power_kw.toFixed(2)}kW)` : 'IN SHADOW'}
                </span>
              </div>
              <div className="w-full h-2.5 rounded overflow-hidden flex bg-gray-900 border border-gray-800 cursor-pointer">
                {scenario_b.timeline.map((s, idx) => {
                  const bg = s.joint_operational
                    ? 'bg-emerald-500/85'
                    : s.sun_visible
                    ? 'bg-amber-400/85'
                    : s.earth_visible
                    ? 'bg-sky-400/85'
                    : 'bg-red-600/85';
                  return (
                    <div
                      key={s.step_index}
                      onClick={() => onChangeStepIndex(idx)}
                      style={{ width: `${100 / scenario_b.timeline.length}%` }}
                      className={`${bg} h-full ${idx === currentStepIndex ? 'ring-1 ring-white z-10' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3.1 Split-Screen Synchronized 3D Viewports */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Pane A: Scenario 1 */}
        <div className="min-h-[380px]">
          <LunarTerrain3D
            site={scenario_a.site}
            terrainGrid={scenario_a.terrain_grid}
            timeline={scenario_a.timeline}
            currentStepIndex={currentStepIndex}
            arrayType={arrayType}
            thermalMetrics={scenario_a.thermal_metrics}
            scenarioBadge={`SCENARIO A (${slipADays >= 0 ? `+${slipADays}d` : `${slipADays}d`})`}
            compactMode
            externalShowPsr={showPsrOverlay}
            onTogglePsr={setShowPsrOverlay}
          />
        </div>

        {/* Pane B: Scenario 2 */}
        <div className="min-h-[380px]">
          <LunarTerrain3D
            site={scenario_b.site}
            terrainGrid={scenario_b.terrain_grid}
            timeline={scenario_b.timeline}
            currentStepIndex={currentStepIndex}
            arrayType={arrayType}
            thermalMetrics={scenario_b.thermal_metrics}
            scenarioBadge={`SCENARIO B (${slipBDays >= 0 ? `+${slipBDays}d` : `${slipBDays}d`})`}
            compactMode
            externalShowPsr={showPsrOverlay}
            onTogglePsr={setShowPsrOverlay}
          />
        </div>
      </section>

      {/* Optional Synchronized 360° Polar Azimuthal Sky-Radars for Pane A & Pane B */}
      {showPolarRadars && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <PolarSkyChart
            horizonProfile={scenario_a.horizon_profile}
            timeline={scenario_a.timeline}
            currentStepIndex={currentStepIndex}
            latDeg={scenario_a.site.lat_deg}
            commsMarginDeg={commsMarginDeg}
            personaMode="engineering"
          />
          <PolarSkyChart
            horizonProfile={scenario_b.horizon_profile}
            timeline={scenario_b.timeline}
            currentStepIndex={currentStepIndex}
            latDeg={scenario_b.site.lat_deg}
            commsMarginDeg={commsMarginDeg}
            personaMode="engineering"
          />
        </section>
      )}

      {/* 3.2 & 3.3 The Trade-Off Matrix (Delta Metrics Table) + Overlapping Spider/Radar Chart */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left 7 Cols: High-Contrast Trade-Off Matrix Table */}
        <div className="xl:col-span-7 bg-[#111827] border border-gray-800 rounded-xl p-4 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                    Mission Trade-Off Matrix & Delta Telemetry
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Green highlights category winner • Red flags inferior metric or survival violation
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
                OVERALL WINNER:{' '}
                {deltas.winners.overall_viability === 'A'
                  ? `SCENARIO A (${scenario_a.site.name})`
                  : deltas.winners.overall_viability === 'B'
                  ? `SCENARIO B (${scenario_b.site.name})`
                  : 'STATISTICAL TIE'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-gray-800 text-[11px] text-gray-400 uppercase">
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
                <tbody className="divide-y divide-gray-800/70">
                  {/* Row 1: Power Window */}
                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-gray-200 flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div>1. Power Window</div>
                        <div className="text-[10px] text-gray-400 font-normal">
                          Total Sunlight Hours & %
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${getCellWinnerClasses(
                          'A',
                          deltas.winners.power_window
                        )}`}
                      >
                        {ka.total_sunlight_hours.toFixed(1)}h ({ka.sunlight_percentage.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${getCellWinnerClasses(
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
                            : 'text-red-400 font-semibold'
                        }
                      >
                        {deltas.sunlight_hours_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.sunlight_hours_delta_b_vs_a}h (
                        {deltas.sunlight_pct_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.sunlight_pct_delta_b_vs_a}%)
                      </span>
                    </td>
                  </tr>

                  {/* Row 2: Thermal/Battery Stress (Max Continuous Eclipse) */}
                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-gray-200 flex items-center gap-2">
                      <BatteryWarning className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <div>2. Battery Stress (Max Eclipse)</div>
                        <div className="text-[10px] text-gray-400 font-normal">
                          Survival Limit: &le;50.0h Dark
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${
                          ka.max_continuous_darkness_hours > 50
                            ? 'bg-red-950/60 border-red-500 text-red-300 font-extrabold'
                            : getCellWinnerClasses('A', deltas.winners.battery_stress)
                        }`}
                      >
                        {ka.max_continuous_darkness_hours.toFixed(1)}h{' '}
                        {ka.max_continuous_darkness_hours > 50 && '⚠️ >50h LIMIT'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${
                          kb.max_continuous_darkness_hours > 50
                            ? 'bg-red-950/60 border-red-500 text-red-300 font-extrabold'
                            : getCellWinnerClasses('B', deltas.winners.battery_stress)
                        }`}
                      >
                        {kb.max_continuous_darkness_hours.toFixed(1)}h{' '}
                        {kb.max_continuous_darkness_hours > 50 && '⚠️ >50h LIMIT'}
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span
                        className={
                          deltas.max_eclipse_hours_delta_b_vs_a <= 0
                            ? 'text-emerald-400 font-semibold'
                            : 'text-red-400 font-semibold'
                        }
                      >
                        {deltas.max_eclipse_hours_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.max_eclipse_hours_delta_b_vs_a}h shadow
                      </span>
                    </td>
                  </tr>

                  {/* Row 3: Direct-to-Earth (DTE) Comms Window */}
                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-gray-200 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        <div>3. DTE Comms Window</div>
                        <div className="text-[10px] text-gray-400 font-normal">
                          Earth Visibility (&gt;{commsMarginDeg}° Margin)
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${getCellWinnerClasses(
                          'A',
                          deltas.winners.comms_window
                        )}`}
                      >
                        {ka.total_dte_hours.toFixed(1)}h ({ka.dte_comms_percentage.toFixed(1)}%)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${getCellWinnerClasses(
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
                            : 'text-red-400 font-semibold'
                        }
                      >
                        {deltas.dte_hours_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.dte_hours_delta_b_vs_a}h ({deltas.dte_pct_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.dte_pct_delta_b_vs_a}%)
                      </span>
                    </td>
                  </tr>

                  {/* Row 4: Diviner Thermal Extremes */}
                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-gray-200 flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div>4. Thermal Extremes (Diviner)</div>
                        <div className="text-[10px] text-gray-400 font-normal">
                          Surface Min / Max (K &amp; °C)
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${
                          ta?.cryogenic_hazard
                            ? 'bg-red-950/55 border-red-500 text-red-300'
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
                        className={`px-2.5 py-1.5 rounded border ${
                          tb?.cryogenic_hazard
                            ? 'bg-red-950/55 border-red-500 text-red-300'
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
                            : 'text-red-400 font-semibold'
                        }
                      >
                        Min: {deltas.temp_min_k_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.temp_min_k_delta_b_vs_a}K
                      </span>
                    </td>
                  </tr>

                  {/* Row 5: Peak Solar Elevation */}
                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-semibold text-gray-200 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div>5. Peak Solar Elevation</div>
                        <div className="text-[10px] text-gray-400 font-normal">
                          Max Topocentric Sun Angle
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${getCellWinnerClasses(
                          'A',
                          deltas.winners.peak_solar_el
                        )}`}
                      >
                        +{ka.peak_solar_el_deg.toFixed(2)}° (Avg {ka.average_power_kw} kW)
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border ${getCellWinnerClasses(
                          'B',
                          deltas.winners.peak_solar_el
                        )}`}
                      >
                        +{kb.peak_solar_el_deg.toFixed(2)}° (Avg {kb.average_power_kw} kW)
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span className="text-gray-300">
                        {deltas.peak_solar_el_delta_b_vs_a >= 0 ? '+' : ''}
                        {deltas.peak_solar_el_delta_b_vs_a}° El
                      </span>
                    </td>
                  </tr>

                  {/* Row 6: Composite Viability & Verdict */}
                  <tr>
                    <td className="py-2.5 pr-3 font-sans font-bold text-white">
                      6. Mission Viability Verdict
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border flex items-center justify-between ${getCellWinnerClasses(
                          'A',
                          deltas.winners.overall_viability
                        )}`}
                      >
                        <span>{ka.viability_score.toFixed(1)}/100</span>
                        <span className="text-[10px] flex items-center gap-1">
                          {ka.feasibility_verdict === 'OPTIMAL' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : ka.feasibility_verdict === 'MARGINAL' ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <XOctagon className="w-3 h-3" />
                          )}
                          {ka.feasibility_verdict}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div
                        className={`px-2.5 py-1.5 rounded border flex items-center justify-between ${getCellWinnerClasses(
                          'B',
                          deltas.winners.overall_viability
                        )}`}
                      >
                        <span>{kb.viability_score.toFixed(1)}/100</span>
                        <span className="text-[10px] flex items-center gap-1">
                          {kb.feasibility_verdict === 'OPTIMAL' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : kb.feasibility_verdict === 'MARGINAL' ? (
                            <AlertTriangle className="w-3 h-3" />
                          ) : (
                            <XOctagon className="w-3 h-3" />
                          )}
                          {kb.feasibility_verdict}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pl-3 text-[11px]">
                      <span
                        className={
                          deltas.viability_score_delta_b_vs_a >= 0
                            ? 'text-emerald-400 font-bold'
                            : 'text-red-400 font-bold'
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

          {/* Automated Executive Trade-Off Summary Callouts */}
          <div className="mt-3 pt-3 border-t border-gray-800 space-y-1 text-xs">
            {deltas.summary_callouts.map((msg, i) => (
              <div key={i} className="text-gray-300 font-mono text-[11px] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {msg}
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Cols: 3.3 Overlapping Spider/Radar Chart + Dual Timeline */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Overlapping 4-Axis Spider / Radar Chart */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 shadow-lg flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  Normalized 4-Axis Structural Radar
                </h3>
                <p className="text-[11px] text-gray-400">
                  Illumination • DTE Comms • Diviner Thermal Safety • LOLA Flatness
                </p>
              </div>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="74%" data={radar_comparison}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fill: '#E2E8F0', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: '#64748B', fontSize: 9 }}
                  />
                  <Radar
                    name={`Scenario A (${scenario_a.site.name.split(' ')[0]})`}
                    dataKey="ScenarioA"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fill="#F59E0B"
                    fillOpacity={0.32}
                  />
                  <Radar
                    name={`Scenario B (${scenario_b.site.name.split(' ')[0]})`}
                    dataKey="ScenarioB"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    fill="#38BDF8"
                    fillOpacity={0.32}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Synchronized Dual Solar Elevation Curve (A vs B) */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-3.5 shadow-lg">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono mb-2">
              Synchronized Sun Elevation Comparison (Scenario A vs B)
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="mission_hour"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <YAxis
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                    tickFormatter={(v) => `${v}°`}
                    width={34}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                  <ReferenceLine x={stepA?.mission_hour} stroke="#10B981" strokeWidth={1.5} />
                  <Line
                    type="monotone"
                    dataKey="sun_el_a"
                    name="Scenario A Sun El (°)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sun_el_b"
                    name="Scenario B Sun El (°)"
                    stroke="#38BDF8"
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

