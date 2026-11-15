import React, { useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Sun,
  Radio,
  Navigation,
} from 'lucide-react';
import type { LunarSite, TimelineStep, MissionKPIs } from '../../types/mission';
import type { CursorTelemetry } from '../../types/workbench';

interface BottomHudOverlaysProps {
  site: LunarSite;
  kpis: MissionKPIs;
  cursor: CursorTelemetry;
  timeline: TimelineStep[];
  currentStepIndex: number;
  onChangeStepIndex: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: 1 | 5 | 20;
  onChangePlaybackSpeed: (spd: 1 | 5 | 20) => void;
  patchSizeKm: number;
}

type OperationalStateId = 'joint' | 'sun_only' | 'comms_only' | 'blackout';

interface GanttSegment {
  id: string;
  state: OperationalStateId;
  startIndex: number;
  endIndex: number;
  count: number;
  startHour: number;
  endHour: number;
  durationHours: number;
}

const STATE_META: Record<
  OperationalStateId,
  { label: string; shortLabel: string; barClass: string; dotClass: string }
> = {
  joint: {
    label: 'Joint Operations (Sun + DTE Comms)',
    shortLabel: 'Joint',
    barClass: 'bg-emerald-500 hover:bg-emerald-400',
    dotClass: 'bg-emerald-500',
  },
  sun_only: {
    label: 'Sun Only (Earth Blocked by Terrain)',
    shortLabel: 'Sun',
    barClass: 'bg-amber-500 hover:bg-amber-400',
    dotClass: 'bg-amber-500',
  },
  comms_only: {
    label: 'DTE Comms Only (Solar Eclipse — Battery Drain)',
    shortLabel: 'DTE',
    barClass: 'bg-sky-400 hover:bg-sky-300',
    dotClass: 'bg-sky-400',
  },
  blackout: {
    label: 'Full Blackout (Sun & Earth Blocked)',
    shortLabel: 'Blackout',
    barClass: 'bg-rose-500 hover:bg-rose-400',
    dotClass: 'bg-rose-500',
  },
};

function classifyStepState(step: TimelineStep): OperationalStateId {
  if (step.sun_visible && step.earth_visible) return 'joint';
  if (step.sun_visible) return 'sun_only';
  if (step.earth_visible) return 'comms_only';
  return 'blackout';
}

export const BottomHudOverlays: React.FC<BottomHudOverlaysProps> = ({
  site,
  kpis,
  cursor,
  timeline,
  currentStepIndex,
  onChangeStepIndex,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangePlaybackSpeed,
  patchSizeKm,
}) => {
  const step = timeline[currentStepIndex] || timeline[0];
  const scaleKm = Math.max(1, Math.round(patchSizeKm / 4));

  // Group contiguous mission hours with identical Sun/DTE state into Gantt ribbon segments
  const ganttSegments = useMemo<GanttSegment[]>(() => {
    if (!timeline || timeline.length === 0) return [];

    const stepDeltaHrs =
      timeline.length > 1
        ? Math.max(0.5, timeline[1].mission_hour - timeline[0].mission_hour)
        : 2;

    const segments: GanttSegment[] = [];
    let currentState = classifyStepState(timeline[0]);
    let startIdx = 0;

    for (let i = 1; i <= timeline.length; i++) {
      const nextState = i < timeline.length ? classifyStepState(timeline[i]) : null;
      if (nextState !== currentState) {
        const endIdx = i - 1;
        const count = endIdx - startIdx + 1;
        segments.push({
          id: `${currentState}_${startIdx}_${endIdx}`,
          state: currentState,
          startIndex: startIdx,
          endIndex: endIdx,
          count,
          startHour: timeline[startIdx].mission_hour,
          endHour: timeline[endIdx].mission_hour,
          durationHours: count * stepDeltaHrs,
        });
        if (nextState !== null) {
          currentState = nextState;
          startIdx = i;
        }
      }
    }

    return segments;
  }, [timeline]);

  const playheadPercent =
    timeline.length > 1
      ? Math.min(100, Math.max(0, (currentStepIndex / (timeline.length - 1)) * 100))
      : 0;

  return (
    <>
      {/* Bottom-Left: Live Selenographic Cursor & Site Readout */}
      <div
        aria-label="Live Selenographic Coordinates and Telemetry Readout"
        className="fixed bottom-3 left-3 z-30 hud-panel rounded-md px-3 py-1.5 text-[11px] font-mono pointer-events-none hidden sm:block"
      >
        <div className="flex items-center gap-3 text-slate-200 tabular-nums">
          <span>
            <span className="text-slate-500">LAT </span>
            {cursor.latDeg >= 0
              ? `${cursor.latDeg.toFixed(3)}°N`
              : `${Math.abs(cursor.latDeg).toFixed(3)}°S`}
          </span>
          <span>
            <span className="text-slate-500">LON </span>
            {cursor.lonDeg.toFixed(3)}°E
          </span>
          <span>
            <span className="text-slate-500">ELEV </span>
            {cursor.elevM >= 0 ? `+${cursor.elevM.toFixed(0)}m` : `${cursor.elevM.toFixed(0)}m`}
          </span>
          <span>
            <span className="text-slate-500">SLOPE </span>
            {cursor.slopeDeg.toFixed(1)}°
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] mt-0.5 tabular-nums">
          <span className={step?.sun_visible ? 'text-amber-400' : 'text-rose-400'}>
            SUN {step ? `${step.sun_el.toFixed(1)}° / Az ${step.sun_az.toFixed(0)}°` : '—'}
          </span>
          <span className={step?.earth_visible ? 'text-sky-400' : 'text-rose-400'}>
            EARTH {step ? `${step.earth_el.toFixed(1)}° / Az ${step.earth_az.toFixed(0)}°` : '—'}
          </span>
          <span className="text-slate-400">
            VIABILITY <strong className="text-slate-200">{kpis.viability_score.toFixed(0)}</strong>
          </span>
        </div>
      </div>

      {/* Bottom-Center: Compact Ephemeris Time Transport Dock */}
      <div
        aria-label="Mission Ephemeris Time Control"
        data-tour="time-dock"
        className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 hud-panel rounded-md px-3 py-1.5 flex items-center gap-2.5 max-w-[94vw] w-[540px]"
      >
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChangeStepIndex(Math.max(0, currentStepIndex - 1))}
            aria-label="Previous time step"
            title="Step Backward (Left Arrow)"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause ephemeris playback' : 'Play ephemeris playback'}
            title="Play / Pause (Space)"
            className="p-1.5 rounded bg-sky-400/20 text-sky-300 border border-sky-400/40 hover:bg-sky-400/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeStepIndex(Math.min(Math.max(0, timeline.length - 1), currentStepIndex + 1))
            }
            aria-label="Next time step"
            title="Step Forward (Right Arrow)"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrubber + Operational Status Gantt Ribbon (Track 4) */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
            <span className="text-slate-200 truncate">
              {step ? step.timestamp_utc.replace('T', ' ').slice(0, 16) : ''} UTC
            </span>
            <span className="text-slate-400 shrink-0 ml-2">
              T+{step ? step.mission_hour.toFixed(0) : 0}h • {site.name.split(' ')[0]}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, timeline.length - 1)}
            value={currentStepIndex}
            onChange={(e) => onChangeStepIndex(Number(e.target.value))}
            aria-label="Mission Timeline Scrubber"
            className="sci-slider w-full block"
          />

          {/* Track 4: Interactive Sun & Earth DTE Operational Status Gantt Ribbon */}
          {ganttSegments.length > 0 && (
            <div className="pt-0.5 space-y-1">
              <div
                role="group"
                aria-label="Operational Status Gantt Ribbon: Click any segment to jump to that mission window"
                className="relative h-2 w-full rounded-sm overflow-hidden flex bg-slate-900/90 ring-1 ring-slate-700/60"
              >
                {ganttSegments.map((seg) => {
                  const meta = STATE_META[seg.state];
                  const tooltip = `${meta.label} • T+${seg.startHour.toFixed(0)}h–T+${seg.endHour.toFixed(0)}h (${seg.durationHours.toFixed(0)}h) — Click to jump`;
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      style={{ flexGrow: seg.count, flexBasis: 0 }}
                      onClick={() => {
                        // Jump to onset of window; if already at onset, jump to midpoint
                        if (currentStepIndex === seg.startIndex && seg.endIndex > seg.startIndex) {
                          onChangeStepIndex(Math.floor((seg.startIndex + seg.endIndex) / 2));
                        } else {
                          onChangeStepIndex(seg.startIndex);
                        }
                      }}
                      title={tooltip}
                      aria-label={tooltip}
                      className={`h-full min-w-[2px] transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white ${meta.barClass}`}
                    />
                  );
                })}

                {/* Live Playhead Marker Synced to Timeline Scrubber */}
                <span
                  aria-hidden="true"
                  style={{ left: `${playheadPercent}%` }}
                  className="pointer-events-none absolute top-0 bottom-0 w-[2px] -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(255,255,255,0.95)]"
                />
              </div>

              {/* Compact 4-State Gantt Legend */}
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 leading-none">
                <div className="flex items-center gap-2.5">
                  {(['joint', 'sun_only', 'comms_only', 'blackout'] as const).map((stateKey) => {
                    const meta = STATE_META[stateKey];
                    return (
                      <span key={stateKey} className="inline-flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                        <span>{meta.shortLabel}</span>
                      </span>
                    );
                  })}
                </div>
                <span className="hidden sm:inline text-slate-500">Click bar to jump</span>
              </div>
            </div>
          )}
        </div>

        {/* Speed Selector & Live Power/Comms Status */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
          <button
            type="button"
            onClick={() =>
              onChangePlaybackSpeed(playbackSpeed === 1 ? 5 : playbackSpeed === 5 ? 20 : 1)
            }
            title="Cycle Playback Speed"
            className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white"
          >
            {playbackSpeed}x
          </button>
          <span
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border tabular-nums ${
              step?.sun_visible
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <Sun className="w-3 h-3" />
            {step ? `${step.power_kw.toFixed(1)}kW` : '0kW'}
          </span>
          <span
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${
              step?.earth_visible
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <Radio className="w-3 h-3" />
            {step?.earth_visible ? 'DTE' : 'LOS'}
          </span>
        </div>
      </div>

      {/* Bottom-Right: Scale Bar & North Arrow */}
      <div
        aria-label="Map Scale Bar and North Arrow"
        className="fixed bottom-3 right-3 z-30 hud-panel rounded-md px-2.5 py-1.5 hidden lg:flex items-center gap-3 text-[10px] font-mono text-slate-300 pointer-events-none"
      >
        <div className="flex flex-col items-end">
          <span className="tabular-nums">{scaleKm} km</span>
          <div className="w-16 h-1.5 border-x border-b border-slate-400 mt-0.5" />
        </div>
        <div className="h-5 w-px bg-slate-700/70" />
        <div className="flex items-center gap-1 text-sky-300">
          <Navigation className="w-3.5 h-3.5" />
          <span>0° N</span>
        </div>
      </div>
    </>
  );
};