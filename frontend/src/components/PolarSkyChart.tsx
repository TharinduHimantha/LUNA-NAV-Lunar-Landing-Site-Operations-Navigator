import React, { useMemo, useState } from 'react';
import { Compass, Sun, Radio, Eye, MousePointerClick } from 'lucide-react';
import type { HorizonPoint, TimelineStep, PersonaMode } from '../types/mission';
import { InfoTooltip } from './InfoTooltip';

interface PolarSkyChartProps {
  horizonProfile: HorizonPoint[];
  timeline: TimelineStep[];
  currentStepIndex: number;
  latDeg: number;
  commsMarginDeg: number;
  personaMode: PersonaMode;
  onSelectStep?: (idx: number) => void;
}

export const PolarSkyChart: React.FC<PolarSkyChartProps> = React.memo(
  ({
    horizonProfile,
    timeline,
    currentStepIndex,
    latDeg,
    commsMarginDeg,
    personaMode,
    onSelectStep,
  }) => {
    const [hoveredStepIdx, setHoveredStepIdx] = useState<number | null>(null);
    const isEquatorial = Math.abs(latDeg) < 45;

    const minEl = isEquatorial ? -10 : -5;
    const maxEl = isEquatorial ? 90 : 14;

    const size = 360;
    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = 142;

    const polarToCartesian = (azDeg: number, elDeg: number): [number, number] => {
      const clampedEl = Math.max(minEl, Math.min(maxEl, elDeg));
      const norm = (maxEl - clampedEl) / (maxEl - minEl);
      const r = 18 + norm * (outerRadius - 18);
      const rad = (azDeg * Math.PI) / 180;
      const x = cx + r * Math.sin(rad);
      const y = cy - r * Math.cos(rad);
      return [x, y];
    };

    const horizonMaskPath = useMemo(() => {
      if (!horizonProfile.length) return '';
      const innerPts = horizonProfile.map((pt) =>
        polarToCartesian(pt.azimuth, pt.elevation_deg)
      );
      const outerPts = horizonProfile
        .slice()
        .reverse()
        .map((pt) => polarToCartesian(pt.azimuth, minEl));

      const innerCmd = innerPts
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
        .join(' ');
      const outerCmd = outerPts
        .map((p) => `L ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
        .join(' ');
      return `${innerCmd} Z ${outerCmd} Z`;
    }, [horizonProfile, minEl, maxEl]);

    const horizonSkylinePoints = useMemo(() => {
      return horizonProfile
        .map((pt) => {
          const [x, y] = polarToCartesian(pt.azimuth, pt.elevation_deg);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    }, [horizonProfile, minEl, maxEl]);

    const commsMarginPoints = useMemo(() => {
      return horizonProfile
        .map((pt) => {
          const [x, y] = polarToCartesian(pt.azimuth, pt.elevation_deg + commsMarginDeg);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    }, [horizonProfile, commsMarginDeg, minEl, maxEl]);

    const sunTrackPoints = useMemo(() => {
      return timeline
        .map((step) => {
          const [x, y] = polarToCartesian(step.sun_az, step.sun_el);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    }, [timeline, minEl, maxEl]);

    const earthTrackPoints = useMemo(() => {
      return timeline
        .map((step) => {
          const [x, y] = polarToCartesian(step.earth_az, step.earth_el);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    }, [timeline, minEl, maxEl]);

    const currentStep = timeline[currentStepIndex] || timeline[0];
    const hoveredStep = hoveredStepIdx !== null ? timeline[hoveredStepIdx] : null;

    const [sunX, sunY] = currentStep
      ? polarToCartesian(currentStep.sun_az, currentStep.sun_el)
      : [cx, cy];
    const [earthX, earthY] = currentStep
      ? polarToCartesian(currentStep.earth_az, currentStep.earth_el)
      : [cx, cy];

    const [hoverSunX, hoverSunY] = hoveredStep
      ? polarToCartesian(hoveredStep.sun_az, hoveredStep.sun_el)
      : [cx, cy];

    const findNearestStep = (e: React.MouseEvent<SVGSVGElement>): number => {
      const rect = e.currentTarget.getBoundingClientRect();
      const scale = size / rect.width;
      const clickX = (e.clientX - rect.left) * scale;
      const clickY = (e.clientY - rect.top) * scale;

      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < timeline.length; i++) {
        const s = timeline[i];
        const [sx, sy] = polarToCartesian(s.sun_az, s.sun_el);
        const d = (sx - clickX) ** 2 + (sy - clickY) ** 2;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    const handleChartMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!timeline.length) return;
      setHoveredStepIdx(findNearestStep(e));
    };

    const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!onSelectStep || !timeline.length) return;
      onSelectStep(findNearestStep(e));
    };

    const elevationRings = isEquatorial ? [0, 30, 60] : [-2, 0, 2, 5, 10];

    return (
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-2">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-sky-400 shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  360° Polar Horizon Radar
                </h2>
                <InfoTooltip
                  title="Topocentric Az/El Sky Projection"
                  content="Maps the surrounding crater rim elevation H(Az) from LOLA DEM ray-casting against the Sun's 360° polar path and Earth's 27.3-day optical libration loop. Whenever the Sun or Earth dips inside the shaded outer terrain wall, line-of-sight is blocked."
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {isEquatorial
                  ? 'Equatorial Zenith Projection (-10° to +90° El)'
                  : 'Polar Grazing Horizon Zoom (-5° to +14° El)'}
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-[10px] font-mono text-slate-300 border border-slate-700">
            <MousePointerClick className="w-3 h-3 text-amber-400" />
            Click Track to Scrub
          </span>
        </div>

        {/* SVG Radar Plot */}
        <div className="relative flex-1 flex items-center justify-center my-1">
          {hoveredStep && (
            <div className="absolute top-1 left-1 z-10 hud-glass rounded-lg px-2.5 py-1 text-[10px] font-mono pointer-events-none">
              <div className="text-amber-300 font-bold">
                Jump to T+{hoveredStep.mission_hour.toFixed(0)}h
              </div>
              <div className="text-slate-300">
                Sun {hoveredStep.sun_el.toFixed(1)}° • Earth {hoveredStep.earth_el.toFixed(1)}°
              </div>
            </div>
          )}

          <svg
            viewBox={`0 0 ${size} ${size}`}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoveredStepIdx(null)}
            onClick={handleChartClick}
            className="w-full max-w-[335px] h-auto select-none cursor-crosshair"
          >
            <defs>
              <radialGradient id="skyDomeGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--bg-surface)" />
                <stop offset="80%" stopColor="var(--bg-inset)" />
                <stop offset="100%" stopColor="var(--bg-page)" />
              </radialGradient>
              <filter id="glowGold" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="glowCyan" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <circle
              cx={cx}
              cy={cy}
              r={outerRadius}
              fill="url(#skyDomeGrad)"
              stroke="var(--border-strong)"
              strokeWidth={1.5}
            />

            {elevationRings.map((el) => {
              const [, ry] = polarToCartesian(0, el);
              const r = Math.abs(cy - ry);
              const isZeroHorizon = el === 0;
              return (
                <g key={el}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={isZeroHorizon ? 'var(--border-strong)' : 'var(--border-subtle)'}
                    strokeWidth={isZeroHorizon ? 1.3 : 0.9}
                    strokeDasharray={isZeroHorizon ? '4 3' : '2 3'}
                  />
                  <text
                    x={cx + 4}
                    y={cy - r + 9}
                    fill={isZeroHorizon ? 'var(--text-secondary)' : 'var(--text-muted)'}
                    fontSize={8.5}
                  >
                    {el > 0 ? `+${el}°` : `${el}°`}
                  </text>
                </g>
              );
            })}

            {[0, 45, 90, 135, 180, 225, 270, 315].map((az) => {
              const rad = (az * Math.PI) / 180;
              const x2 = cx + outerRadius * Math.sin(rad);
              const y2 = cy - outerRadius * Math.cos(rad);
              return (
                <line
                  key={az}
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2}
                  stroke="var(--border-subtle)"
                  strokeWidth={0.8}
                />
              );
            })}

            <path
              d={horizonMaskPath}
              fill="#64748B"
              fillOpacity={0.35}
              fillRule="evenodd"
            />

            <polygon
              points={horizonSkylinePoints}
              fill="none"
              stroke="#64748B"
              strokeWidth={1.6}
            />

            <polygon
              points={commsMarginPoints}
              fill="none"
              stroke="#0284C7"
              strokeWidth={0.9}
              strokeDasharray="2 3"
              strokeOpacity={0.65}
            />

            <polyline
              points={sunTrackPoints}
              fill="none"
              stroke="#D97706"
              strokeWidth={1.8}
              strokeOpacity={0.85}
            />

            <polyline
              points={earthTrackPoints}
              fill="none"
              stroke="#0284C7"
              strokeWidth={1.8}
              strokeOpacity={0.85}
            />

            {/* Hover Preview Ghost Marker */}
            {hoveredStep && (
              <circle
                cx={hoverSunX}
                cy={hoverSunY}
                r={5}
                fill="#FBBF24"
                fillOpacity={0.45}
                stroke="#B45309"
                strokeWidth={1.2}
              />
            )}

            <line
              x1={cx}
              y1={cy}
              x2={sunX}
              y2={sunY}
              stroke={currentStep?.sun_visible ? '#D97706' : '#E11D48'}
              strokeWidth={1.1}
              strokeDasharray={currentStep?.sun_visible ? 'none' : '3 2'}
              strokeOpacity={0.75}
            />
            <line
              x1={cx}
              y1={cy}
              x2={earthX}
              y2={earthY}
              stroke={currentStep?.earth_visible ? '#0284C7' : '#E11D48'}
              strokeWidth={1.1}
              strokeDasharray={currentStep?.earth_visible ? 'none' : '3 2'}
              strokeOpacity={0.75}
            />

            <g transform={`translate(${earthX}, ${earthY})`} filter="url(#glowCyan)">
              <circle
                r={6.5}
                fill={currentStep?.earth_visible ? '#0284C7' : '#991B1B'}
                stroke={currentStep?.earth_visible ? '#38BDF8' : '#EF4444'}
                strokeWidth={1.8}
              />
              <circle r={2.3} fill="#E0F2FE" />
            </g>

            <g transform={`translate(${sunX}, ${sunY})`} filter="url(#glowGold)">
              <circle
                r={7.5}
                fill={currentStep?.sun_visible ? '#F59E0B' : '#991B1B'}
                stroke={currentStep?.sun_visible ? '#FEF3C7' : '#FCA5A5'}
                strokeWidth={1.8}
              />
            </g>

            <circle cx={cx} cy={cy} r={3} fill="#10B981" stroke="#052E16" strokeWidth={1} />

            <text
              x={cx}
              y={16}
              textAnchor="middle"
              fill="#0284C7"
              fontSize={10}
              fontWeight="bold"
            >
              0° N (EARTHWARD)
            </text>
            <text
              x={size - 12}
              y={cy + 3}
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize={10}
              fontWeight="bold"
            >
              90° E
            </text>
            <text
              x={cx}
              y={size - 8}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={10}
              fontWeight="bold"
            >
              180° S
            </text>
            <text
              x={12}
              y={cy + 3}
              textAnchor="start"
              fill="var(--text-muted)"
              fontSize={10}
              fontWeight="bold"
            >
              270° W
            </text>
          </svg>
        </div>

        {/* Legend & Instantaneous Readout Footer */}
        <div className="pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Sun: {currentStep?.sun_el.toFixed(2)}° vs Rim {currentStep?.sun_horizon_el.toFixed(2)}°
            </span>
            <span className="flex items-center gap-1.5 text-sky-300">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              Earth: {currentStep?.earth_el.toFixed(2)}° vs Rim {currentStep?.earth_horizon_el.toFixed(2)}°
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-500/50 border border-slate-500 inline-block" />
                Terrain Mask H(Az)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-amber-500 inline-block" />
                Sun Path
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-sky-500 inline-block" />
                Earth Libration
              </span>
            </div>
            {personaMode === 'educator' && (
              <span className="text-amber-300 flex items-center gap-1">
                <Eye className="w-3 h-3" /> Center = Higher Sky; Outer Edge = Blocked
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
);