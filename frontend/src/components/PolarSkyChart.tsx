import React, { useMemo } from 'react';
import { Compass, Sun, Radio, Eye } from 'lucide-react';
import type { HorizonPoint, TimelineStep, PersonaMode } from '../types/mission';

interface PolarSkyChartProps {
  horizonProfile: HorizonPoint[];
  timeline: TimelineStep[];
  currentStepIndex: number;
  latDeg: number;
  commsMarginDeg: number;
  personaMode: PersonaMode;
  onSelectStep?: (idx: number) => void;
}

export const PolarSkyChart: React.FC<PolarSkyChartProps> = ({
  horizonProfile,
  timeline,
  currentStepIndex,
  latDeg,
  commsMarginDeg,
  personaMode,
}) => {
  const isEquatorial = Math.abs(latDeg) < 45;

  // For South Pole grazing sites, zoom radial axis to [-6° .. +14°] so 1.5° grazing sun & crater rims are crystal clear!
  // For Equatorial sites (e.g. Apollo 11), scale radial axis to [-10° .. +90°] zenith.
  const minEl = isEquatorial ? -10 : -5;
  const maxEl = isEquatorial ? 90 : 14;

  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = 142;

  // Map (azimuth_deg, elevation_deg) to SVG (x, y)
  // Note: Higher elevation is closer to center (zenith/inner ring); lower elevation is near outer edge.
  const polarToCartesian = (azDeg: number, elDeg: number): [number, number] => {
    const clampedEl = Math.max(minEl, Math.min(maxEl, elDeg));
    const norm = ( maxEl - clampedEl ) / ( maxEl - minEl ); // 0 at maxEl (center), 1 at minEl (outer edge)
    const r = 18 + norm * (outerRadius - 18);
    const rad = (azDeg * Math.PI) / 180;
    const x = cx + r * Math.sin(rad);
    const y = cy - r * Math.cos(rad);
    return [x, y];
  };

  // Build 360° Terrain Horizon Occlusion Annulus Path (from outer rim minEl inward to H(Az))
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

  // Horizon ridge skyline polyline
  const horizonSkylinePoints = useMemo(() => {
    return horizonProfile
      .map((pt) => {
        const [x, y] = polarToCartesian(pt.azimuth, pt.elevation_deg);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [horizonProfile, minEl, maxEl]);

  // Antenna DTE clearance margin skyline (H(Az) + commsMarginDeg)
  const commsMarginPoints = useMemo(() => {
    return horizonProfile
      .map((pt) => {
        const [x, y] = polarToCartesian(pt.azimuth, pt.elevation_deg + commsMarginDeg);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [horizonProfile, commsMarginDeg, minEl, maxEl]);

  // Sun trajectory path across mission window
  const sunTrackPoints = useMemo(() => {
    return timeline
      .map((step) => {
        const [x, y] = polarToCartesian(step.sun_az, step.sun_el);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [timeline, minEl, maxEl]);

  // Earth libration loop path across mission window
  const earthTrackPoints = useMemo(() => {
    return timeline
      .map((step) => {
        const [x, y] = polarToCartesian(step.earth_az, step.earth_el);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [timeline, minEl, maxEl]);

  const currentStep = timeline[currentStepIndex] || timeline[0];
  const [sunX, sunY] = currentStep
    ? polarToCartesian(currentStep.sun_az, currentStep.sun_el)
    : [cx, cy];
  const [earthX, earthY] = currentStep
    ? polarToCartesian(currentStep.earth_az, currentStep.earth_el)
    : [cx, cy];

  const elevationRings = isEquatorial ? [0, 30, 60] : [-2, 0, 2, 5, 10];

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-3.5 flex flex-col justify-between h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-400" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              360° Polar Azimuthal Horizon Radar
            </h2>
            <p className="text-[11px] text-gray-400">
              {isEquatorial
                ? 'Equatorial Zenith Projection (-10° to +90° El)'
                : 'High-Precision Polar Grazing Horizon Zoom (-5° to +14° El)'}
            </p>
          </div>
        </div>
        <span className="px-2 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-gray-300 border border-gray-700">
          LOLA 1° Ray-Cast
        </span>
      </div>

      {/* SVG Radar Plot */}
      <div className="relative flex-1 flex items-center justify-center my-1">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[330px] h-auto select-none"
        >
          <defs>
            <radialGradient id="skyDomeGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="80%" stopColor="#090D16" />
              <stop offset="100%" stopColor="#050811" />
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

          {/* Background Sky Circle */}
          <circle
            cx={cx}
            cy={cy}
            r={outerRadius}
            fill="url(#skyDomeGrad)"
            stroke="#1F2937"
            strokeWidth={1.5}
          />

          {/* Elevation Reference Rings */}
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
                  stroke={isZeroHorizon ? '#4B5563' : '#1E293B'}
                  strokeWidth={isZeroHorizon ? 1.3 : 0.9}
                  strokeDasharray={isZeroHorizon ? '4 3' : '2 3'}
                />
                <text
                  x={cx + 4}
                  y={cy - r + 9}
                  fill={isZeroHorizon ? '#9CA3AF' : '#64748B'}
                  fontSize={8}
                  fontFamily="monospace"
                >
                  {el > 0 ? `+${el}°` : `${el}°`}
                </text>
              </g>
            );
          })}

          {/* Azimuthal Spokes (every 45°) */}
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
                stroke="#1E293B"
                strokeWidth={0.8}
              />
            );
          })}

          {/* 360° Terrain Horizon Mask Polygon (Occluded Terrain Wall) */}
          <path
            d={horizonMaskPath}
            fill="#1E293B"
            fillOpacity={0.78}
            fillRule="evenodd"
          />

          {/* Terrain Horizon Ridge Line H(Az) */}
          <polygon
            points={horizonSkylinePoints}
            fill="none"
            stroke="#64748B"
            strokeWidth={1.6}
          />

          {/* DTE Antenna Clearance Margin Ring (H(Az) + margin) */}
          <polygon
            points={commsMarginPoints}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={0.9}
            strokeDasharray="2 3"
            strokeOpacity={0.55}
          />

          {/* Sun Mission Trajectory Path */}
          <polyline
            points={sunTrackPoints}
            fill="none"
            stroke="#F59E0B"
            strokeWidth={1.6}
            strokeOpacity={0.75}
          />

          {/* Earth Libration Loop Path */}
          <polyline
            points={earthTrackPoints}
            fill="none"
            stroke="#38BDF8"
            strokeWidth={1.8}
            strokeOpacity={0.85}
          />

          {/* Ray from Lander Center to Active Sun & Earth */}
          <line
            x1={cx}
            y1={cy}
            x2={sunX}
            y2={sunY}
            stroke={currentStep?.sun_visible ? '#F59E0B' : '#EF4444'}
            strokeWidth={1.1}
            strokeDasharray={currentStep?.sun_visible ? 'none' : '3 2'}
            strokeOpacity={0.7}
          />
          <line
            x1={cx}
            y1={cy}
            x2={earthX}
            y2={earthY}
            stroke={currentStep?.earth_visible ? '#38BDF8' : '#EF4444'}
            strokeWidth={1.1}
            strokeDasharray={currentStep?.earth_visible ? 'none' : '3 2'}
            strokeOpacity={0.7}
          />

          {/* Active Earth Libration Marker */}
          <g transform={`translate(${earthX}, ${earthY})`} filter="url(#glowCyan)">
            <circle
              r={6.5}
              fill={currentStep?.earth_visible ? '#0284C7' : '#7F1D1D'}
              stroke={currentStep?.earth_visible ? '#38BDF8' : '#EF4444'}
              strokeWidth={1.8}
            />
            <circle r={2.3} fill="#E0F2FE" />
          </g>

          {/* Active Sun Marker */}
          <g transform={`translate(${sunX}, ${sunY})`} filter="url(#glowGold)">
            <circle
              r={7.5}
              fill={currentStep?.sun_visible ? '#F59E0B' : '#991B1B'}
              stroke={currentStep?.sun_visible ? '#FEF3C7' : '#FCA5A5'}
              strokeWidth={1.8}
            />
          </g>

          {/* Center Lander Crosshair */}
          <circle cx={cx} cy={cy} r={3} fill="#10B981" stroke="#052E16" strokeWidth={1} />

          {/* Perimeter Compass Labels */}
          <text
            x={cx}
            y={16}
            textAnchor="middle"
            fill="#38BDF8"
            fontSize={10}
            fontWeight="bold"
            fontFamily="monospace"
          >
            0° N (EARTHWARD)
          </text>
          <text
            x={size - 12}
            y={cy + 3}
            textAnchor="end"
            fill="#9CA3AF"
            fontSize={10}
            fontWeight="bold"
            fontFamily="monospace"
          >
            90° E
          </text>
          <text
            x={cx}
            y={size - 8}
            textAnchor="middle"
            fill="#9CA3AF"
            fontSize={10}
            fontWeight="bold"
            fontFamily="monospace"
          >
            180° S
          </text>
          <text
            x={12}
            y={cy + 3}
            textAnchor="start"
            fill="#9CA3AF"
            fontSize={10}
            fontWeight="bold"
            fontFamily="monospace"
          >
            270° W
          </text>
        </svg>
      </div>

      {/* Legend & Instantaneous Readout Footer */}
      <div className="pt-2 border-t border-gray-800 space-y-1.5 text-[11px]">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
          <span className="flex items-center gap-1.5 text-amber-300">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            Sun: El {currentStep?.sun_el.toFixed(2)}° vs Rim {currentStep?.sun_horizon_el.toFixed(2)}°
          </span>
          <span className="flex items-center gap-1.5 text-sky-300">
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            Earth: El {currentStep?.earth_el.toFixed(2)}° vs Rim {currentStep?.earth_horizon_el.toFixed(2)}°
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[10px] text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 border border-slate-400 inline-block" />
              Terrain Mask H(Az)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-amber-400 inline-block" />
              360° Sun Path
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-sky-400 inline-block" />
              Earth Libration Loop
            </span>
          </div>
          {personaMode === 'educator' && (
            <span className="text-amber-300/90 flex items-center gap-1">
              <Eye className="w-3 h-3" /> Center = Higher Sky; Outer Edge = Occluded by Crater Walls
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
