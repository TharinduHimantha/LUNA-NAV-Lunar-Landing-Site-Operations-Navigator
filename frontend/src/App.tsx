import { useState, useEffect, useCallback } from 'react';
import type {
  LunarSite,
  SolarArrayType,
  PersonaMode,
  CustomSiteInput,
  MissionEvaluationResponse,
  LaunchSlipSweepPoint,
  PinnedScenario,
  EvaluateRequest,
  WorkspaceViewMode,
  DualScenarioComparisonResponse,
} from './types/mission';
import {
  fetchSites,
  evaluateMission,
  compareTwoScenarios,
  FALLBACK_SITES,
} from './api/client';
import { HeaderBar } from './components/HeaderBar';
import { TelemetryStrip } from './components/TelemetryStrip';
import { LunarTerrain3D } from './components/LunarTerrain3D';
import { PolarSkyChart } from './components/PolarSkyChart';
import { MissionTimelineDock } from './components/MissionTimelineDock';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import { ScenarioCompareDashboard } from './components/ScenarioCompareDashboard';
import {
  EducatorOverlay,
  InteractiveTutorialModal,
  OperationsManualModal,
} from './components/EducatorOverlay';
import {
  Info,
  ShieldAlert,
  CalendarClock,
  Sun,
  Moon,
  Radio,
  BatteryWarning,
  Compass,
  ArrowRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export function App() {
  const [sites, setSites] = useState<LunarSite[]>(FALLBACK_SITES);

  // Global Theme State ('dark' | 'light') synced with html.light in index.css
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem('luna-nav-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('luna-nav-theme', theme);
  }, [theme]);

  // Unified 4-Tab Workspace Navigation
  const [workspaceViewMode, setWorkspaceViewMode] = useState<WorkspaceViewMode>('explorer');

  // Primary Scenario A Controls
  const [selectedSiteId, setSelectedSiteId] = useState<string>('shackleton_ridge');
  const [customSite, setCustomSite] = useState<CustomSiteInput | null>(null);
  const [startDateStr, setStartDateStr] = useState<string>('2026-12-01');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [launchSlipDays, setLaunchSlipDays] = useState<number>(0);

  // Comparison Scenario B Controls
  const [siteBId, setSiteBId] = useState<string>('malapert_massif');
  const [slipBDays, setSlipBDays] = useState<number>(0);

  // Shared Hardware Controls
  const [arrayType, setArrayType] = useState<SolarArrayType>('vertical_cylindrical');
  const [arrayAreaM2, setArrayAreaM2] = useState<number>(12.0);
  const [commsMarginDeg, setCommsMarginDeg] = useState<number>(1.0);

  // Persona & Modals State
  const [personaMode, setPersonaMode] = useState<PersonaMode>('engineering');
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(false);
  const [manualOpen, setManualOpen] = useState<boolean>(false);

  // Evaluation & Dual Comparison State
  const [evaluation, setEvaluation] = useState<MissionEvaluationResponse | null>(null);
  const [dualComparison, setDualComparison] = useState<DualScenarioComparisonResponse | null>(null);
  const [slipSweep, setSlipSweep] = useState<LaunchSlipSweepPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Playback & Scrubber State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 5 | 20>(5);

  // Pinned Scenarios for 4-Site Trade-Off Matrix
  const [pinnedScenarios, setPinnedScenarios] = useState<PinnedScenario[]>([]);
  const [isLoadingPreset, setIsLoadingPreset] = useState<boolean>(false);

  useEffect(() => {
    fetchSites().then((list) => {
      if (list && list.length > 0) setSites(list);
    });
  }, []);

  // Evaluate Scenario A & Scenario B simultaneously
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    const stepHrs = durationDays > 30 ? 4.0 : 2.0;

    const reqA: EvaluateRequest = {
      site_id: selectedSiteId,
      custom_site: selectedSiteId === 'custom' ? customSite : null,
      start_datetime_utc: `${startDateStr}T00:00:00Z`,
      duration_days: durationDays,
      step_hours: stepHrs,
      launch_slip_days: launchSlipDays,
      array_type: arrayType,
      array_area_m2: arrayAreaM2,
      comms_margin_deg: commsMarginDeg,
      dem_grid_size: 128,
    };

    const reqB: EvaluateRequest = {
      site_id: siteBId,
      custom_site: null,
      start_datetime_utc: `${startDateStr}T00:00:00Z`,
      duration_days: durationDays,
      step_hours: stepHrs,
      launch_slip_days: slipBDays,
      array_type: arrayType,
      array_area_m2: arrayAreaM2,
      comms_margin_deg: commsMarginDeg,
      dem_grid_size: 128,
    };

    compareTwoScenarios(reqA, reqB)
      .then((compRes) => {
        if (!active) return;
        setDualComparison(compRes);
        setEvaluation(compRes.scenario_a);
        const maxSteps =
          workspaceViewMode === 'comparator'
            ? Math.min(compRes.scenario_a.timeline.length, compRes.scenario_b.timeline.length)
            : compRes.scenario_a.timeline.length;
        setCurrentStepIndex((prev) => Math.min(prev, Math.max(0, maxSteps - 1)));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    selectedSiteId,
    customSite,
    startDateStr,
    durationDays,
    launchSlipDays,
    siteBId,
    slipBDays,
    arrayType,
    arrayAreaM2,
    commsMarginDeg,
    workspaceViewMode,
  ]);

  useEffect(() => {
    setSlipSweep([]);
  }, [selectedSiteId, startDateStr]);

  // Synchronized timeline playback loop
  useEffect(() => {
    if (!isPlaying || !evaluation || workspaceViewMode === 'guide') return;
    const maxLen =
      workspaceViewMode === 'comparator' && dualComparison
        ? Math.min(evaluation.timeline.length, dualComparison.scenario_b.timeline.length)
        : evaluation.timeline.length;
    if (maxLen <= 1) return;

    const intervalMs = playbackSpeed === 20 ? 35 : playbackSpeed === 5 ? 90 : 220;
    const timer = window.setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1 >= maxLen ? 0 : prev + 1));
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, evaluation, dualComparison, workspaceViewMode]);

  // Global Keyboard Shortcuts (Space, Left/Right, R, 1-4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === '1') {
        setWorkspaceViewMode('explorer');
      } else if (e.key === '2') {
        setWorkspaceViewMode('comparator');
      } else if (e.key === '3') {
        setWorkspaceViewMode('trade_study');
      } else if (e.key === '4') {
        setWorkspaceViewMode('guide');
      } else if (e.code === 'Space' && workspaceViewMode !== 'guide') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowRight' && evaluation && workspaceViewMode !== 'guide') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStepIndex((prev) =>
          Math.min(evaluation.timeline.length - 1, prev + 1)
        );
      } else if (e.key === 'ArrowLeft' && workspaceViewMode !== 'guide') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStepIndex((prev) => Math.max(0, prev - 1));
      } else if ((e.key === 'r' || e.key === 'R') && workspaceViewMode !== 'guide') {
        setIsPlaying(false);
        setCurrentStepIndex(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [evaluation, workspaceViewMode]);

  const handleSelectSite = useCallback(
    (siteId: string, custom?: CustomSiteInput | null) => {
      setSelectedSiteId(siteId);
      if (custom !== undefined) {
        setCustomSite(custom);
      }
      setCurrentStepIndex(0);
    },
    []
  );

  const handleApplyDualPreset = useCallback(
    (newSiteA: string, newSlipA: number, newSiteB: string, newSlipB: number) => {
      setSelectedSiteId(newSiteA);
      setLaunchSlipDays(newSlipA);
      setSiteBId(newSiteB);
      setSlipBDays(newSlipB);
      setCurrentStepIndex(0);
    },
    []
  );

  const handlePinCurrentScenario = useCallback(() => {
    if (!evaluation) return;
    setPinnedScenarios((prev) => {
      const slipTag =
        launchSlipDays === 0
          ? 'Nominal'
          : launchSlipDays > 0
          ? `+${launchSlipDays}d Slip`
          : `${launchSlipDays}d Early`;
      const label = `${evaluation.site.name.split(' ')[0]} (${slipTag})`;
      const newEntry: PinnedScenario = {
        scenario_id: `${evaluation.site.id}_${Date.now()}`,
        label,
        evaluation,
      };
      return [...prev.slice(-3), newEntry];
    });
  }, [evaluation, launchSlipDays]);

  const handleLoadReferencePreset = useCallback(async () => {
    setIsLoadingPreset(true);
    try {
      const configs: { label: string; site_id: string; slip: number }[] = [
        { label: 'Shackleton (Nominal)', site_id: 'shackleton_ridge', slip: 0 },
        { label: 'Malapert Relay (Nominal)', site_id: 'malapert_massif', slip: 0 },
        { label: 'Nobile Rim (+8d Slip)', site_id: 'nobile_rim', slip: 8 },
        { label: 'Haworth Floor (PSR)', site_id: 'haworth_floor', slip: 0 },
      ];
      const evals = await Promise.all(
        configs.map(async (c) => {
          const ev = await evaluateMission({
            site_id: c.site_id,
            custom_site: null,
            start_datetime_utc: `${startDateStr}T00:00:00Z`,
            duration_days: durationDays,
            step_hours: 4.0,
            launch_slip_days: c.slip,
            array_type: arrayType,
            array_area_m2: arrayAreaM2,
            comms_margin_deg: commsMarginDeg,
            dem_grid_size: 64,
          });
          return {
            scenario_id: `preset_${c.site_id}_${c.slip}`,
            label: c.label,
            evaluation: ev,
          };
        })
      );
      setPinnedScenarios(evals);
    } finally {
      setIsLoadingPreset(false);
    }
  }, [startDateStr, durationDays, arrayType, arrayAreaM2, commsMarginDeg]);

  const handleTutorialStepAction = (stepIdx: number) => {
    if (stepIdx === 0) {
      setWorkspaceViewMode('comparator');
      setSelectedSiteId('shackleton_ridge');
      setSiteBId('malapert_massif');
      setLaunchSlipDays(0);
      setSlipBDays(0);
      setArrayType('vertical_cylindrical');
    } else if (stepIdx === 1) {
      setWorkspaceViewMode('explorer');
      setIsPlaying(true);
      setPlaybackSpeed(5);
    } else if (stepIdx === 2) {
      setIsPlaying(false);
      setArrayType((prev) =>
        prev === 'vertical_cylindrical' ? 'horizontal_deck' : 'vertical_cylindrical'
      );
    } else if (stepIdx === 3) {
      setWorkspaceViewMode('trade_study');
      handleLoadReferencePreset();
    }
  };

  if (!evaluation || !dualComparison) {
    return (
      <div className="min-h-screen bg-[#080C14] text-slate-200 flex flex-col items-center justify-center gap-3 font-mono text-sm">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span>
          Ingesting NASA LOLA 128×128 DEMs, LROC WAC Textures, Diviner Thermal Grids &amp; Ephemerides...
        </span>
      </div>
    );
  }

  const currentStep = evaluation.timeline[currentStepIndex] || evaluation.timeline[0];

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col">
      {/* Unified Aerospace Command Header */}
      <HeaderBar
        sites={sites}
        selectedSiteId={selectedSiteId}
        customSite={customSite}
        onSelectSite={handleSelectSite}
        startDateStr={startDateStr}
        onChangeStartDate={setStartDateStr}
        durationDays={durationDays}
        onChangeDuration={setDurationDays}
        arrayType={arrayType}
        onChangeArrayType={setArrayType}
        arrayAreaM2={arrayAreaM2}
        onChangeArrayArea={setArrayAreaM2}
        commsMarginDeg={commsMarginDeg}
        onChangeCommsMargin={setCommsMarginDeg}
        personaMode={personaMode}
        onChangePersonaMode={setPersonaMode}
        workspaceViewMode={workspaceViewMode}
        onChangeWorkspaceViewMode={setWorkspaceViewMode}
        onPinCurrentScenario={handlePinCurrentScenario}
        pinnedCount={pinnedScenarios.length}
        onOpenTutorial={() => setTutorialOpen(true)}
        onOpenManual={() => setManualOpen(true)}
        ephemerisEngine={evaluation.ephemeris_engine}
        isLoading={isLoading}
      />

      {/* Contextual Telemetry KPI Strip (Hidden on Science Guide tab) */}
      {workspaceViewMode !== 'guide' && (
        <TelemetryStrip
          currentStep={currentStep}
          kpis={evaluation.kpis}
          personaMode={personaMode}
        />
      )}

      {/* Optional Educator Banner when Educator Mode is active on operational tabs */}
      {workspaceViewMode !== 'guide' && (
        <EducatorOverlay
          visible={personaMode === 'educator'}
          site={evaluation.site}
          arrayType={arrayType}
          onSelectSiteId={(id) => handleSelectSite(id, null)}
          onSelectArrayType={setArrayType}
        />
      )}

      {/* Main 4-Tab Workspace Router */}
      <main className="flex-1 p-4 pb-16 space-y-4 max-w-[1920px] w-full mx-auto">
        {/* TAB 1: MISSION EXPLORER (Single-Site Deep Dive) */}
        {workspaceViewMode === 'explorer' && (
          <>
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 text-xs">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-bold text-white mr-2">{evaluation.site.name}:</span>
                  <span className="text-slate-300">{evaluation.site.description}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {evaluation.site.program_tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-slate-800/90 text-amber-300 border border-slate-700 text-[10px] font-mono font-semibold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 min-h-[440px]">
                <LunarTerrain3D
                  site={evaluation.site}
                  terrainGrid={evaluation.terrain_grid}
                  timeline={evaluation.timeline}
                  currentStepIndex={currentStepIndex}
                  arrayType={arrayType}
                  thermalMetrics={evaluation.thermal_metrics}
                />
              </div>
              <div className="lg:col-span-5 min-h-[440px]">
                <PolarSkyChart
                  horizonProfile={evaluation.horizon_profile}
                  timeline={evaluation.timeline}
                  currentStepIndex={currentStepIndex}
                  latDeg={evaluation.site.lat_deg}
                  commsMarginDeg={commsMarginDeg}
                  personaMode={personaMode}
                  onSelectStep={setCurrentStepIndex}
                />
              </div>
            </div>

            <div className="bg-[#0F172A]/90 border border-slate-800 rounded-lg px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0" />
                <strong className="font-mono text-sky-300">TERRAIN HORIZON ADVISORY:</strong>{' '}
                {evaluation.site.engineering_notes}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                Diviner Temp: {evaluation.kpis.temp_min_k}K–{evaluation.kpis.temp_max_k}K (
                {evaluation.kpis.temp_min_c}°C to {evaluation.kpis.temp_max_c}°C)
              </span>
            </div>

            <MissionTimelineDock
              timeline={evaluation.timeline}
              currentStepIndex={currentStepIndex}
              onChangeStepIndex={(idx) => {
                setIsPlaying(false);
                setCurrentStepIndex(idx);
              }}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              playbackSpeed={playbackSpeed}
              onChangePlaybackSpeed={setPlaybackSpeed}
              launchSlipDays={launchSlipDays}
              onChangeLaunchSlipDays={setLaunchSlipDays}
              slipSweep={slipSweep}
              effectiveStartUtc={evaluation.effective_start_utc}
              commsMarginDeg={commsMarginDeg}
              personaMode={personaMode}
            />
          </>
        )}

        {/* TAB 2: SITE COMPARATOR (Side-by-Side Scenario A vs B) */}
        {workspaceViewMode === 'comparator' && (
          <>
            <ScenarioCompareDashboard
              sites={sites}
              comparisonData={dualComparison}
              siteAId={selectedSiteId}
              onChangeSiteA={(id) => handleSelectSite(id, null)}
              slipADays={launchSlipDays}
              onChangeSlipA={setLaunchSlipDays}
              siteBId={siteBId}
              onChangeSiteB={setSiteBId}
              slipBDays={slipBDays}
              onChangeSlipB={setSlipBDays}
              currentStepIndex={currentStepIndex}
              onChangeStepIndex={(idx) => {
                setIsPlaying(false);
                setCurrentStepIndex(idx);
              }}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              playbackSpeed={playbackSpeed}
              onChangePlaybackSpeed={setPlaybackSpeed}
              arrayType={arrayType}
              commsMarginDeg={commsMarginDeg}
              onApplyPreset={handleApplyDualPreset}
            />

            <MissionTimelineDock
              timeline={evaluation.timeline}
              currentStepIndex={currentStepIndex}
              onChangeStepIndex={(idx) => {
                setIsPlaying(false);
                setCurrentStepIndex(idx);
              }}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              playbackSpeed={playbackSpeed}
              onChangePlaybackSpeed={setPlaybackSpeed}
              launchSlipDays={launchSlipDays}
              onChangeLaunchSlipDays={setLaunchSlipDays}
              slipSweep={slipSweep}
              effectiveStartUtc={evaluation.effective_start_utc}
              commsMarginDeg={commsMarginDeg}
              personaMode={personaMode}
            />
          </>
        )}

        {/* TAB 3: LAUNCH WINDOW & TRADE STUDY */}
        {workspaceViewMode === 'trade_study' && (
          <>
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-base font-bold text-white font-mono">
                      LAUNCH WINDOW SENSITIVITY &amp; SCHEDULE SLIP SIMULATOR
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Test how a launch delay shifts solar grazing angles and battery eclipse survival at{' '}
                    <strong className="text-slate-200">{evaluation.site.name}</strong> (Base:{' '}
                    <span className="font-mono">{startDateStr}</span>, Effective:{' '}
                    <span className="font-mono text-amber-300">
                      {evaluation.effective_start_utc.slice(0, 10)}
                    </span>
                    ).
                  </p>
                </div>

                {/* Quick Launch Slip Offset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[-14, -7, 0, 4, 8, 14, 21].map((offset) => (
                    <button
                      key={offset}
                      type="button"
                      onClick={() => setLaunchSlipDays(offset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition ${
                        launchSlipDays === offset
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-[#080C14] text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {offset === 0 ? 'Nominal (0d)' : offset > 0 ? `+${offset}d` : `${offset}d`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Launch Slip Slider & Live Impact Readout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-5 bg-[#080C14] border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-mono uppercase">Launch Schedule Slip:</span>
                    <span className="text-sm font-mono font-bold text-amber-400">
                      {launchSlipDays === 0
                        ? '0 Days (On Schedule)'
                        : launchSlipDays > 0
                        ? `+${launchSlipDays} Days Delay`
                        : `${launchSlipDays} Days Early`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-14}
                    max={28}
                    step={1}
                    value={launchSlipDays}
                    onChange={(e) => setLaunchSlipDays(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>-14d Early</span>
                    <span>Nominal</span>
                    <span>+14d</span>
                    <span>+28d (+1 Lunar Cycle)</span>
                  </div>
                </div>

                {/* Updated 4-Card KPI Readout */}
                <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>SUNLIT RATIO</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      {evaluation.kpis.sunlight_percentage.toFixed(1)}%
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {evaluation.kpis.total_sunlight_hours.toFixed(0)}h illuminated
                    </div>
                  </div>

                  <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                      <Radio className="w-3.5 h-3.5 text-sky-400" />
                      <span>EARTH DTE</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-white mt-1">
                      {evaluation.kpis.dte_comms_percentage.toFixed(1)}%
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {evaluation.kpis.total_dte_hours.toFixed(0)}h direct link
                    </div>
                  </div>

                  <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                      <BatteryWarning
                        className={`w-3.5 h-3.5 ${
                          evaluation.kpis.max_continuous_darkness_hours > 50
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      />
                      <span>MAX ECLIPSE</span>
                    </div>
                    <div
                      className={`text-xl font-bold font-mono mt-1 ${
                        evaluation.kpis.max_continuous_darkness_hours > 50
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {evaluation.kpis.max_continuous_darkness_hours.toFixed(1)}h
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {evaluation.kpis.max_continuous_darkness_hours > 50
                        ? 'Exceeds 50h limit'
                        : 'Within battery spec'}
                    </div>
                  </div>

                  <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3">
                    <div className="text-[11px] font-mono text-slate-400">VIABILITY SCORE</div>
                    <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                      {evaluation.kpis.viability_score.toFixed(0)}/100
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 uppercase">
                      {evaluation.kpis.feasibility_verdict.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Site 4-Scenario Trade-Off Pinboard */}
            <ComparisonMatrix
              pinnedScenarios={pinnedScenarios}
              onRemoveScenario={(id) =>
                setPinnedScenarios((prev) => prev.filter((s) => s.scenario_id !== id))
              }
              onPinCurrent={handlePinCurrentScenario}
              onLoadReferencePreset={handleLoadReferencePreset}
              isLoadingPreset={isLoadingPreset}
            />
          </>
        )}

        {/* TAB 4: SCIENCE & OPERATIONS GUIDE */}
        {workspaceViewMode === 'guide' && (
          <div className="space-y-4">
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs uppercase tracking-wider">
                    <Compass className="w-4 h-4" />
                    <span>Lunar South Pole Astrodynamics &amp; Mission Operations Lab</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    Interactive Physics Scenarios &amp; Flight Rules
                  </h2>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTutorialOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    Start Guided Mission Tour
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition"
                  >
                    <BookOpen className="w-4 h-4 text-sky-400" />
                    Open Full Technical Manual
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    badge: '01 • GRAZING SUNLIGHT',
                    title: 'Peaks of Near-Eternal Light (Shackleton Ridge)',
                    body: 'Because the Moon’s axial tilt is only 1.54°, sunlight skims nearly horizontally across the poles. Elevated crater rims receive >80% illumination while adjacent crater floors remain permanently dark.',
                    cta: 'Inspect Shackleton Ridge in 3D Explorer',
                    onRun: () => {
                      handleSelectSite('shackleton_ridge', null);
                      setLaunchSlipDays(0);
                      setWorkspaceViewMode('explorer');
                    },
                  },
                  {
                    badge: '02 • COLD TRAPS (PSRs)',
                    title: 'Cryogenic Water-Ice Traps (Haworth Crater Floor)',
                    body: 'Deep polar basins never see direct sunlight, plunging below 45 K (-228 °C) in NASA Diviner thermal data—cold enough to trap water ice for billions of years, yet fatal to solar-powered landers.',
                    cta: 'Compare Shackleton Ridge vs. Haworth PSR',
                    onRun: () => {
                      handleApplyDualPreset('shackleton_ridge', 0, 'haworth_floor', 0);
                      setWorkspaceViewMode('comparator');
                    },
                  },
                  {
                    badge: '03 • SOLAR ARRAY GEOMETRY',
                    title: 'Why Polar Landers Use Vertical Cylindrical Arrays',
                    body: 'A horizontal flat deck suffers a sin(El) cosine loss—yielding under 5% power when the Sun sits 2° above the horizon. A vertical 360° mast captures near-100% grazing flux regardless of solar azimuth.',
                    cta: 'Test Flat Deck vs. Vertical Mast',
                    onRun: () => {
                      setArrayType('horizontal_deck');
                      setWorkspaceViewMode('explorer');
                    },
                  },
                  {
                    badge: '04 • EARTH LIBRATION & DTE',
                    title: 'Direct-to-Earth (DTE) Radio Line-of-Sight',
                    body: 'Earth oscillates ±6.7° in elevation over a 27.3-day nodical cycle due to lunar inclination and libration. High massifs like Malapert serve as natural radio beacons even when Earth dips low.',
                    cta: 'Run 4-Site Artemis Trade Study',
                    onRun: () => {
                      setWorkspaceViewMode('trade_study');
                      handleLoadReferencePreset();
                    },
                  },
                ].map((card) => (
                  <div
                    key={card.badge}
                    className="bg-[#080C14] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {card.badge}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1">{card.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed mt-2">{card.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={card.onRun}
                      className="self-start inline-flex items-center gap-1.5 text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition"
                    >
                      <span>{card.cta}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Light / Dark Mode Toggle Pill (Always accessible in bottom-right corner) */}
      <button
        type="button"
        onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold border border-slate-700 bg-[#0F172A] text-slate-100 hover:border-amber-400 shadow-xl transition cursor-pointer"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle Light and Dark Mode"
      >
        {theme === 'dark' ? (
          <>
            <Sun className="w-4 h-4 text-amber-400" />
            <span>Light Mode</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-sky-400" />
            <span>Dark Mode</span>
          </>
        )}
      </button>

      {/* Guided Tutorial & Operations Manual Modals */}
      <InteractiveTutorialModal
        visible={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onRunStepAction={handleTutorialStepAction}
      />
      <OperationsManualModal
        visible={manualOpen}
        onClose={() => setManualOpen(false)}
      />
    </div>
  );
}

export default App;