import React, { useState } from 'react';
import {
  Compass,
  Calendar,
  Sliders,
  GraduationCap,
  Wrench,
  MapPin,
  PlusCircle,
  BookOpen,
  Sparkles,
  X,
  Columns,
  Maximize2,
} from 'lucide-react';
import type {
  LunarSite,
  SolarArrayType,
  PersonaMode,
  CustomSiteInput,
  WorkspaceViewMode,
} from '../types/mission';

interface HeaderBarProps {
  sites: LunarSite[];
  selectedSiteId: string;
  customSite: CustomSiteInput | null;
  onSelectSite: (siteId: string, custom?: CustomSiteInput | null) => void;
  startDateStr: string;
  onChangeStartDate: (dateStr: string) => void;
  durationDays: number;
  onChangeDuration: (days: number) => void;
  arrayType: SolarArrayType;
  onChangeArrayType: (t: SolarArrayType) => void;
  arrayAreaM2: number;
  onChangeArrayArea: (area: number) => void;
  commsMarginDeg: number;
  onChangeCommsMargin: (margin: number) => void;
  personaMode: PersonaMode;
  onChangePersonaMode: (mode: PersonaMode) => void;
  workspaceViewMode: WorkspaceViewMode;
  onChangeWorkspaceViewMode: (mode: WorkspaceViewMode) => void;
  onPinCurrentScenario: () => void;
  pinnedCount: number;
  onOpenTutorial: () => void;
  onOpenManual: () => void;
  ephemerisEngine: string;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  sites,
  selectedSiteId,
  customSite,
  onSelectSite,
  startDateStr,
  onChangeStartDate,
  durationDays,
  onChangeDuration,
  arrayType,
  onChangeArrayType,
  arrayAreaM2,
  onChangeArrayArea,
  commsMarginDeg,
  onChangeCommsMargin,
  personaMode,
  onChangePersonaMode,
  workspaceViewMode,
  onChangeWorkspaceViewMode,
  onPinCurrentScenario,
  pinnedCount,
  onOpenTutorial,
  onOpenManual,
  ephemerisEngine,
}) => {
  const [showHardwarePopover, setShowHardwarePopover] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const [draftCustom, setDraftCustom] = useState<CustomSiteInput>(
    customSite || {
      name: 'Artemis Custom Ridge Alpha',
      lat_deg: -88.75,
      lon_deg: 145.0,
      elev_m: 2400,
      terrain_type: 'ridge',
    }
  );

  const handleSiteSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setShowCustomModal(true);
    } else {
      onSelectSite(val, null);
    }
  };

  const handleApplyCustomSite = (e: React.FormEvent) => {
    e.preventDefault();
    onSelectSite('custom', draftCustom);
    setShowCustomModal(false);
  };

  const handlePolarMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = e.clientX - rect.left - cx;
    const dy = cy - (e.clientY - rect.top);
    const maxR = cx * 0.88;
    const r = Math.min(maxR, Math.hypot(dx, dy));
    const lat = Number((-90 + (r / maxR) * 10).toFixed(2));
    const lon = Number((((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360).toFixed(2));
    setDraftCustom((prev) => ({
      ...prev,
      lat_deg: lat,
      lon_deg: lon,
      name: `South Pole (${lat}°, ${lon}°)`,
    }));
  };

  return (
    <>
      <header className="bg-[#0B0F19] border-b border-gray-800 px-4 py-2.5 sticky top-0 z-40 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand Title & Status */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 via-sky-500/20 to-indigo-900/40 border border-amber-500/40 flex items-center justify-center shadow-inner">
              <Compass className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold tracking-wider text-white font-mono">
                  LUNA-NAV <span className="text-amber-400 font-normal">//</span>{' '}
                  <span className="text-gray-300 font-sans font-semibold text-xs md:text-sm">
                    Lunar Landing Site & Dataset Comparator
                  </span>
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                  {ephemerisEngine === 'skyfield_de421'
                    ? 'DE421 + LOLA 128ppd + DIVINER + LROC'
                    : 'IAU + LOLA 128ppd + DIVINER + LROC'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                2026 NASA Space Apps Challenge • Phase 2 Real Planetary Datasets & Split-Screen Trade-Off UX
              </p>
            </div>
          </div>

          {/* Primary Workspace Mode Toggle (Split-Screen Compare vs Single-Site Deep Dive) & Persona */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Comparison-First UX Toggle */}
            <div className="inline-flex rounded-lg bg-[#111827] p-0.5 border border-amber-500/40">
              <button
                type="button"
                onClick={() => onChangeWorkspaceViewMode('compare')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all ${
                  workspaceViewMode === 'compare'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                Split-Screen Compare (A vs B)
              </button>
              <button
                type="button"
                onClick={() => onChangeWorkspaceViewMode('single')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all ${
                  workspaceViewMode === 'single'
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Single-Site Deep Dive
              </button>
            </div>

            {/* Persona Mode Toggle */}
            <div className="inline-flex rounded-lg bg-[#111827] p-0.5 border border-gray-800">
              <button
                type="button"
                onClick={() => onChangePersonaMode('engineering')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  personaMode === 'engineering'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Planner</span>
              </button>
              <button
                type="button"
                onClick={() => onChangePersonaMode('educator')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  personaMode === 'educator'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Educator</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenTutorial}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition"
              title="Launch Interactive Step-by-Step Mission Tutorial"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tutorial</span>
            </button>

            <button
              type="button"
              onClick={onOpenManual}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-800/80 hover:bg-gray-700 text-gray-200 border border-gray-700 transition"
              title="Open User, Operations & Technical Engineering Manual"
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Ops & Tech Guide</span>
            </button>
          </div>
        </div>

        {/* Bottom Scenario Control Bar */}
        <div className="mt-2.5 pt-2 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Landing Site Selector */}
            <div className="flex items-center gap-1.5 bg-[#111827] border border-gray-700/80 rounded-lg px-2.5 py-1">
              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <label htmlFor="site-select" className="text-[11px] uppercase tracking-wider text-gray-400 font-mono">
                {workspaceViewMode === 'compare' ? 'Primary (A):' : 'Site:'}
              </label>
              <select
                id="site-select"
                value={selectedSiteId}
                onChange={handleSiteSelectChange}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#111827] text-white">
                    {s.name} ({s.lat_deg > 0 ? `+${s.lat_deg}°` : `${s.lat_deg}°`}, {s.elev_m >= 0 ? `+${s.elev_m}m` : `${s.elev_m}m`})
                  </option>
                ))}
                <option value="custom" className="bg-[#111827] text-amber-300 font-semibold">
                  + Custom Coordinates / Polar Map Picker...
                </option>
              </select>
              {selectedSiteId === 'custom' && (
                <button
                  type="button"
                  onClick={() => setShowCustomModal(true)}
                  className="text-[11px] font-mono text-amber-400 underline ml-1"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Target Landing Date Picker */}
            <div className="flex items-center gap-1.5 bg-[#111827] border border-gray-700/80 rounded-lg px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <label htmlFor="start-date" className="text-[11px] uppercase tracking-wider text-gray-400 font-mono">
                Base UTC:
              </label>
              <input
                id="start-date"
                type="date"
                value={startDateStr}
                onChange={(e) => onChangeStartDate(e.target.value)}
                className="bg-transparent text-xs font-mono text-white focus:outline-none cursor-pointer"
              />
            </div>

            {/* Mission Duration Selector */}
            <div className="flex items-center bg-[#111827] border border-gray-700/80 rounded-lg p-0.5">
              {[
                { label: '14d', days: 14 },
                { label: '30d (1 Lunar Day)', days: 30 },
                { label: '60d', days: 60 },
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => onChangeDuration(opt.days)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition ${
                    durationDays === opt.days
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Hardware Config Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHardwarePopover((prev) => !prev)}
                className="flex items-center gap-1.5 bg-[#111827] hover:bg-gray-800 border border-gray-700/80 rounded-lg px-2.5 py-1 text-xs text-gray-200 transition"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Hardware:{' '}
                  <strong className="font-mono text-emerald-300">
                    {arrayType === 'vertical_cylindrical'
                      ? 'Vertical 360° Mast'
                      : arrayType === 'dual_axis_tracking'
                      ? 'Dual-Axis Gimbal'
                      : 'Flat Deck'}
                  </strong>{' '}
                  ({arrayAreaM2}m² | {commsMarginDeg}° DTE)
                </span>
              </button>

              {showHardwarePopover && (
                <div className="absolute left-0 mt-2 w-80 bg-[#111827] border border-gray-700 rounded-xl shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
                      Lander Power & Antenna Config
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowHardwarePopover(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-gray-400 mb-1 font-medium">
                        Solar Array Geometry:
                      </label>
                      <select
                        value={arrayType}
                        onChange={(e) => onChangeArrayType(e.target.value as SolarArrayType)}
                        className="w-full bg-[#0B0F19] border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                      >
                        <option value="vertical_cylindrical">
                          Vertical Cylindrical Mast (360° Polar Optimal, cos El)
                        </option>
                        <option value="dual_axis_tracking">
                          Dual-Axis Sun-Tracking Gimbal (η_inc = 1.0)
                        </option>
                        <option value="horizontal_deck">
                          Horizontal Flat Deck (Equatorial Classic, sin El)
                        </option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-300 mb-1">
                        <span>Solar Array Area (GaAs 28% eff):</span>
                        <span className="font-mono text-amber-400">{arrayAreaM2} m²</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={60}
                        step={1}
                        value={arrayAreaM2}
                        onChange={(e) => onChangeArrayArea(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-gray-300 mb-1">
                        <span>DTE Antenna Clearance Margin:</span>
                        <span className="font-mono text-sky-400">{commsMarginDeg.toFixed(1)}°</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={0.2}
                        value={commsMarginDeg}
                        onChange={(e) => onChangeCommsMargin(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pin Scenario for Multi-Site Comparison */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPinCurrentScenario}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Pin to 4-Site Matrix ({pinnedCount}/4)
            </button>
          </div>
        </div>
      </header>

      {/* Custom Coordinates Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-gray-700 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  Custom Selenographic Coordinates & LOLA 128×128 Extractor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyCustomSite} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="flex flex-col items-center bg-[#0B0F19] p-3 rounded-lg border border-gray-800">
                  <span className="text-[11px] font-mono text-gray-400 mb-2">
                    Click South Pole Map (80°S–90°S)
                  </span>
                  <svg
                    width={170}
                    height={170}
                    viewBox="0 0 170 170"
                    onClick={handlePolarMapClick}
                    className="cursor-crosshair rounded-full border border-gray-700 bg-slate-950"
                  >
                    <circle cx={85} cy={85} r={74} fill="none" stroke="#1E293B" strokeDasharray="3 3" />
                    <circle cx={85} cy={85} r={50} fill="none" stroke="#1E293B" strokeDasharray="3 3" />
                    <circle cx={85} cy={85} r={25} fill="none" stroke="#1E293B" strokeDasharray="3 3" />
                    <line x1={85} y1={5} x2={85} y2={165} stroke="#1E293B" />
                    <line x1={5} y1={85} x2={165} y2={85} stroke="#1E293B" />
                    <text x={85} y={14} textAnchor="middle" fill="#38BDF8" fontSize={9} fontFamily="monospace">
                      0° (Earth)
                    </text>
                    <text x={154} y={88} textAnchor="middle" fill="#9CA3AF" fontSize={8} fontFamily="monospace">
                      90°E
                    </text>
                    <text x={85} y={163} textAnchor="middle" fill="#9CA3AF" fontSize={8} fontFamily="monospace">
                      180°
                    </text>
                    <text x={18} y={88} textAnchor="middle" fill="#9CA3AF" fontSize={8} fontFamily="monospace">
                      270°W
                    </text>
                    {(() => {
                      const rNorm = Math.min(1, Math.max(0, (90 - Math.abs(draftCustom.lat_deg)) / 10));
                      const rPx = rNorm * 74;
                      const rad = (draftCustom.lon_deg * Math.PI) / 180;
                      const px = 85 + rPx * Math.sin(rad);
                      const py = 85 - rPx * Math.cos(rad);
                      return (
                        <g>
                          <circle cx={px} cy={py} r={5} fill="#F59E0B" stroke="#FFF" strokeWidth={1.5} />
                          <circle cx={px} cy={py} r={10} fill="none" stroke="#F59E0B" strokeOpacity={0.5} />
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-gray-400 mb-1">Site Designation:</label>
                    <input
                      type="text"
                      value={draftCustom.name || ''}
                      onChange={(e) => setDraftCustom({ ...draftCustom, name: e.target.value })}
                      className="w-full bg-[#0B0F19] border border-gray-700 rounded px-2.5 py-1.5 text-white font-mono"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-400 mb-1">Latitude (°):</label>
                      <input
                        type="number"
                        step="0.01"
                        min={-90}
                        max={90}
                        value={draftCustom.lat_deg}
                        onChange={(e) =>
                          setDraftCustom({ ...draftCustom, lat_deg: Number(e.target.value) })
                        }
                        className="w-full bg-[#0B0F19] border border-gray-700 rounded px-2 py-1.5 text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Longitude (°):</label>
                      <input
                        type="number"
                        step="0.01"
                        min={-180}
                        max={360}
                        value={draftCustom.lon_deg}
                        onChange={(e) =>
                          setDraftCustom({ ...draftCustom, lon_deg: Number(e.target.value) })
                        }
                        className="w-full bg-[#0B0F19] border border-gray-700 rounded px-2 py-1.5 text-white font-mono"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-400 mb-1">Elevation (m):</label>
                      <input
                        type="number"
                        step="50"
                        min={-6000}
                        max={8000}
                        value={draftCustom.elev_m}
                        onChange={(e) =>
                          setDraftCustom({ ...draftCustom, elev_m: Number(e.target.value) })
                        }
                        className="w-full bg-[#0B0F19] border border-gray-700 rounded px-2 py-1.5 text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Morphology:</label>
                      <select
                        value={draftCustom.terrain_type}
                        onChange={(e) =>
                          setDraftCustom({ ...draftCustom, terrain_type: e.target.value })
                        }
                        className="w-full bg-[#0B0F19] border border-gray-700 rounded px-2 py-1.5 text-white"
                      >
                        <option value="ridge">Connecting Ridge</option>
                        <option value="massif">Mountain Massif</option>
                        <option value="plateau">Elevated Plateau</option>
                        <option value="crater_rim">Scalloped Crater Rim</option>
                        <option value="basin">PSR Crater Basin</option>
                        <option value="mare_flat">Flat Mare Plain</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition"
                >
                  Extract 128×128 DEM &amp; Evaluate Ephemeris
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
