import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  LunarSite,
  SolarArrayType,
  PersonaMode,
  CustomSiteInput,
  MissionEvaluationResponse,
  PinnedScenario,
  EvaluateRequest,
  DualScenarioComparisonResponse,
} from './types/mission';
import type {
  RailPanelId,
  ProjectionMode,
  CameraPresetId,
  ActiveToolId,
  LayerItemState,
  BookmarkItem,
  CursorTelemetry,
  ContourSettings,
  GraticuleSettings,
  MeasurePoint3D,
} from './types/workbench';
import {
  fetchSites,
  evaluateMission,
  compareTwoScenarios,
  FALLBACK_SITES,
} from './api/client';
import { LunarTerrain3D } from './components/LunarTerrain3D';
import { PolarSkyChart } from './components/PolarSkyChart';
import { ComparisonMatrix } from './components/ComparisonMatrix';
import { ScenarioCompareDashboard } from './components/ScenarioCompareDashboard';
import {
  InteractiveTutorialModal,
  OperationsManualModal,
} from './components/EducatorOverlay';
import { LeftIconRail } from './components/workbench/LeftIconRail';
import { SlideOutDrawer } from './components/workbench/SlideOutDrawer';
import { TopRightToolbar } from './components/workbench/TopRightToolbar';
import { BottomHudOverlays } from './components/workbench/BottomHudOverlays';
import { LayerManagerPanel } from './components/workbench/LayerManagerPanel';
import { FloatingColorBar } from './components/workbench/FloatingColorBar';
import { MeasurementToolsPanel } from './components/workbench/MeasurementToolsPanel';
import {
  buildShareableWorkbenchUrl,
  captureViewportPngSnapshot,
  exportMissionReportJson,
  exportTimelineCsv,
  parseInitialWorkbenchUrlState,
} from './utils/missionExport';
import {
  Search,
  MapPin,
  Bookmark,
  Share2,
  Check,
  Sparkles,
  BookOpen,
  X,
  CalendarClock,
  Undo2,
  Trash2,
  Camera,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';

const INITIAL_LAYERS: LayerItemState[] = [
  {
    id: 'lroc_wac',
    label: 'LROC WAC Albedo Mosaic',
    group: 'Basemap',
    visible: true,
    opacity: 1,
    sourceNote: 'NASA LRO Wide Angle Camera normalized reflectance basemap (643 nm).',
    instrumentMeta: 'LRO / LROC Wide Angle Camera',
    resolutionMeta: '100 m/px global mosaic',
    datumMeta: 'IAU Mean Earth 1737.4 km',
  },
  {
    id: 'lola_elevation',
    label: 'LOLA Hypsometric Elevation',
    group: 'Elevation',
    visible: false,
    opacity: 0.65,
    colormap: 'cividis',
    unit: 'm',
    minVal: -2500,
    maxVal: 4800,
    gamma: 1.0,
    sourceNote: 'LOLA South Pole Digital Elevation Model relative to 1,737.4 km reference sphere.',
    instrumentMeta: 'LRO / Lunar Orbiter Laser Altimeter',
    resolutionMeta: '80 m/px (LDEM_80S_80MPP_ADJ)',
    datumMeta: 'R = 1737.4 km Sphere',
  },
  {
    id: 'terrain_slope',
    label: 'Surface Slope & HLS Threshold',
    group: 'Slope',
    visible: false,
    opacity: 0.75,
    colormap: 'inferno',
    unit: 'deg',
    minVal: 0,
    maxVal: 20,
    gamma: 1.0,
    sourceNote: 'Finite-difference topographic gradient; highlights HLS landing zones (< 5.0°).',
    instrumentMeta: 'Derived LOLA Slope Product',
    resolutionMeta: '80 m baseline',
    datumMeta: 'Local ENU Tangent Plane',
  },
  {
    id: 'psr_cold_traps',
    label: 'Diviner PSR Cold Traps (<70K)',
    group: 'Illumination',
    visible: false,
    opacity: 0.85,
    colormap: 'viridis',
    unit: 'K',
    minVal: 25,
    maxVal: 250,
    gamma: 1.0,
    sourceNote: 'LRO Diviner bolometric brightness temperatures identifying water-ice cold traps.',
    instrumentMeta: 'LRO / Diviner Lunar Radiometer',
    resolutionMeta: '240 m/px Polar Seasonal',
    datumMeta: 'Bolometric K',
  },
  {
    id: 'dte_visibility',
    label: 'Earth DTE Line-of-Sight',
    group: 'Visibility',
    visible: true,
    opacity: 0.75,
    sourceNote: 'Topocentric Earth azimuth/elevation clearance above local LOLA horizon.',
    instrumentMeta: 'JPL DE421 Ephemeris + LOLA Mask',
    resolutionMeta: '1° Azimuthal Resolution',
    datumMeta: 'Topocentric ENU',
  },
  {
    id: 'landing_markers',
    label: 'Candidate Landing Markers',
    group: 'Sites',
    visible: true,
    opacity: 1,
    sourceNote: 'Artemis III, VIPER, and CLPS candidate landing coordinates.',
    instrumentMeta: 'NASA Exploration Systems',
    resolutionMeta: 'Pinpoint Selenographic',
    datumMeta: 'IAU ME Frame',
  },
];

export function App() {
  const initialUrlState = useMemo(() => parseInitialWorkbenchUrlState(), []);

  const [sites, setSites] = useState<LunarSite[]>(FALLBACK_SITES);

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

  const [activePanel, setActivePanel] = useState<RailPanelId | null>('sites');
  const [projection, setProjection] = useState<ProjectionMode>(
    initialUrlState.projection ?? '3d_terrain'
  );
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>(
    initialUrlState.cameraPreset ?? 'orbit'
  );
  const [activeTool, setActiveTool] = useState<ActiveToolId>('none');
  const [measurePoints, setMeasurePoints] = useState<MeasurePoint3D[]>([]);
  const [profileHoverT, setProfileHoverT] = useState<number | null>(null);
  const [presentationMode, setPresentationMode] = useState<boolean>(false);
  const [siteQuery, setSiteQuery] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [snapshotStatus, setSnapshotStatus] = useState<'idle' | 'saved' | 'unavailable'>('idle');

  const [layers, setLayers] = useState<LayerItemState[]>(INITIAL_LAYERS);
  const [contourSettings, setContourSettings] = useState<ContourSettings>({
    visible: true,
    intervalM: 100,
  });
  const [graticuleSettings, setGraticuleSettings] = useState<GraticuleSettings>({
    visible: true,
    rangeRings: true,
  });
  const [hoverCursor, setHoverCursor] = useState<CursorTelemetry | null>(null);

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('luna-nav-bookmarks');
      return raw ? (JSON.parse(raw) as BookmarkItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('luna-nav-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const [selectedSiteId, setSelectedSiteId] = useState<string>(
    initialUrlState.siteId ?? 'shackleton_ridge'
  );
  const [customSite, setCustomSite] = useState<CustomSiteInput | null>(
    initialUrlState.customSite ?? null
  );
  const [customLat, setCustomLat] = useState<string>(
    initialUrlState.customSite ? String(initialUrlState.customSite.lat_deg) : '-88.80'
  );
  const [customLon, setCustomLon] = useState<string>(
    initialUrlState.customSite ? String(initialUrlState.customSite.lon_deg) : '120.00'
  );
  const [startDateStr, setStartDateStr] = useState<string>(
    initialUrlState.startDateStr ?? '2026-12-01'
  );
  const [durationDays, setDurationDays] = useState<number>(
    initialUrlState.durationDays ?? 30
  );
  const [launchSlipDays, setLaunchSlipDays] = useState<number>(
    initialUrlState.launchSlipDays ?? 0
  );

  const [siteBId, setSiteBId] = useState<string>('malapert_massif');
  const [slipBDays, setSlipBDays] = useState<number>(0);

  const [arrayType, setArrayType] = useState<SolarArrayType>(
    initialUrlState.arrayType ?? 'vertical_cylindrical'
  );
  const [arrayAreaM2, setArrayAreaM2] = useState<number>(12.0);
  const [commsMarginDeg, setCommsMarginDeg] = useState<number>(1.0);

  const [personaMode, setPersonaMode] = useState<PersonaMode>('engineering');
  const [tutorialOpen, setTutorialOpen] = useState<boolean>(false);
  const [manualOpen, setManualOpen] = useState<boolean>(false);

  const [evaluation, setEvaluation] = useState<MissionEvaluationResponse | null>(null);
  const [dualComparison, setDualComparison] = useState<DualScenarioComparisonResponse | null>(null);
  const [loadedRequestKey, setLoadedRequestKey] = useState<string>('');

  const [currentStepIndex, setCurrentStepIndex] = useState<number>(
    initialUrlState.stepIndex ?? 0
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 5 | 20>(5);

  const [pinnedScenarios, setPinnedScenarios] = useState<PinnedScenario[]>([]);
  const [isLoadingPreset, setIsLoadingPreset] = useState<boolean>(false);

  useEffect(() => {
    fetchSites().then((list) => {
      if (list && list.length > 0) setSites(list);
    });
  }, []);

  const currentRequestKey = useMemo(
    () =>
      JSON.stringify({
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
      }),
    [
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
    ]
  );

  const isLoading = loadedRequestKey !== currentRequestKey;

  useEffect(() => {
    let active = true;
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

    compareTwoScenarios(reqA, reqB).then((compRes) => {
      if (!active) return;
      setDualComparison(compRes);
      setEvaluation(compRes.scenario_a);
      setLoadedRequestKey(currentRequestKey);
      setCurrentStepIndex((prev) =>
        Math.min(prev, Math.max(0, compRes.scenario_a.timeline.length - 1))
      );
    });

    return () => {
      active = false;
    };
  }, [
    currentRequestKey,
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

  useEffect(() => {
    if (!isPlaying || !evaluation) return;
    const maxLen = evaluation.timeline.length;
    if (maxLen <= 1) return;

    const intervalMs = playbackSpeed === 20 ? 40 : playbackSpeed === 5 ? 95 : 220;
    const timer = window.setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1 >= maxLen ? 0 : prev + 1));
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, evaluation]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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

      const key = e.key.toLowerCase();
      if (e.key === 'Escape') {
        if (presentationMode) setPresentationMode(false);
        else if (activeTool !== 'none') {
          setActiveTool('none');
          setMeasurePoints([]);
          setProfileHoverT(null);
        } else {
          setActivePanel(null);
        }
      } else if (e.key === 'Backspace' && activeTool !== 'none') {
        e.preventDefault();
        setMeasurePoints((prev) => prev.slice(0, -1));
      } else if (key === 's') {
        setActivePanel((p) => (p === 'sites' ? null : 'sites'));
      } else if (key === 'l') {
        setActivePanel((p) => (p === 'layers' ? null : 'layers'));
      } else if (key === 't') {
        setActivePanel((p) => (p === 'tools' ? null : 'tools'));
      } else if (key === 'b') {
        setActivePanel((p) => (p === 'bookmarks' ? null : 'bookmarks'));
      } else if (key === 'c') {
        setActivePanel((p) => (p === 'compare' ? null : 'compare'));
      } else if (key === 'g') {
        setActivePanel((p) => (p === 'guide' ? null : 'guide'));
      } else if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowRight' && evaluation) {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStepIndex((prev) => Math.min(evaluation.timeline.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStepIndex((prev) => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [evaluation, presentationMode, activeTool]);

  const handleTogglePanel = useCallback((panel: RailPanelId) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }, []);

  const handleSelectSite = useCallback((siteId: string, custom?: CustomSiteInput | null) => {
    setSelectedSiteId(siteId);
    if (custom !== undefined) setCustomSite(custom);
    setHoverCursor(null);
    setMeasurePoints([]);
    setProfileHoverT(null);
    setCurrentStepIndex(0);
  }, []);

  const handleSelectTool = useCallback((tool: ActiveToolId) => {
    setActiveTool(tool);
    setMeasurePoints([]);
    setProfileHoverT(null);
  }, []);

  const handleAddMeasurePoint = useCallback(
    (pt: MeasurePoint3D) => {
      setMeasurePoints((prev) => {
        if (activeTool === 'point_inspect') return [pt];
        if (activeTool === 'circle' || activeTool === 'profile') {
          return prev.length >= 2 ? [pt] : [...prev, pt];
        }
        return [...prev, pt];
      });
    },
    [activeTool]
  );

  const psrLayerVisible = useMemo(
    () => layers.find((l) => l.id === 'psr_cold_traps')?.visible ?? false,
    [layers]
  );

  const handleTogglePsrFromViewport = useCallback((val: boolean) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === 'psr_cold_traps' ? { ...l, visible: val } : l))
    );
  }, []);

  const filteredSites = useMemo(() => {
    const q = siteQuery.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.subtitle.toLowerCase().includes(q) ||
        s.program_tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [sites, siteQuery]);

  const handlePinCurrentScenario = useCallback(() => {
    if (!evaluation) return;
    setPinnedScenarios((prev) => {
      const slipTag =
        launchSlipDays === 0
          ? 'Nominal'
          : launchSlipDays > 0
          ? `+${launchSlipDays}d`
          : `${launchSlipDays}d`;
      const label = `${evaluation.site.name.split(' ')[0]} (${slipTag})`;
      return [
        ...prev.slice(-3),
        { scenario_id: `${evaluation.site.id}_${Date.now()}`, label, evaluation },
      ];
    });
  }, [evaluation, launchSlipDays]);

  const handleLoadReferencePreset = useCallback(async () => {
    setIsLoadingPreset(true);
    try {
      const configs = [
        { label: 'Shackleton (0d)', site_id: 'shackleton_ridge', slip: 0 },
        { label: 'Malapert (0d)', site_id: 'malapert_massif', slip: 0 },
        { label: 'Nobile (+8d)', site_id: 'nobile_rim', slip: 8 },
        { label: 'Haworth (PSR)', site_id: 'haworth_floor', slip: 0 },
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
          return { scenario_id: `preset_${c.site_id}_${c.slip}`, label: c.label, evaluation: ev };
        })
      );
      setPinnedScenarios(evals);
    } finally {
      setIsLoadingPreset(false);
    }
  }, [startDateStr, durationDays, arrayType, arrayAreaM2, commsMarginDeg]);

  const handleAddBookmark = () => {
    if (!evaluation) return;
    const item: BookmarkItem = {
      id: `bm_${Date.now()}`,
      name: `${evaluation.site.name} (${startDateStr})`,
      siteId: selectedSiteId,
      startDateStr,
      launchSlipDays,
      projection,
      createdAtUtc: new Date().toISOString(),
    };
    setBookmarks((prev) => [item, ...prev.slice(0, 11)]);
  };

  const handleCopyShareUrl = () => {
    const shareUrl = buildShareableWorkbenchUrl({
      siteId: selectedSiteId,
      customSite,
      startDateStr,
      durationDays,
      launchSlipDays,
      arrayType,
      projection,
      cameraPreset,
      stepIndex: currentStepIndex,
    });
    navigator.clipboard?.writeText(shareUrl);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!evaluation || !dualComparison) {
    return (
      <div className="w-screen h-screen bg-[#05070b] text-slate-200 flex flex-col items-center justify-center gap-3 font-mono text-xs">
        <div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span>INITIALIZING LOLA DEM, DIVINER THERMAL &amp; EPHEMERIS WORKBENCH...</span>
      </div>
    );
  }

  const currentStep = evaluation.timeline[currentStepIndex] || evaluation.timeline[0];

  const handleCapturePngSnapshot = () => {
    const ok = captureViewportPngSnapshot(evaluation, currentStep);
    setSnapshotStatus(ok ? 'saved' : 'unavailable');
    window.setTimeout(() => setSnapshotStatus('idle'), 2200);
  };

  const activeCursor: CursorTelemetry = hoverCursor || {
    latDeg: evaluation.site.lat_deg,
    lonDeg: evaluation.site.lon_deg,
    elevM: evaluation.terrain_grid.lander_pos.z_m,
    slopeDeg: evaluation.terrain_grid.landing_pad_slope_deg ?? 3.1,
    sunlit: currentStep?.sun_visible ?? false,
    earthVisible: currentStep?.earth_visible ?? false,
  };

  const drawerMeta: Record<RailPanelId, { title: string; subtitle: string; wide?: boolean }> = {
    sites: {
      title: 'Sites, Coordinates & Ephemeris',
      subtitle: 'Curated Artemis / CLPS targets & custom selenographic coordinates',
    },
    layers: {
      title: 'Scientific Layers, Contours & Stretches',
      subtitle: 'Reorder stack, adjust min/max/gamma ramps & inspect provenance',
    },
    tools: {
      title: 'Geodesic Measurement & DEM Profile',
      subtitle: 'Point inspect, geodesic distance, area, range rings & transect chart',
    },
    bookmarks: {
      title: 'Bookmarks, Share URL & Data Export',
      subtitle: 'Save reproducible states, capture PNG frames, or export JSON/CSV',
    },
    compare: {
      title: 'Site & Schedule Trade Comparator',
      subtitle: 'Side-by-side Scenario A vs B & 4-site trade matrix',
      wide: true,
    },
    guide: {
      title: 'Lunar South Pole Science & Flight Rules',
      subtitle: 'Grazing sunlight, PSR cold traps, array geometry & manual',
    },
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070b] select-none">
      {/* FULL-BLEED PRIMARY VIEWPORT */}
      <main
        aria-label="Primary Selenographic Visualization Viewport"
        className="fixed inset-0 w-screen h-screen"
      >
        {projection === '3d_terrain' && (
          <div className="w-full h-full">
            <LunarTerrain3D
              site={evaluation.site}
              terrainGrid={evaluation.terrain_grid}
              timeline={evaluation.timeline}
              currentStepIndex={currentStepIndex}
              arrayType={arrayType}
              thermalMetrics={evaluation.thermal_metrics}
              externalShowPsr={psrLayerVisible}
              onTogglePsr={handleTogglePsrFromViewport}
              layers={layers}
              contourSettings={contourSettings}
              graticuleSettings={graticuleSettings}
              cameraPreset={cameraPreset}
              cinematicMode={presentationMode}
              showEducationalVectors={personaMode === 'educator'}
              onCursorTelemetry={setHoverCursor}
              activeTool={activeTool}
              measurePoints={measurePoints}
              onAddMeasurePoint={handleAddMeasurePoint}
              profileHoverT={profileHoverT}
            />
          </div>
        )}

        {projection === '2d_polar' && (
          <div className="w-full h-full flex items-center justify-center p-14 bg-[#05070b]">
            <div className="w-full max-w-[680px] h-full max-h-[680px]">
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
        )}

        {projection === 'split' && (
          <div className="w-full h-full grid grid-cols-1 lg:grid-cols-2">
            <div className="h-full border-r border-slate-800/80">
              <LunarTerrain3D
                site={evaluation.site}
                terrainGrid={evaluation.terrain_grid}
                timeline={evaluation.timeline}
                currentStepIndex={currentStepIndex}
                arrayType={arrayType}
                thermalMetrics={evaluation.thermal_metrics}
                compactMode
                externalShowPsr={psrLayerVisible}
                onTogglePsr={handleTogglePsrFromViewport}
                layers={layers}
                contourSettings={contourSettings}
                graticuleSettings={graticuleSettings}
                cameraPreset={cameraPreset}
                cinematicMode={presentationMode}
                showEducationalVectors={personaMode === 'educator'}
                onCursorTelemetry={setHoverCursor}
                activeTool={activeTool}
                measurePoints={measurePoints}
                onAddMeasurePoint={handleAddMeasurePoint}
                profileHoverT={profileHoverT}
              />
            </div>
            <div className="h-full flex items-center justify-center p-10 bg-[#05070b]">
              <div className="w-full max-w-[540px] h-full max-h-[540px]">
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
          </div>
        )}
      </main>

      {/* CHROME (Hidden when SVS Presentation Mode is active) */}
      {!presentationMode ? (
        <>
          <LeftIconRail
            activePanel={activePanel}
            onTogglePanel={handleTogglePanel}
            bookmarkCount={bookmarks.length}
          />

          <TopRightToolbar
            projection={projection}
            onChangeProjection={setProjection}
            cameraPreset={cameraPreset}
            onChangeCameraPreset={setCameraPreset}
            personaMode={personaMode}
            onChangePersonaMode={setPersonaMode}
            theme={theme}
            onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            onEnterPresentation={() => setPresentationMode(true)}
            ephemerisEngine={evaluation.ephemeris_engine}
            isLoading={isLoading}
          />

          {/* Compact Floating HUD Pill when a Geodesic Tool is Active */}
          {activeTool !== 'none' && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-20 hud-panel rounded-full px-3.5 py-1 flex items-center gap-2.5 text-[11px] font-mono border-sky-400/50">
              <span className="text-sky-300 font-semibold uppercase">
                {activeTool.replace('_', ' ')}
              </span>
              <span className="text-slate-400">• Click 3D surface</span>
              {measurePoints.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setMeasurePoints((p) => p.slice(0, -1))}
                    className="text-slate-300 hover:text-white flex items-center gap-0.5"
                    title="Undo last vertex"
                  >
                    <Undo2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMeasurePoints([]);
                      setProfileHoverT(null);
                    }}
                    className="text-rose-300 hover:text-rose-200 flex items-center gap-0.5"
                    title="Clear vertices"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => handleSelectTool('none')}
                className="text-slate-400 hover:text-white ml-1"
                title="Exit tool [Esc]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <SlideOutDrawer
            isOpen={activePanel !== null}
            title={activePanel ? drawerMeta[activePanel].title : ''}
            subtitle={activePanel ? drawerMeta[activePanel].subtitle : ''}
            wide={activePanel ? drawerMeta[activePanel].wide : false}
            onClose={() => setActivePanel(null)}
          >
            {/* PANEL 1: SITES, COORDINATES & MISSION EPOCH */}
            {activePanel === 'sites' && (
              <div className="space-y-4">
                <div>
                  <label className="section-kicker block mb-1.5" htmlFor="site-search-input">
                    Search Lunar Targets
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="site-search-input"
                      type="text"
                      value={siteQuery}
                      onChange={(e) => setSiteQuery(e.target.value)}
                      placeholder="Shackleton, Malapert, Artemis, PSR..."
                      className="w-full bg-slate-950/70 border border-slate-700/70 rounded pl-8 pr-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="section-kicker block">Curated Landing Sites</span>
                  {filteredSites.map((s) => {
                    const selected = selectedSiteId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSite(s.id, null)}
                        className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                          selected
                            ? 'bg-sky-500/15 border-sky-400/60 text-slate-100'
                            : 'bg-slate-950/50 border-slate-800/80 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold truncate">{s.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 tabular-nums">
                            {s.lat_deg.toFixed(2)}°
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {s.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <span className="section-kicker block">Custom South Pole Coordinates</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        Lat (°S: -90 to -80)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min={-90}
                        max={90}
                        value={customLat}
                        onChange={(e) => setCustomLat(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded px-2 py-1 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        Lon (°E: 0 to 360)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={-180}
                        max={360}
                        value={customLon}
                        onChange={(e) => setCustomLon(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded px-2 py-1 text-xs font-mono text-slate-100"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectSite('custom', {
                        lat_deg: Number(customLat) || -88.8,
                        lon_deg: Number(customLon) || 120.0,
                        elev_m: 1500,
                        terrain_type: 'ridge',
                      })
                    }
                    className="w-full py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Evaluate Coordinates</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <span className="section-kicker block">Mission Epoch &amp; Hardware</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        Start UTC
                      </label>
                      <input
                        type="date"
                        value={startDateStr}
                        onChange={(e) => setStartDateStr(e.target.value)}
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded px-2 py-1 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        Duration (Days)
                      </label>
                      <select
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded px-2 py-1 text-xs font-mono text-slate-100"
                      >
                        <option value={14}>14d (Half Lunation)</option>
                        <option value={30}>30d (1 Lunar Day)</option>
                        <option value={60}>60d (2 Lunar Days)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3 text-amber-400" /> Launch Slip
                      </span>
                      <span className="text-amber-300 tabular-nums">
                        {launchSlipDays >= 0 ? `+${launchSlipDays}d` : `${launchSlipDays}d`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-14}
                      max={28}
                      step={1}
                      value={launchSlipDays}
                      onChange={(e) => setLaunchSlipDays(Number(e.target.value))}
                      className="sci-slider w-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        Solar Array
                      </label>
                      <select
                        value={arrayType}
                        onChange={(e) => setArrayType(e.target.value as SolarArrayType)}
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="vertical_cylindrical">Vertical Mast</option>
                        <option value="dual_axis_tracking">Dual-Axis Track</option>
                        <option value="horizontal_deck">Flat Deck</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        Array Area (m²)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={200}
                        value={arrayAreaM2}
                        onChange={(e) => setArrayAreaM2(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded px-2 py-1 text-xs font-mono text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] font-mono mb-1">
                      <span className="text-slate-400">DTE Comms Mask Margin</span>
                      <span className="text-sky-300 tabular-nums">+{commsMarginDeg.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={0.5}
                      value={commsMarginDeg}
                      onChange={(e) => setCommsMarginDeg(Number(e.target.value))}
                      className="sci-slider w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 2: FULL LAYER MANAGER */}
            {activePanel === 'layers' && (
              <LayerManagerPanel
                layers={layers}
                onChangeLayers={setLayers}
                patchMinElevM={evaluation.terrain_grid.min_elev_m}
                patchMaxElevM={evaluation.terrain_grid.max_elev_m}
                contourSettings={contourSettings}
                onChangeContourSettings={setContourSettings}
                graticuleSettings={graticuleSettings}
                onChangeGraticuleSettings={setGraticuleSettings}
              />
            )}

            {/* PANEL 3: GEODESIC MEASUREMENT & DEM PROFILE TOOLS */}
            {activePanel === 'tools' && (
              <MeasurementToolsPanel
                site={evaluation.site}
                terrainGrid={evaluation.terrain_grid}
                currentStep={currentStep}
                activeTool={activeTool}
                onSelectTool={handleSelectTool}
                points={measurePoints}
                onUndoPoint={() => setMeasurePoints((prev) => prev.slice(0, -1))}
                onClearPoints={() => {
                  setMeasurePoints([]);
                  setProfileHoverT(null);
                }}
                profileHoverT={profileHoverT}
                onHoverProfileT={setProfileHoverT}
              />
            )}

            {/* PANEL 4: BOOKMARKS, SHAREABLE URL & MISSION EXPORTS */}
            {activePanel === 'bookmarks' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddBookmark}
                    className="flex-1 py-1.5 px-2.5 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Bookmark View</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    className="py-1.5 px-2.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs flex items-center gap-1.5 transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share URL</span>
                      </>
                    )}
                  </button>
                </div>

                {/* SVS Frame Capture & Scientific Data Export */}
                <div className="p-2.5 rounded-md bg-slate-950/65 border border-slate-800/90 space-y-2">
                  <span className="section-kicker block">SVS Frame &amp; Mission Data Export</span>
                  <button
                    type="button"
                    onClick={handleCapturePngSnapshot}
                    className="w-full py-1.5 px-2.5 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>
                      {snapshotStatus === 'saved'
                        ? 'PNG Snapshot Downloaded'
                        : snapshotStatus === 'unavailable'
                        ? 'Switch to 3D View for PNG'
                        : 'Capture Annotated 3D PNG'}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        exportMissionReportJson(evaluation, {
                          startDateStr,
                          durationDays,
                          launchSlipDays,
                          arrayType,
                          arrayAreaM2,
                          commsMarginDeg,
                          measurePoints,
                        })
                      }
                      className="py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-mono flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileJson className="w-3.5 h-3.5 text-sky-400" />
                      <span>Report JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        exportTimelineCsv(selectedSiteId, startDateStr, evaluation.timeline)
                      }
                      className="py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-mono flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Timeline CSV</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="section-kicker block">Saved Bookmarks</span>
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No bookmarks saved yet. Save any site, launch slip, and projection combination
                      for rapid comparison.
                    </p>
                  ) : (
                    bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="p-2.5 rounded bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSiteId(bm.siteId);
                            setStartDateStr(bm.startDateStr);
                            setLaunchSlipDays(bm.launchSlipDays);
                            setProjection(bm.projection);
                          }}
                          className="text-left min-w-0 flex-1"
                        >
                          <div className="text-xs font-medium text-slate-100 truncate">
                            {bm.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            Slip {bm.launchSlipDays >= 0 ? `+${bm.launchSlipDays}d` : `${bm.launchSlipDays}d`} • {bm.projection}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBookmarks((prev) => prev.filter((item) => item.id !== bm.id))
                          }
                          aria-label="Delete bookmark"
                          className="p-1 text-slate-500 hover:text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* PANEL 5: DUAL SCENARIO & 4-SITE TRADE STUDY */}
            {activePanel === 'compare' && (
              <div className="space-y-4">
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
                  onApplyPreset={(a, sa, b, sb) => {
                    setSelectedSiteId(a);
                    setLaunchSlipDays(sa);
                    setSiteBId(b);
                    setSlipBDays(sb);
                  }}
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
              </div>
            )}

            {/* PANEL 6: SCIENCE & FLIGHT RULES GUIDE */}
            {activePanel === 'guide' && (
              <div className="space-y-3 text-xs">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTutorialOpen(true)}
                    className="flex-1 py-1.5 px-2.5 rounded bg-amber-500/20 border border-amber-400/50 text-amber-300 font-medium flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Guided Tour</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualOpen(true)}
                    className="flex-1 py-1.5 px-2.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-medium flex items-center justify-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Ops Manual</span>
                  </button>
                </div>

                <div className="p-3 rounded bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="section-kicker block">Grazing Solar Geometry (1.54° Tilt)</span>
                  <p className="text-slate-300 leading-relaxed">
                    Because the Moon&apos;s obliquity is only 1.54°, polar sunlight travels nearly
                    horizontally. Elevated rims like Shackleton Ridge capture &gt;85% illumination
                    while adjacent floors remain permanently shadowed below 45 K.
                  </p>
                </div>

                <div className="p-3 rounded bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <span className="section-kicker block">Flight Rules &amp; Survival Thresholds</span>
                  <ul className="space-y-1 text-slate-300 font-mono text-[11px]">
                    <li>• Max Battery Eclipse: &le; 50.0 hours</li>
                    <li>• Cryogenic PSR Limit: &ge; 70.0 K</li>
                    <li>• HLS Safe Landing Slope: &lt; 5.0°</li>
                  </ul>
                </div>
              </div>
            )}
          </SlideOutDrawer>

          {/* Floating Color Bar Legend for Active Continuous Layers */}
          {projection !== '2d_polar' && <FloatingColorBar layers={layers} />}

          <BottomHudOverlays
            site={evaluation.site}
            kpis={evaluation.kpis}
            cursor={activeCursor}
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
            patchSizeKm={evaluation.terrain_grid.patch_size_km}
          />
        </>
      ) : (
        /* SVS CLEAN PRESENTATION OVERLAY */
        <div className="fixed inset-0 pointer-events-none z-40 flex flex-col justify-between p-6">
          <div className="flex items-start justify-between">
            <div className="hud-panel rounded-md px-4 py-2.5">
              <div className="section-kicker text-sky-400">NASA LOLA / DIVINER / JPL EPHEMERIS</div>
              <h1 className="text-base font-semibold text-white mt-0.5">{evaluation.site.name}</h1>
              <div className="text-xs font-mono text-slate-300 mt-0.5 tabular-nums">
                {evaluation.site.lat_deg.toFixed(2)}°, {evaluation.site.lon_deg.toFixed(2)}°E •{' '}
                {currentStep?.timestamp_utc.replace('T', ' ').slice(0, 16)} UTC
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPresentationMode(false)}
              className="pointer-events-auto hud-panel rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 hover:text-white border-slate-600"
            >
              Exit Presentation [Esc]
            </button>
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            LUNA-NAV • Selenographic Illumination &amp; Terrain Visualization
          </div>
        </div>
      )}

      <InteractiveTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onApplyStepAction={(stepIdx: number) => {
          if (stepIdx === 0) setActivePanel('compare');
          else if (stepIdx === 1) setIsPlaying(true);
          else if (stepIdx === 2)
            setArrayType((p) =>
              p === 'vertical_cylindrical' ? 'horizontal_deck' : 'vertical_cylindrical'
            );
          else if (stepIdx === 3) {
            setActivePanel('compare');
            handleLoadReferencePreset();
          }
        }}
      />
      <OperationsManualModal open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}

export default App;