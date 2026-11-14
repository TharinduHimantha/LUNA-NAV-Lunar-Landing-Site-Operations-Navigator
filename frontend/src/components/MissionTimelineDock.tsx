import React, { useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  AlertCircle,
  Zap,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type {
  TimelineStep,
  LaunchSlipSweepPoint,
  PersonaMode,
} from '../types/mission';

interface MissionTimelineDockProps {
  timeline: TimelineStep[];
  currentStepIndex: number;
  onChangeStepIndex: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: 1 | 5 | 20;
  onChangePlaybackSpeed: (speed: 1 | 5 | 20) => void;
  launchSlipDays: number;
  onChangeLaunchSlipDays: (days: number) => void;
  slipSweep: LaunchSlipSweepPoint[];
  effectiveStartUtc: string;
  commsMarginDeg: number;
  personaMode: PersonaMode;
}

export const MissionTimelineDock: React.FC<MissionTimelineDockProps> = ({
  timeline,
  currentStepIndex,
  onChangeStepIndex,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangePlaybackSpeed,
  launchSlipDays,
  onChangeLaunchSlipDays,
  slipSweep,
  commsMarginDeg,
  personaMode,
}) => {
  const currentStep = timeline[currentStepIndex] || timeline[0];

  const chartData = useMemo(
    () =>
      timeline.map((t) => ({
        mission_hour: t.mission_hour,
        step_index: t.step_index,
        timestamp_short: t.timestamp_utc.slice(5, 16).replace('T', ' '),
        sun_el: t.sun_el,
        sun_horizon_el: t.sun_horizon_el,
        earth_el: t.earth_el,
        earth_threshold_el: Number((t.earth_horizon_el + commsMarginDeg).toFixed(2)),
        power_kw: t.power_kw,
      })),
    [timeline, commsMarginDeg]
  );

  const hasSlipSweep = slipSweep && slipSweep.length > 0;

  return (
    <section
      aria-label="Global Mission Timeline Transport and Telemetry Tracks"
      className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 shadow-xl space-y-4"
    >
      {/* Unified Global Transport & Operational Status Ribbon */}
      <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Media Playback Controls & Keyboard Hints */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition shadow-sm ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              }`}
              title="Play / Pause Ephemeris Simulation (Shortcut: Space)"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <div className="inline-flex rounded-lg bg-[#0F172A] border border-slate-700 p-0.5">
              {([1, 5, 20] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onChangePlaybackSpeed(spd)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition ${
                    playbackSpeed === spd
                      ? 'bg-sky-500/25 text-sky-300 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onChangeStepIndex(0)}
              className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition"
              title="Reset to Mission Hour 0 (Shortcut: R)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <span className="hidden xl:inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-500 ml-2">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                Space
              </kbd>
              <span>Play</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                ←/→
              </kbd>
              <span>Step</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                R
              </kbd>
              <span>Reset</span>
            </span>
          </div>

          {/* Right: Dual MET & UTC Mission Clocks */}
          <div className="flex items-center gap-3 font-mono">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0F172A] border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-300">
                MET T+{currentStep?.mission_hour.toFixed(0)}h
              </span>
            </div>
            <div className="text-xs text-slate-300 bg-[#0F172A] border border-slate-800 px-2.5 py-1 rounded-lg">
              {currentStep?.timestamp_utc.replace('T', ' ').slice(0, 16)}{' '}
              <span className="text-slate-500">UTC</span>
            </div>
          </div>
        </div>

        {/* Interactive Timeline Scrubber */}
        <input
          type="range"
          min={0}
          max={Math.max(0, timeline.length - 1)}
          value={currentStepIndex}
          onChange={(e) => onChangeStepIndex(Number(e.target.value))}
          aria-label="Mission Elapsed Time Scrubber"
          className="w-full cursor-pointer"
        />

        {/* Operational Status Gantt Ribbon */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 mb-1">
            <span>OPERATIONAL WINDOWS (CLICK ANY SEGMENT TO SCRUB):</span>
            <span className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Full Ops (Sun + DTE)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Sun Only
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400" /> DTE Only
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500" /> Dark Eclipse
              </span>
            </span>
          </div>
          <div className="w-full h-3.5 rounded-md overflow-hidden flex bg-slate-900 border border-slate-800 cursor-pointer">
            {timeline.map((step, idx) => {
              const bg = step.joint_operational
                ? 'bg-emerald-500/85'
                : step.sun_visible
                ? 'bg-amber-400/85'
                : step.earth_visible
                ? 'bg-sky-400/85'
                : 'bg-rose-600/85';
              const isCurrent = idx === currentStepIndex;
              return (
                <div
                  key={step.step_index}
                  onClick={() => onChangeStepIndex(idx)}
                  style={{ width: `${100 / timeline.length}%` }}
                  className={`${bg} h-full transition-opacity ${
                    isCurrent ? 'ring-2 ring-white z-10 brightness-125' : 'hover:brightness-110'
                  }`}
                  title={`T+${step.mission_hour}h (${step.timestamp_utc}): Sun ${step.sun_el.toFixed(
                    1
                  )}°, Earth ${step.earth_el.toFixed(1)}°`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Synchronized Multi-Track Mission Timeline Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Track 1 & 2: Sun & Earth Elevation vs Local Horizon Skyline */}
        <div
          className={`${
            hasSlipSweep ? 'lg:col-span-4' : 'lg:col-span-7'
          } bg-[#080C14] border border-slate-800 rounded-xl p-3`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Sun &amp; Earth Elevation vs. Terrain Horizon (°)</span>
            </span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onClick={(state) => {
                  if (state && typeof state.activeTooltipIndex === 'number') {
                    onChangeStepIndex(state.activeTooltipIndex);
                  }
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
                  width={36}
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
                <ReferenceLine
                  x={currentStep?.mission_hour}
                  stroke="#D97706"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="sun_horizon_el"
                  name="Terrain Mask (Sun Az)"
                  fill="#64748B"
                  fillOpacity={0.35}
                  stroke="#64748B"
                  strokeWidth={1}
                />
                <Line
                  type="monotone"
                  dataKey="sun_el"
                  name="Sun Elevation (°)"
                  stroke="#D97706"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="earth_el"
                  name="Earth Elevation (°)"
                  stroke="#0284C7"
                  strokeWidth={1.8}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="earth_threshold_el"
                  name="DTE Horizon + Margin (°)"
                  stroke="#0369A1"
                  strokeDasharray="3 3"
                  strokeWidth={1.2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Track 3: Solar Electrical Power Generation Over Time (kW) */}
        <div
          className={`${
            hasSlipSweep ? 'lg:col-span-4' : 'lg:col-span-5'
          } bg-[#080C14] border border-slate-800 rounded-xl p-3`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Solar Power Generation (kW)</span>
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-400">
              Now: {currentStep?.power_kw.toFixed(2)} kW
            </span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onClick={(state) => {
                  if (state && typeof state.activeTooltipIndex === 'number') {
                    onChangeStepIndex(state.activeTooltipIndex);
                  }
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
                  tickFormatter={(v) => `${v}kW`}
                  width={42}
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
                <ReferenceLine
                  x={currentStep?.mission_hour}
                  stroke="#059669"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="power_kw"
                  name="Electrical Output (kW)"
                  fill="#10B981"
                  fillOpacity={0.25}
                  stroke="#059669"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Optional Track 4: Launch Slip Sensitivity Curve when sweep data is available */}
        {hasSlipSweep && (
          <div className="lg:col-span-4 bg-[#080C14] border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-300 font-mono flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>Schedule Cliff Sensitivity (-14d to +28d)</span>
              </span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={slipSweep}
                  onClick={(state) => {
                    const idx = Number(state?.activeTooltipIndex);
                    if (!Number.isNaN(idx) && slipSweep[idx]) {
                      onChangeLaunchSlipDays(slipSweep[idx].slip_days);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="slip_days"
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    tickFormatter={(v) => (v > 0 ? `+${v}d` : `${v}d`)}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                    width={36}
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
                  <ReferenceLine x={launchSlipDays} stroke="#0284C7" strokeWidth={2} />
                  <Area
                    type="monotone"
                    dataKey="viability_score"
                    name="Viability Score (0-100)"
                    fill="#0284C7"
                    fillOpacity={0.18}
                    stroke="#0284C7"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="sunlight_pct"
                    name="Sunlight Window (%)"
                    stroke="#D97706"
                    strokeWidth={1.8}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="dte_comms_pct"
                    name="DTE Comms (%)"
                    stroke="#059669"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {personaMode === 'educator' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Explorer Tip:</strong> Scrub the timeline or click any colored block in the Operational Windows bar to jump straight to a sunrise, sunset, or Earth radio blackout event.
          </span>
        </div>
      )}
    </section>
  );
};