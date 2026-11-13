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
  fetchLaunchSlipSweep,
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
import { Info, ShieldAlert } from 'lucide-react';

export function App() {
  const [sites, setSites] = useState<LunarSite[]>(FALLBACK_SITES);

  // Comparison-First UX Mode ('compare' default per Phase 2 Spec, 'single' for single-site deep dive)
  const [workspaceViewMode, setWorkspaceViewMode] = useState<WorkspaceViewMode>('compare');

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

  // Evaluate Scenario A & Scenario B simultaneously via POST /api/compare_scenarios
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
        setCurrentStepIndex((prev) =>
          Math.min(prev, Math.max(0, compRes.scenario_a.timeline.length - 1))
        );
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
  ]);

  // Fetch Launch Slip Sensitivity Sweep for Primary Site A
  useEffect(() => {
    let active = true;
    const req: EvaluateRequest = {
      site_id: selectedSiteId,
      custom_site: selectedSiteId === 'custom' ? customSite : null,
      start_datetime_utc: `${startDateStr}T00:00:00Z`,
      duration_days: durationDays,
      step_hours: 4.0,
      launch_slip_days: 0,
      array_type: arrayType,
      array_area_m2: arrayAreaM2,
      comms_margin_deg: commsMarginDeg,
    };

    fetchLaunchSlipSweep(req).then((res) => {
      if (active && res?.sweep) {
        setSlipSweep(res.sweep);
      }
    });

    return () => {
      active = false;
    };
  }, [
    selectedSiteId,
    customSite,
    startDateStr,
    durationDays,
    arrayType,
    arrayAreaM2,
    commsMarginDeg,
  ]);

  // Synchronized 60 FPS timeline playback loop
  useEffect(() => {
    if (!isPlaying || !evaluation) return;
    const intervalMs = playbackSpeed === 20 ? 35 : playbackSpeed === 5 ? 90 : 220;
    const timer = window.setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev + 1 >= evaluation.timeline.length) {
          return 0;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, evaluation]);

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
      setSelectedSiteId('shackleton_ridge');
      setSiteBId('malapert_massif');
      setLaunchSlipDays(0);
      setSlipBDays(0);
      setArrayType('vertical_cylindrical');
    } else if (stepIdx === 1) {
      setIsPlaying(true);
      setPlaybackSpeed(5);
    } else if (stepIdx === 2) {
      setIsPlaying(false);
      setArrayType((prev) =>
        prev === 'vertical_cylindrical' ? 'horizontal_deck' : 'vertical_cylindrical'
      );
    } else if (stepIdx === 3) {
      handleLoadReferencePreset();
    }
  };

  if (!evaluation || !dualComparison) {
    return (
      <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center font-mono text-sm">
        Ingesting NASA LOLA 128×128 DEMs, LROC WAC Textures, Diviner Thermal Grids &amp; Selenographic Ephemerides...
      </div>
    );
  }

  const currentStep = evaluation.timeline[currentStepIndex] || evaluation.timeline[0];

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col">
      {/* Module A: Top Mission Control Header & Scenario Bar */}
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
      />

      {/* Module B: Real-Time Operational KPI & Countdown Strip (Primary Scenario A) */}
      <TelemetryStrip
        currentStep={currentStep}
        kpis={evaluation.kpis}
        personaMode={personaMode}
      />

      {/* Optional Educator Guided Physics Explainer Overlay */}
      <EducatorOverlay
        visible={personaMode === 'educator'}
        site={evaluation.site}
        arrayType={arrayType}
        onSelectSiteId={(id) => handleSelectSite(id, null)}
        onSelectArrayType={setArrayType}
      />

      {/* Main Mission Control Workspace */}
      <main className="flex-1 p-4 space-y-4 max-w-[1920px] w-full mx-auto">
        {workspaceViewMode === 'compare' ? (
          /* PHASE 2 COMPARISON-FIRST UX: Dual-Pane 3D Visualizer + Delta Trade-Off Matrix + Radar Chart */
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
        ) : (
          /* SINGLE-SITE DEEP-DIVE VIEW: Full 3D DEM + 360° Polar Radar + Launch-Slip Cliff Sweep */
          <>
            <div className="bg-[#111827] border border-gray-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 text-xs">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="font-bold text-white mr-2">{evaluation.site.name}:</span>
                  <span className="text-gray-300">{evaluation.site.description}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {evaluation.site.program_tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded bg-gray-800 text-amber-300 border border-gray-700 text-[10px] font-mono font-semibold"
                  >
                    {tag}
                  </span>
                ))}
                {isLoading && (
                  <span className="text-[11px] font-mono text-sky-400 animate-pulse ml-2">
                    Recomputing Ephemeris...
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 min-h-[420px]">
                <LunarTerrain3D
                  site={evaluation.site}
                  terrainGrid={evaluation.terrain_grid}
                  timeline={evaluation.timeline}
                  currentStepIndex={currentStepIndex}
                  arrayType={arrayType}
                  thermalMetrics={evaluation.thermal_metrics}
                />
              </div>
              <div className="lg:col-span-5 min-h-[420px]">
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

            <div className="bg-[#111827]/90 border border-gray-800/90 rounded-lg px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-gray-300">
                <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0" />
                <strong className="font-mono text-sky-300">TERRAIN HORIZON ADVISORY:</strong>{' '}
                {evaluation.site.engineering_notes}
              </span>
              <span className="font-mono text-[11px] text-gray-400">
                Diviner Temp: {evaluation.kpis.temp_min_k}K–{evaluation.kpis.temp_max_k}K ({evaluation.kpis.temp_min_c}°C to {evaluation.kpis.temp_max_c}°C)
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
      </main>

      <InteractiveTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onApplyStepAction={handleTutorialStepAction}
      />

      <OperationsManualModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
      />
    </div>
  );
}

export default App;
