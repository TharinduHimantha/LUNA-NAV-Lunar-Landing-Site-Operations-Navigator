import type { TourStep } from '../../types/workbench';

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to LUNA-NAV',
    body: 'Welcome to LUNA-NAV. This one-minute tour shows how to explore lunar south-pole landing sites: terrain, sunlight, shadows and Earth visibility. It can be skipped at any time.',
    targetSelector: null,
    placement: 'center',
    beforeAction: ({ setActivePanel, setProjection }) => {
      setActivePanel(null);
      setProjection('3d_terrain');
    },
  },
  {
    id: 'viewport',
    title: '3D LOLA Terrain Viewport',
    body: 'This is the 3D terrain built from NASA LOLA elevation data. Drag to orbit, scroll to zoom, and hover for live coordinates, elevation, and slope. Top-right buttons toggle PSR cold traps, Z-exaggeration, and camera reset.',
    targetSelector: '[data-tour="viewport"]',
    placement: 'center',
    beforeAction: ({ setActivePanel, setProjection }) => {
      setActivePanel(null);
      setProjection('3d_terrain');
    },
  },
  {
    id: 'rail',
    title: 'Workbench Tool Rail',
    body: 'Every tool lives here. Click an icon or press S, L, T, B, C or G to open a panel, and Esc to collapse it.',
    targetSelector: '[data-tour="rail"]',
    placement: 'right',
    shortcutChips: [
      { key: 'S', label: 'Sites' },
      { key: 'L', label: 'Layers' },
      { key: 'T', label: 'Tools' },
      { key: 'B', label: 'Export' },
      { key: 'C', label: 'Compare' },
      { key: 'G', label: 'Guide' },
    ],
    beforeAction: ({ setActivePanel }) => {
      setActivePanel(null);
    },
  },
  {
    id: 'sites',
    title: 'Sites & Mission Epoch',
    body: 'Choose a curated site or enter custom coordinates, then set the start date, duration, launch slip and solar-array type. Results refresh automatically.',
    targetSelector: '[data-tour="drawer"]',
    placement: 'right',
    beforeAction: ({ setActivePanel }) => {
      setActivePanel('sites');
    },
  },
  {
    id: 'layers',
    title: 'Scientific Layers',
    body: 'Switch layers on and off, reorder the stack, adjust opacity and data stretch, and toggle contour lines and the selenographic grid.',
    targetSelector: '[data-tour="drawer"]',
    placement: 'right',
    beforeAction: ({ setActivePanel }) => {
      setActivePanel('layers');
    },
  },
  {
    id: 'tools',
    title: 'Geodesic Tools & Profile',
    body: 'Pick Inspect, Distance, Area, Circle or Profile, then click the terrain to place points. Profile plots elevation and slope along your line. Backspace undoes the last point.',
    targetSelector: '[data-tour="drawer"]',
    placement: 'right',
    beforeAction: ({ setActivePanel }) => {
      setActivePanel('tools');
    },
  },
  {
    id: 'compare',
    title: 'Trade Comparator',
    body: 'Compare Scenario A and B side by side across sites, launch slips, illumination, Earth link and eclipse duration, or pin up to four scenarios in the trade matrix.',
    targetSelector: '[data-tour="drawer"]',
    placement: 'right',
    beforeAction: ({ setActivePanel }) => {
      setActivePanel('compare');
    },
  },
  {
    id: 'projection',
    title: 'Projection & Camera Framing',
    body: 'Switch between 3D Terrain, 2D Polar radar and a split view. In 3D, the Orbit, Nadir and Oblique presets reframe the camera instantly.',
    targetSelector: '[data-tour="projection"]',
    placement: 'bottom',
    beforeAction: ({ setActivePanel, setProjection }) => {
      setActivePanel(null);
      setProjection('3d_terrain');
    },
  },
  {
    id: 'time-dock',
    title: 'Mission Timeline Control',
    body: 'Press Space to play the mission timeline, drag the scrubber, or use the arrow keys to step. Sun, shadows and Earth visibility update with every step.',
    targetSelector: '[data-tour="time-dock"]',
    placement: 'top',
    beforeAction: ({ setActivePanel }) => {
      setActivePanel(null);
    },
  },
  {
    id: 'export',
    title: 'Share, Export & Present',
    body: 'Save bookmarks, copy a shareable link, download an annotated PNG, or export JSON or CSV. Present (top-right) opens a clean NASA view. Replay anytime from Science Guide.',
    targetSelector: '[data-tour="drawer"]',
    placement: 'right',
    beforeAction: ({ setActivePanel }) => {
      setActivePanel('bookmarks');
    },
  },
];