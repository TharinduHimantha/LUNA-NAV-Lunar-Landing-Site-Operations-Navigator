import React, { useState, useRef, useEffect } from 'react';
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
  Satellite,
  ArrowLeftRight,
  TrendingUp,
  Check,
  Info,
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
  isLoading?: boolean;
}

const NAV_TABS: {
  id: WorkspaceViewMode;
  label: string;
  shortLabel: string;
  shortcut: string;
  icon: React.FC<{ className?: string }>;
  activeClass: string;
  description: string;
}[] = [
  {
    id: 'explorer',
    label: 'Mission Explorer',
    shortLabel: 'Explorer',
    shortcut: '1',
    icon: Satellite,
    activeClass: 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25',
    description: 'Single-site 3D terrain shadows, grazing sunlight & 360° polar radar',
  },
  {
    id: 'comparator',
    label: 'Site Comparator',
    shortLabel: 'Comparator',
    shortcut: '2',
    icon: ArrowLeftRight,
    activeClass: 'bg-sky-400 text-slate-950 shadow-sm shadow-sky-400/25',
    description: 'Synchronized side-by-side Scenario A vs B evaluation & delta matrix',
  },
  {
    id: 'trade_study',
    label: 'Launch Window',
    shortLabel: 'Trade Study',
    shortcut: '3',
    icon: TrendingUp,
    activeClass: 'bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-400/25',
    description: 'Launch slip schedule sensitivity & 4-scenario trade-off matrix',
  },
  {
    id: 'guide',
    label: 'Science Guide',
    shortLabel: 'Guide',
    shortcut: '4',
    icon: GraduationCap,
    activeClass: 'bg-indigo-400 text-slate-950 shadow-sm shadow-indigo-400/25',
    description: 'Interactive lunar south pole physics lessons & lab scenarios',
  },
];

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
  isLoading = false,
}) => {
  const [showHardwarePopover, setShowHardwarePopover] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [justPinned, setJustPinned] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [draftCustom, setDraftCustom] = useState<CustomSiteInput>(
    customSite || {
      name: 'Artemis Custom Ridge Alpha',
      lat_deg: -88.75,
      lon_deg: 145.0,
      elev_m: 2400,
      terrain_type: 'ridge',
    }
  );

  // Close hardware popover on outside click
  useEffect(() => {
    if (!showHardwarePopover) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowHardwarePopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHardwarePopover]);

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

  const handlePinClick = () => {
    onPinCurrentScenario();
    setJustPinned(true);
    window.setTimeout(() => setJustPinned(false), 1400);
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

  const arrayShortLabel =
    arrayType === 'vertical_cylindrical'
      ? '360° Mast'
      : arrayType === 'dual_axis_tracking'
      ? '2-Axis Gimbal'
      : 'Flat Deck';

  return (
    <>
      <header className="bg-[#080C14]/95 backdrop-blur-md border-b border-slate-800/90 sticky top-0 z-40 shadow-lg">
        {/* Primary Command Bar */}
        <div className="px-4 h-14 flex items-center justify-between gap-3 max-w-[1920px] mx-auto">
          {/* Left: Brand Identity & Ephemeris Engine Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 via-sky-500/15 to-slate-900 border border-amber-500/40 flex items-center justify-center">
              <Compass className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm md:text-base font-bold tracking-wider text-white font-mono">
                LUNA-NAV
              </span>
              <span
                className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/70 text-emerald-400 border border-emerald-700/40"
                title="Live planetary ephemeris engine & NASA LRO LOLA / Diviner / LROC datasets"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {ephemerisEngine === 'skyfield_de421'
                  ? 'JPL DE421 • LOLA 128PPD'
                  : 'IAU • LOLA 128PPD'}
              </span>
            </div>
          </div>

          {/* Center: 4-Tab Workspace Switcher */}
          <nav
            aria-label="Workspace Navigation"
            className="flex items-center rounded-xl bg-[#0F172A] p-1 border border-slate-800 shadow-inner overflow-x-auto"
          >
            {NAV_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = workspaceViewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeWorkspaceViewMode(tab.id)}
                  title={`${tab.description} (Shortcut: ${tab.shortcut})`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? `${tab.activeClass} font-bold`
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline">{tab.label}</span>
                  <span className="md:hidden">{tab.shortLabel}</span>
                  <kbd
                    className={`hidden 2xl:inline-block text-[10px] font-mono px-1 rounded ${
                      isActive
                        ? 'bg-black/20 text-slate-900'
                        : 'bg-slate-800/80 text-slate-500'
                    }`}
                  >
                    {tab.shortcut}
                  </kbd>
                </button>
              );
            })}
          </nav>

          {/* Right: Persona Mode & Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className="hidden sm:inline-flex rounded-lg bg-[#0F172A] p-0.5 border border-slate-800"
              title="Switch readout density between Flight Planner and Educator callouts"
            >
              <button
                type="button"
                onClick={() => onChangePersonaMode('engineering')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  personaMode === 'engineering'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-3 h-3" />
                <span>Planner</span>
              </button>
              <button
                type="button"
                onClick={() => onChangePersonaMode('educator')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  personaMode === 'educator'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <GraduationCap className="w-3 h-3" />
                <span>Educator</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onOpenTutorial}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 transition"
              title="Launch Interactive Guided Mission Tour"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Tour</span>
            </button>

            <button
              type="button"
              onClick={onOpenManual}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Open Mission Operations & Engineering Reference Manual"
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden lg:inline">Ops Manual</span>
            </button>
          </div>
        </div>

        {/* Secondary Scenario Parameter Bar (Hidden in Science Guide Tab) */}
        {workspaceViewMode !== 'guide' && (
          <div className="bg-[#0B0F19]/90 border-t border-slate-800/70 px-4 py-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 max-w-[1920px] mx-auto">
              <div className="flex flex-wrap items-center gap-2">
                {/* Landing Site Selector */}
                <div className="flex items-center gap-1.5 bg-[#0F172A] border border-slate-700/80 rounded-lg px-2.5 py-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <label
                    htmlFor="site-select"
                    className="text-[11px] uppercase tracking-wider text-slate-400 font-mono"
                  >
                    {workspaceViewMode === 'comparator' ? 'Site A:' : 'Target Site:'}
                  </label>
                  <select
                    id="site-select"
                    value={selectedSiteId}
                    onChange={handleSiteSelectChange}
                    className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#0F172A] text-white">
                        {s.name} ({s.lat_deg > 0 ? `+${s.lat_deg}°` : `${s.lat_deg}°`},{' '}
                        {s.elev_m >= 0 ? `+${s.elev_m}m` : `${s.elev_m}m`})
                      </option>
                    ))}
                    <option value="custom" className="bg-[#0F172A] text-amber-300 font-semibold">
                      + Custom Coordinates / South Pole Map...
                    </option>
                  </select>
                  {selectedSiteId === 'custom' && (
                    <button
                      type="button"
                      onClick={() => setShowCustomModal(true)}
                      className="text-[11px] font-mono text-amber-400 hover:text-amber-300 underline ml-1"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {/* Target Landing UTC Date */}
                <div className="flex items-center gap-1.5 bg-[#0F172A] border border-slate-700/80 rounded-lg px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <label
                    htmlFor="start-date"
                    className="text-[11px] uppercase tracking-wider text-slate-400 font-mono"
                  >
                    Landing UTC:
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDateStr}
                    onChange={(e) => onChangeStartDate(e.target.value)}
                    className="bg-transparent text-xs font-mono text-white focus:outline-none cursor-pointer"
                  />
                </div>

                {/* Mission Duration Pills */}
                <div className="flex items-center bg-[#0F172A] border border-slate-700/80 rounded-lg p-0.5">
                  {[
                    { label: '14d', days: 14 },
                    { label: '30d', days: 30 },
                    { label: '60d', days: 60 },
                  ].map((opt) => (
                    <button
                      key={opt.days}
                      type="button"
                      onClick={() => onChangeDuration(opt.days)}
                      title={opt.days === 30 ? '1 Full Lunar Synodic Day (29.5d)' : `${opt.days}-day mission window`}
                      className={`px-2 py-0.5 rounded text-xs font-mono transition ${
                        durationDays === opt.days
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Lander Hardware & Comms Popover */}
                <div className="relative" ref={popoverRef}>
                  <button
                    type="button"
                    onClick={() => setShowHardwarePopover((prev) => !prev)}
                    className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs transition ${
                      showHardwarePopover
                        ? 'bg-slate-800 border-emerald-500/50 text-white'
                        : 'bg-[#0F172A] hover:bg-slate-800/80 border-slate-700/80 text-slate-200'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-slate-400 hidden sm:inline">Hardware:</span>
                    <span className="font-mono font-semibold text-emerald-300">
                      {arrayShortLabel} • {arrayAreaM2}m² • {commsMarginDeg.toFixed(1)}°
                    </span>
                  </button>

                  {showHardwarePopover && (
                    <div className="absolute left-0 mt-2 w-80 bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl p-4 z-50">
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                          Lander Power &amp; Comms Config
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowHardwarePopover(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3.5 text-xs">
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">
                            Solar Array Geometry
                          </label>
                          <select
                            value={arrayType}
                            onChange={(e) => onChangeArrayType(e.target.value as SolarArrayType)}
                            className="w-full bg-[#080C14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                          >
                            <option value="vertical_cylindrical">
                              Vertical Cylindrical Mast (360° Polar Optimal)
                            </option>
                            <option value="dual_axis_tracking">
                              Dual-Axis Sun-Tracking Gimbal (η = 1.0)
                            </option>
                            <option value="horizontal_deck">
                              Horizontal Flat Deck (Equatorial Classic)
                            </option>
                          </select>
                        </div>

                        <div>
                          <div className="flex justify-between text-slate-300 mb-1">
                            <span>GaAs Array Area (28% eff):</span>
                            <span className="font-mono text-amber-400 font-semibold">{arrayAreaM2} m²</span>
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
                          <div className="flex justify-between text-slate-300 mb-1">
                            <span className="flex items-center gap-1">
                              DTE Antenna Margin:
                              <span title="Minimum elevation above local terrain ridge required for noise-free Direct-to-Earth S/Ka-band lock">
                                <Info className="w-3 h-3 text-slate-500" />
                              </span>
                            </span>
                            <span className="font-mono text-sky-400 font-semibold">
                              {commsMarginDeg.toFixed(1)}°
                            </span>
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

              {/* Right: Sync Status & Pin to Trade Study */}
              <div className="flex items-center gap-2.5">
                {isLoading && (
                  <span className="text-[11px] font-mono text-sky-400 animate-pulse">
                    Computing Ephemeris...
                  </span>
                )}
                <button
                  type="button"
                  onClick={handlePinClick}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-semibold border transition ${
                    justPinned
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-500/40'
                  }`}
                >
                  {justPinned ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Pinned ({pinnedCount}/4)</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Pin to Matrix ({pinnedCount}/4)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Custom Coordinates Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                  Custom Coordinates &amp; LOLA 128×128 Extractor
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplyCustomSite} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="flex flex-col items-center bg-[#080C14] p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 mb-2">
                    Click South Pole Map (80°S–90°S)
                  </span>
                  <svg
                    width={170}
                    height={170}
                    viewBox="0 0 170 170"
                    onClick={handlePolarMapClick}
                    className="cursor-crosshair rounded-full border border-slate-700 bg-slate-950"
                  >
                    <circle cx={85} cy={85} r={74} fill="none" stroke="#1E293B" strokeDasharray="3 3" />
                    <circle cx={85} cy={85} r={50} fill="none" stroke="#1E293B" strokeDasharray="3 3" />
                    <circle cx={85} cy={85} r={25} fill="none" stroke="#1E293B" strokeDasharray="3 3" />
                    <line x1={85} y1={5} x2={85} y2={165} stroke="#1E293B" />
                    <line x1={5} y1={85} x2={165} y2={85} stroke="#1E293B" />
                    <text x={85} y={14} textAnchor="middle" fill="#38BDF8" fontSize={9}>
                      0° (Earth)
                    </text>
                    <text x={154} y={88} textAnchor="middle" fill="#9CA3AF" fontSize={8}>
                      90°E
                    </text>
                    <text x={85} y={163} textAnchor="middle" fill="#9CA3AF" fontSize={8}>
                      180°
                    </text>
                    <text x={18} y={88} textAnchor="middle" fill="#9CA3AF" fontSize={8}>
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
                    <label className="block text-slate-400 mb-1">Site Designation:</label>
                    <input
                      type="text"
                      value={draftCustom.name || ''}
                      onChange={(e) => setDraftCustom({ ...draftCustom, name: e.target.value })}
                      className="w-full bg-[#080C14] border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Latitude (°):</label>
                      <input
                        type="number"
                        step="0.01"
                        min={-90}
                        max={90}
                        value={draftCustom.lat_deg}
                        onChange={(e) =>
                          setDraftCustom({ ...draftCustom, lat_deg: Number(e.target.value) })
                        }
                        className="w-full bg-[#080C14] border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Longitude (°):</label>
                      <input
                        type="number"
                        step="0.01"
                        min={-180}
                        max={360}
                        value={draftCustom.lon_deg}
                        onChange={(e) =>
                          setDraftCustom({ ...draftCustom, lon_deg: Number(e.target.value) })
                        }
                        className="w-full bg-[#080C14] border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Elevation (m):</label>
                      <input
                        type="number"
                        step="50"
                        min={-6000}
                        max={8000}
                        value={draftCustom.elev_m}
                        onChange={(e) =>
                          setDraftCustom({ ...draftCustom, elev_m: Number(e.target.value) })
                        }
                        className="w-full bg-[#080C14] border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Morphology:</label>
                      <select
                        value={draftCustom.terrain_type}
                        onChange={(e) =>
                          setDraftCustom({ ...draftCustom, terrain_type: e.target.value })
                        }
                        className="w-full bg-[#080C14] border border-slate-700 rounded px-2 py-1.5 text-white"
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

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
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