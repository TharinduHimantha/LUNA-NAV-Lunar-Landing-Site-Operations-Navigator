import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CalendarClock,
  SlidersHorizontal,
  AlertCircle,
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
  effectiveStartUtc,
  commsMarginDeg,
  personaMode,
}) => {
  const currentStep = timeline[currentStepIndex] || timeline[0];

  // Prepare multi-track chart data
  const chartData = timeline.map((t) => ({
    mission_hour: t.mission_hour,
    step_index: t.step_index,
    timestamp_short: t.timestamp_utc.slice(5, 16).replace('T', ' '),
    sun_el: t.sun_el,
    sun_horizon_el: t.sun_horizon_el,
    earth_el: t.earth_el,
    earth_threshold_el: Number((t.earth_horizon_el + commsMarginDeg).toFixed(2)),
    power_kw: t.power_kw,
  }));

  return (
    <section className="bg-[#111827] border border-gray-800 rounded-xl p-4 shadow-lg space-y-4">
      {/* Dual Interactive Sliders Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-3 border-b border-gray-800">
        {/* Slider 1: Mission Elapsed Time Scrubber (7 cols) */}
        <div className="lg:col-span-7 bg-[#0B0F19] border border-gray-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
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
                {isPlaying ? 'PAUSE' : 'PLAY 60FPS'}
              </button>

              {/* Speed Multiplier Buttons */}
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
                title="Reset to Mission Hour 0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-right font-mono">
              <span className="text-xs text-amber-400 font-bold">
                MET: T+{currentStep?.mission_hour.toFixed(0)}h
              </span>
              <span className="text-xs text-gray-400 ml-2">
                ({currentStep?.timestamp_utc.replace('T', ' ').slice(0, 16)} UTC)
              </span>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, timeline.length - 1)}
            value={currentStepIndex}
            onChange={(e) => onChangeStepIndex(Number(e.target.value))}
            className="w-full cursor-pointer"
          />

          {/* Track 4: Operational Status Gantt Ribbon directly beneath time scrubber */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 mb-1">
              <span>OPERATIONAL STATUS RIBBON (CLICK ANY SEGMENT TO JUMP):</span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Joint (Sun+Earth)
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Sun Only
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400" /> DTE Only
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Blackout
              </span>
            </div>
            <div className="w-full h-3.5 rounded overflow-hidden flex bg-gray-900 border border-gray-800 cursor-pointer">
              {timeline.map((step, idx) => {
                const bg = step.joint_operational
                  ? 'bg-emerald-500/85'
                  : step.sun_visible
                  ? 'bg-amber-400/85'
                  : step.earth_visible
                  ? 'bg-sky-400/85'
                  : 'bg-red-600/85';
                const isCurrent = idx === currentStepIndex;
                return (
                  <div
                    key={step.step_index}
                    onClick={() => onChangeStepIndex(idx)}
                    style={{ width: `${100 / timeline.length}%` }}
                    className={`${bg} h-full transition-opacity ${
                      isCurrent ? 'ring-1 ring-white z-10 brightness-125' : 'hover:brightness-110'
                    }`}
                    title={`T+${step.mission_hour}h (${step.timestamp_utc}): Sun ${step.sun_el.toFixed(1)}°, Earth ${step.earth_el.toFixed(1)}°`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Slider 2: Launch Schedule Slip Simulator (-14d to +28d) (5 cols) */}
        <div className="lg:col-span-5 bg-[#0B0F19] border border-gray-800 rounded-lg p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-300 font-mono flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-sky-400" />
              Launch Schedule Slip Simulator
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/40 text-xs font-mono font-bold text-sky-300">
              {launchSlipDays > 0 ? `+${launchSlipDays} Days Delay` : launchSlipDays < 0 ? `${launchSlipDays} Days Early` : 'Nominal (0d Slip)'}
            </span>
          </div>

          <p className="text-[11px] text-gray-400 mb-2">
            Effective Touchdown: <strong className="text-white font-mono">{effectiveStartUtc.slice(0, 10)} UTC</strong>
            {launchSlipDays !== 0 && (
              <button
                type="button"
                onClick={() => onChangeLaunchSlipDays(0)}
                className="ml-2 text-amber-400 underline text-[10px] font-mono"
              >
                Reset to 0d
              </button>
            )}
          </p>

          <input
            type="range"
            min={-14}
            max={28}
            step={1}
            value={launchSlipDays}
            onChange={(e) => onChangeLaunchSlipDays(Number(e.target.value))}
            className="w-full cursor-pointer accent-sky-400"
          />
          <div className="flex justify-between text-[10px] font-mono text-gray-500 mt-1">
            <span>-14d Early</span>
            <span>0d Nominal</span>
            <span>+14d Delay</span>
            <span>+28d (1 Synodic Month)</span>
          </div>
        </div>
      </div>

      {/* Synchronized Multi-Track Mission Timeline Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Track 1 & 2: Sun & Earth Elevation vs Local Horizon Skyline */}
        <div className="bg-[#0B0F19] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              Track 1 & 2: Sun & Earth Elevation vs. Terrain Mask (°)
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onClick={(state) => {
                  if (state && typeof state.activeTooltipIndex === 'number') {
                    onChangeStepIndex(state.activeTooltipIndex);
                  }
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
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <ReferenceLine
                  x={currentStep?.mission_hour}
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="sun_horizon_el"
                  name="Terrain Mask (Sun Az)"
                  fill="#334155"
                  fillOpacity={0.5}
                  stroke="#64748B"
                  strokeWidth={1}
                />
                <Line
                  type="monotone"
                  dataKey="sun_el"
                  name="Sun Elevation (°)"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="earth_el"
                  name="Earth Elevation (°)"
                  stroke="#38BDF8"
                  strokeWidth={1.8}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="earth_threshold_el"
                  name="DTE Horizon + Margin (°)"
                  stroke="#0284C7"
                  strokeDasharray="3 3"
                  strokeWidth={1.2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Track 3: Solar Electrical Power Generation Over Time (kW) */}
        <div className="bg-[#0B0F19] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
              Track 3: Hardware Solar Power Generation (kW)
            </span>
            <span className="text-[11px] font-mono text-emerald-400">
              Now: {currentStep?.power_kw.toFixed(2)} kW
            </span>
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                onClick={(state) => {
                  if (state && typeof state.activeTooltipIndex === 'number') {
                    onChangeStepIndex(state.activeTooltipIndex);
                  }
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
                  tickFormatter={(v) => `${v}kW`}
                  width={42}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <ReferenceLine
                  x={currentStep?.mission_hour}
                  stroke="#10B981"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="power_kw"
                  name="Electrical Output (kW)"
                  fill="#10B981"
                  fillOpacity={0.25}
                  stroke="#10B981"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Launch Slip Sensitivity Curve (/api/launch-slip-sweep) */}
        <div className="bg-[#0B0F19] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-300 font-mono flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-sky-400" />
              Schedule Cliff Sensitivity (-14d to +28d Slip)
            </span>
          </div>
          <div className="h-48 w-full">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="slip_days"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(v) => (v > 0 ? `+${v}d` : `${v}d`)}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  tickFormatter={(v) => `${v}%`}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <ReferenceLine
                  x={launchSlipDays}
                  stroke="#38BDF8"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="viability_score"
                  name="Viability Score (0-100)"
                  fill="#38BDF8"
                  fillOpacity={0.18}
                  stroke="#38BDF8"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="sunlight_pct"
                  name="Sunlight Window (%)"
                  stroke="#F59E0B"
                  strokeWidth={1.8}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="dte_comms_pct"
                  name="DTE Comms (%)"
                  stroke="#10B981"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {personaMode === 'educator' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Explorer Tip:</strong> Drag the <em>Launch Schedule Slip Simulator</em> slider on the right to see how delaying a rocket launch by just a few days shifts the Moon in its 27.3-day libration and 29.5-day solar cycle—exposing "schedule cliffs" where crater shadows suddenly block the Sun!
          </span>
        </div>
      )}
    </section>
  );
};
