import React, { useState } from 'react';
import {
  GraduationCap,
  Sun,
  Orbit,
  Zap,
  Mountain,
  ArrowRight,
  CheckCircle,
  X,
  BookOpen,
  Sparkles,
  Cpu,
  Terminal,
} from 'lucide-react';
import type { LunarSite, SolarArrayType } from '../types/mission';

interface EducatorOverlayProps {
  visible: boolean;
  site: LunarSite;
  arrayType: SolarArrayType;
  onSelectSiteId: (id: string) => void;
  onSelectArrayType: (t: SolarArrayType) => void;
}

export const EducatorOverlay: React.FC<EducatorOverlayProps> = ({
  visible,
  site,
  arrayType,
  onSelectSiteId,
  onSelectArrayType,
}) => {
  if (!visible) return null;

  return (
    <section
      aria-label="Interactive Educator Physics Explainers"
      className="mx-4 mt-3 bg-gradient-to-r from-amber-950/30 via-[#0F172A] to-sky-950/30 border border-amber-500/40 rounded-xl p-4 shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
            Educator &amp; Explorer Mode — Lunar South Pole Physics Reference
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Active Site: <strong className="text-white">{site.name}</strong> ({site.lat_deg}°)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
        {/* Card 1: Grazing 360° Sun */}
        <div className="bg-[#080C14]/95 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
              <Sun className="w-3.5 h-3.5" />
              <span>1. Why the Sun Circles the Horizon</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              The Moon’s rotational axis is tilted by only <strong>1.54°</strong> to the ecliptic (compared to Earth’s 23.4°). At the South Pole (-89.5°), the Sun never rises high overhead—it skims horizontally around the compass (0°→360°) at grazing angles of <strong>-1.5° to +1.9°</strong>.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onSelectSiteId('apollo_11')}
              className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
            >
              <span>Compare w/ Apollo 11 (Equator)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 2: Optical Libration of Earth */}
        <div className="bg-[#080C14]/95 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sky-300 mb-1">
              <Orbit className="w-3.5 h-3.5" />
              <span>2. What is Earth Libration?</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Although the Moon is tidally locked to Earth, its elliptical and inclined orbit causes Earth to trace an apparent loop in the lunar sky (<strong>±6.7° latitude, ±7.9° longitude</strong>) every 27.3 days. At the South Pole, Earth bobs above and below northern crater ridges.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onSelectSiteId('malapert_massif')}
              className="text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 transition"
            >
              <span>Inspect Malapert Relay Peak</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Vertical vs Flat Solar Panels */}
        <div className="bg-[#080C14]/95 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-emerald-300 mb-1">
              <Zap className="w-3.5 h-3.5" />
              <span>3. Why Flat Solar Panels Fail at 89°S</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              A flat horizontal deck collects power proportional to <code>sin(El)</code>. At a 1.5° grazing Sun angle, <code>sin(1.5°) = 0.026</code> (over 97% cosine loss). A <strong>Vertical 360° Cylinder</strong> intercepts grazing rays at <code>cos(1.5°) = 0.999</code>.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() =>
                onSelectArrayType(
                  arrayType === 'horizontal_deck' ? 'vertical_cylindrical' : 'horizontal_deck'
                )
              }
              className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
            >
              <span>
                Switch to {arrayType === 'horizontal_deck' ? 'Vertical Mast' : 'Flat Deck'}
              </span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 4: Peaks of Eternal Light vs Cold Traps */}
        <div className="bg-[#080C14]/95 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-rose-300 mb-1">
              <Mountain className="w-3.5 h-3.5" />
              <span>4. Peaks of Light vs. Cold Traps</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Adjacent to sunlit ridges like Shackleton (+2,150 m) lie deep impact basins like <strong>Haworth Crater (-1,800 m)</strong> whose 4°–6° walls block the low Sun permanently, creating cryogenic cold traps (&lt;45 K) that preserve ancient water ice.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onSelectSiteId('haworth_floor')}
              className="text-[11px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
            >
              <span>Jump Inside Haworth PSR</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

interface InteractiveTutorialModalProps {
  open: boolean;
  onClose: () => void;
  onApplyStepAction: (actionStep: number) => void;
}

export const InteractiveTutorialModal: React.FC<InteractiveTutorialModalProps> = ({
  open,
  onClose,
  onApplyStepAction,
}) => {
  const [step, setStep] = useState(0);
  if (!open) return null;

  const steps = [
    {
      title: 'Step 1: Compare Artemis III Candidates Side-by-Side',
      badge: 'TAB 2 • SITE COMPARATOR',
      body: 'In the Site Comparator tab, we evaluate Shackleton Connecting Ridge (-89.54°S, +2,150 m) directly against Malapert Massif. The Executive Verdict banner synthesizes solar power hours, Direct-to-Earth link uptime, and battery survival margins.',
      actionLabel: 'Open Comparator (Shackleton vs Malapert)',
    },
    {
      title: 'Step 2: Inspect 3D Grazing Shadows & 360° Polar Radar',
      badge: 'TAB 1 • MISSION EXPLORER',
      body: 'Switch to Mission Explorer to inspect the 128×128 LOLA terrain mesh and floating glassmorphism HUD. Click anywhere along the gold solar track on the 360° Polar Horizon Radar to jump straight to that mission hour.',
      actionLabel: 'Open Explorer & Animate Shadows',
    },
    {
      title: 'Step 3: Test Solar Array Geometry (Vertical Mast vs. Flat Deck)',
      badge: 'HARDWARE POWER MODEL',
      body: 'Watch the Array Power telemetry card when toggling from a Vertical Cylindrical Mast (cos El) to a Horizontal Flat Deck (sin El). At a 1.5° grazing polar Sun angle, a flat deck loses over 96% of its electrical output.',
      actionLabel: 'Toggle Array Geometry Live',
    },
    {
      title: 'Step 4: Simulate Launch Slips & Rank 4 Backup Sites',
      badge: 'TAB 3 • LAUNCH WINDOW & TRADE STUDY',
      body: 'Open the Launch Window & Trade Study tab to drag the Launch Schedule Slip slider (-14d to +28d), detect schedule cliffs where darkness exceeds the 50-hour battery survival rule, and rank up to 4 pinned candidates.',
      actionLabel: 'Load 4-Site Artemis Trade Study',
    },
  ];

  const cur = steps[step];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-amber-500/50 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
              Guided Mission Walkthrough ({step + 1} / {steps.length})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <span className="inline-block px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-mono font-bold">
            {cur.badge}
          </span>
          <h3 className="text-base font-bold text-white">{cur.title}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{cur.body}</p>
        </div>

        <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Apply live action to workspace:</span>
          <button
            type="button"
            onClick={() => onApplyStepAction(step)}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold transition flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{cur.actionLabel}</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                aria-label={`Jump to tutorial step ${idx + 1}`}
                className={`w-2.5 h-2.5 rounded-full transition ${
                  idx === step ? 'bg-amber-400 scale-110' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white transition"
              >
                Previous
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  onApplyStepAction(step);
                  setStep(step + 1);
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onApplyStepAction(step);
                  onClose();
                }}
                className="px-4 py-1.5 rounded-lg bg-emerald-400 text-slate-950 font-bold text-xs hover:bg-emerald-300 transition"
              >
                Finish &amp; Explore
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface OperationsManualModalProps {
  open: boolean;
  onClose: () => void;
}

export const OperationsManualModal: React.FC<OperationsManualModalProps> = ({
  open,
  onClose,
}) => {
  const [tab, setTab] = useState<'user' | 'ops' | 'tech'>('user');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0F172A] border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                LUNA-NAV // Mission Operations &amp; Technical Engineering Manual
              </h2>
              <p className="text-[11px] text-slate-400">
                Reference Documentation for Flight Planners, Systems Engineers, and Educators
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-slate-800 bg-[#080C14] px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setTab('user')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition ${
              tab === 'user'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>1. Workspace &amp; Interface Guide</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ops')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition ${
              tab === 'ops'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>2. Flight Operations Playbook</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('tech')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition ${
              tab === 'tech'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>3. Astrodynamics &amp; Architecture</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300 leading-relaxed">
          {tab === 'user' && (
            <div className="space-y-4">
              <div className="bg-[#080C14] border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-amber-300 font-mono">
                  LUNA-NAV 4-Tab Mission Operations Suite
                </h3>
                <p>
                  LUNA-NAV evaluates how local lunar topography interacts with topocentric Sun and Earth trajectories to govern <strong>Solar Electrical Power</strong>, <strong>Battery Eclipse Survival</strong>, and <strong>Direct-to-Earth (DTE) Communications</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white font-mono">1. Mission Explorer (Tab 1)</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <strong>3D Terrain &amp; Floating HUD:</strong> Scrubbing the global transport dock updates directional grazing shadows across the 128×128 LOLA DEM mesh. Use top-right HUD pills to toggle PSR cold traps or switch between Orbit and Horizon camera views.
                    </li>
                    <li>
                      <strong>360° Polar Horizon Radar:</strong> Click anywhere along the gold solar trajectory to scrub directly to that mission hour.
                    </li>
                  </ul>
                </div>

                <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white font-mono">2. Site Comparator (Tab 2)</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <strong>Dual Synchronized Viewports:</strong> Evaluates Scenario A (Gold) and Scenario B (Cyan) side-by-side at identical Mission Elapsed Time (MET).
                    </li>
                    <li>
                      <strong>Executive Verdict &amp; Delta Table:</strong> Automatically identifies category winners and flags battery or cryogenic flight-rule violations.
                    </li>
                  </ul>
                </div>

                <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white font-mono">3. Launch Window &amp; Trade Study (Tab 3)</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <strong>Launch Slip Simulator:</strong> Test launch delays from -14d to +28d to spot schedule cliffs.
                    </li>
                    <li>
                      <strong>4-Scenario Pinboard:</strong> Pin up to 4 candidate configurations or load the Artemis 4-Site Reference Trade Study.
                    </li>
                  </ul>
                </div>

                <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white font-mono">Keyboard Shortcuts</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono text-[11px]">
                    <li>
                      <strong>1 / 2 / 3 / 4:</strong> Switch workspace tabs
                    </li>
                    <li>
                      <strong>Space:</strong> Play / Pause timeline playback
                    </li>
                    <li>
                      <strong>Left / Right Arrow:</strong> Step backward / forward
                    </li>
                    <li>
                      <strong>R:</strong> Reset timeline to Hour 0
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === 'ops' && (
            <div className="space-y-3">
              <div className="bg-[#080C14] border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-sky-300 font-mono">
                  Mission Flight Rules &amp; Operational Decision Playbook
                </h3>
                <p>
                  Apply these standard flight-rule checks during pre-mission site selection, launch window sizing, and contingency replanning:
                </p>
              </div>

              <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5">
                <h4 className="font-bold text-amber-300 font-mono mb-1">
                  Rule 1: Battery Survival Across Continuous Eclipse (&le;50.0h)
                </h4>
                <p>
                  Standard CLPS and crewed lunar landers carry 40–50 hours of rechargeable battery survival capacity. Inspect the <strong>Max Eclipse</strong> KPI card and click any crimson segment in the Operational Windows ribbon to pinpoint which crater wall blocks the Sun.
                </p>
              </div>

              <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5">
                <h4 className="font-bold text-sky-300 font-mono mb-1">
                  Rule 2: Launch Delay (&ldquo;Schedule Cliff&rdquo;) Contingency
                </h4>
                <p>
                  If a launch slip pushes your primary site past its seasonal illumination window into a &gt;50h eclipse, switch to <strong>Site Comparator</strong> or <strong>Launch Window &amp; Trade Study</strong> to evaluate backup peaks such as Malapert Massif or Shackleton Ridge on the slipped date.
                </p>
              </div>

              <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5">
                <h4 className="font-bold text-emerald-300 font-mono mb-1">
                  Rule 3: Direct-to-Earth (DTE) Multipath Clearance
                </h4>
                <p>
                  Because Earth oscillates ±6.7° in selenographic latitude over its 27.3-day nodical cycle, sites behind northern ridges experience periodic DTE blackouts. Adjust the <strong>DTE Antenna Margin</strong> in the Hardware popover (from 1.0° to 2.5°) to verify X/Ka-band link resilience.
                </p>
              </div>
            </div>
          )}

          {tab === 'tech' && (
            <div className="space-y-4">
              <div className="bg-[#080C14] border border-slate-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-emerald-300 font-mono">
                  Mathematical Models, Astrodynamics &amp; System Architecture
                </h3>
                <p>
                  LUNA-NAV pairs a <strong>Python FastAPI</strong> physics backend (<code>backend/physics_engine.py</code>, <code>backend/lola_dem.py</code>) with a <strong>React 19 + TypeScript + Three.js + Recharts</strong> mission console.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-amber-300">1. Selenographic Frame &amp; Ephemeris</h4>
                  <p className="font-sans text-slate-300">
                    Computes apparent Sun and Earth azimuth/elevation from JPL <code>de421.bsp</code> ephemerides transformed into the IAU Mean Earth / Polar Axis (ME) frame via Cassini rotational &amp; physical libration harmonics, projected onto the local East-North-Up (ENU) tangent plane.
                  </p>
                </div>

                <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-sky-300">2. 360° Ray-Caster &amp; Curvature Drop</h4>
                  <p className="font-sans text-slate-300">
                    For each azimuth <code>Az = 0°..359°</code>, ray-marches outward across the 128×128 LOLA DEM <code>Z(x, y)</code> with bilinear interpolation and lunar sphere drop-off correction:
                    <br />
                    <code>H(Az) = max arctan((Z(d) - Z0 - d²/(2·R_moon)) / d)</code>
                  </p>
                </div>

                <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-emerald-300">3. Partial Solar Limb &amp; Array Power</h4>
                  <p className="font-sans text-slate-300">
                    Models the finite solar disk semi-diameter <code>r_sun = 0.266°</code> during grazing polar eclipses. Electrical output:
                    <br />
                    <code>P_kW = (1361 · f_sun · η_inc · A_array · 0.28) / 1000</code>
                  </p>
                </div>

                <div className="bg-[#080C14] border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-indigo-300">4. REST Endpoints</h4>
                  <p className="font-sans text-slate-300">
                    • <code>GET /api/sites</code> — Curated LOLA site catalog
                    <br />
                    • <code>POST /api/evaluate</code> — 128×128 DEM + timeline
                    <br />
                    • <code>POST /api/compare_scenarios</code> — Dual A vs B trade delta
                    <br />
                    • <code>POST /api/launch-slip-sweep</code> — Slip sensitivity sweep
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-400 text-slate-950 font-bold text-xs hover:bg-sky-300 transition"
          >
            Close Manual
          </button>
        </div>
      </div>
    </div>
  );
};