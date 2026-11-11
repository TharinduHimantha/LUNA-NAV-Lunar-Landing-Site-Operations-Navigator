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
      className="mx-4 mt-3 bg-gradient-to-r from-amber-950/30 via-[#111827] to-sky-950/30 border border-amber-500/40 rounded-xl p-3.5 shadow-lg"
    >
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
            Educator & Public Explorer Mode — Interactive Lunar South Pole Physics Guide
          </h2>
        </div>
        <span className="text-[11px] font-mono text-gray-400">
          Active Site: <strong className="text-white">{site.name}</strong> ({site.lat_deg}°)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        {/* Card 1: Grazing 360° Sun */}
        <div className="bg-[#0B0F19]/90 border border-gray-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1">
              <Sun className="w-3.5 h-3.5" />
              1. Why the Sun Circles the Horizon
            </div>
            <p className="text-gray-300 text-[11px] leading-relaxed">
              The Moon’s rotational axis is tilted by only <strong>1.54°</strong> to the ecliptic (compared to Earth’s 23.4°). At the South Pole (-89.5°), the Sun never rises high overhead—it skims horizontally around the compass (0°→360°) at grazing angles of <strong>-1.5° to +1.9°</strong>!
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800/80 flex justify-between items-center">
            <button
              type="button"
              onClick={() => onSelectSiteId('apollo_11')}
              className="text-[11px] font-mono text-amber-400 hover:underline flex items-center gap-1"
            >
              Compare w/ Apollo 11 (Equator) <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 2: Optical Libration of Earth */}
        <div className="bg-[#0B0F19]/90 border border-gray-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-sky-300 mb-1">
              <Orbit className="w-3.5 h-3.5" />
              2. What is Earth Libration?
            </div>
            <p className="text-gray-300 text-[11px] leading-relaxed">
              Even though the Moon is tidally locked to Earth, its elliptical and inclined orbit causes Earth to weave an apparent figure-loop in the lunar sky (<strong>±6.7° latitude, ±7.9° longitude</strong>) every 27.3 days. At the South Pole, Earth bobs up and down behind mountains!
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800/80 flex justify-between items-center">
            <button
              type="button"
              onClick={() => onSelectSiteId('malapert_massif')}
              className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1"
            >
              View Malapert Relay Peak <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Vertical vs Flat Solar Panels */}
        <div className="bg-[#0B0F19]/90 border border-gray-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-emerald-300 mb-1">
              <Zap className="w-3.5 h-3.5" />
              3. Why Flat Solar Panels Fail at 89°S
            </div>
            <p className="text-gray-300 text-[11px] leading-relaxed">
              A flat horizontal deck panel collects power proportional to <code>sin(El)</code>. At a 1.5° grazing Sun angle, <code>sin(1.5°) = 0.026</code> (97% power loss!). A <strong>Vertical 360° Cylinder</strong> intercepts grazing rays at <code>cos(1.5°) = 0.999</code>!
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800/80 flex justify-between items-center">
            <button
              type="button"
              onClick={() =>
                onSelectArrayType(
                  arrayType === 'horizontal_deck' ? 'vertical_cylindrical' : 'horizontal_deck'
                )
              }
              className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
            >
              Toggle {arrayType === 'horizontal_deck' ? 'Vertical Mast' : 'Flat Deck'} to Test{' '}
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 4: Peaks of Eternal Light vs Cold Traps */}
        <div className="bg-[#0B0F19]/90 border border-gray-800 rounded-lg p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-rose-300 mb-1">
              <Mountain className="w-3.5 h-3.5" />
              4. Peaks of Light vs. Cold Traps
            </div>
            <p className="text-gray-300 text-[11px] leading-relaxed">
              Adjacent to sunlit ridges like Shackleton (+2,150 m) lie deep impact basins like <strong>Haworth Crater (-1,800 m)</strong> whose 4°–6° walls block the low Sun permanently, creating cryogenic cold traps that preserve ancient water ice.
            </p>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800/80 flex justify-between items-center">
            <button
              type="button"
              onClick={() => onSelectSiteId('haworth_floor')}
              className="text-[11px] font-mono text-rose-400 hover:underline flex items-center gap-1"
            >
              Jump Inside Haworth PSR <ArrowRight className="w-3 h-3" />
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
      title: 'Step 1: Evaluate the Artemis III Primary Candidate (Shackleton Ridge)',
      badge: 'SITE SELECTION & 3D DEM',
      body: 'We begin at Shackleton Connecting Ridge (-89.54°S, +2,150m elevation). Because this narrow knife-edge ridge towers above surrounding craters, its local horizon mask H(Az) is under 1.8° across most compass directions—allowing near-continuous solar power during the southern lunar summer.',
      actionLabel: 'Load Shackleton Ridge (Dec 1, 2026)',
    },
    {
      title: 'Step 2: Read the 360° Polar Azimuthal Sky-Chart & Grazing Shadows',
      badge: 'GEOMETRIC HORIZON RAY-CASTER',
      body: 'Look at the 360° Polar Azimuthal Radar on the right and the 3D Terrain Viewport on the left. The gold circle traces the Sun’s 360° path around the horizon, while the cyan loop shows Earth’s 27.3-day optical libration wobble above and below the northern crater ridge.',
      actionLabel: 'Animate Mission Scrubber & Inspect Radar',
    },
    {
      title: 'Step 3: Test Solar Array Geometry (Vertical Cylinder vs. Flat Deck)',
      badge: 'HARDWARE POWER MODEL',
      body: 'Watch the "Array Power" KPI card when we switch from a Vertical Cylindrical Mast (cos El) to a traditional Horizontal Flat Deck (sin El). At a 1.5° grazing polar Sun angle, a flat deck loses >96% of its output, dropping from ~4.5 kW to ~0.12 kW!',
      actionLabel: 'Test Hardware Array Geometry Impact',
    },
    {
      title: 'Step 4: Simulate a Launch Slip & Compare Backup Sites',
      badge: 'LAUNCH SLIP & TRADE-OFF MATRIX',
      body: 'What if your rocket launch slips by 10 days on a rugged rim like Nobile Crater? Use the Launch Schedule Slip slider (-14d to +28d) to spot "schedule cliffs" where eclipse duration exceeds the lander’s 50-hour battery limit, and use the 4-Site Trade-Off Matrix to pick the optimal backup site.',
      actionLabel: 'Load 4-Site Artemis Trade Study Preset',
    },
  ];

  const cur = steps[step];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-amber-500/50 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
              Interactive Mission Planner Walkthrough ({step + 1} / {steps.length})
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <span className="inline-block px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[10px] font-mono font-bold">
            {cur.badge}
          </span>
          <h3 className="text-base font-bold text-white">{cur.title}</h3>
          <p className="text-xs text-gray-300 leading-relaxed">{cur.body}</p>
        </div>

        <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">Apply live interactive action to dashboard:</span>
          <button
            type="button"
            onClick={() => onApplyStepAction(step)}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold transition flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {cur.actionLabel}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-800">
          <div className="flex gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setStep(idx)}
                className={`w-2.5 h-2.5 rounded-full transition ${
                  idx === step ? 'bg-amber-400 scale-110' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 text-xs text-gray-300 hover:text-white"
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
                className="px-4 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition"
              >
                Finish & Explore
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
      <div className="bg-[#111827] border border-gray-700 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                LUNA-NAV // User Guide, Mission Operations & Technical Engineering Manual
              </h2>
              <p className="text-[11px] text-gray-400">
                Complete Reference Documentation for Mission Planners, Engineers, and Educators
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-[#0B0F19] px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setTab('user')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition ${
              tab === 'user'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            1. User Guide & Interface Walkthrough
          </button>
          <button
            type="button"
            onClick={() => setTab('ops')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition ${
              tab === 'ops'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            2. Flight Operations & Decision Playbook
          </button>
          <button
            type="button"
            onClick={() => setTab('tech')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-bold border-b-2 transition ${
              tab === 'tech'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            3. Astrodynamics & Technical Architecture
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-gray-300 leading-relaxed">
          {tab === 'user' && (
            <div className="space-y-4">
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-amber-300 font-mono">
                  Welcome to LUNA-NAV (Lunar Landing Site & Operations Navigator)
                </h3>
                <p>
                  LUNA-NAV is an interactive full-stack decision-support tool built for the <strong>2026 NASA Space Apps Challenge</strong>. It enables mission planners, aerospace engineers, educators, and students to evaluate how local lunar topography interacts with topocentric Sun and Earth trajectories to govern <strong>Solar Electrical Power</strong> and <strong>Direct-to-Earth (DTE) Communications</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white font-mono">Module A: Scenario & Hardware Bar</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li><strong>Site Selector:</strong> Choose from 6 scientifically calibrated LOLA sites (Shackleton Ridge, Malapert Massif, Leibnitz Beta, Nobile Rim, Haworth Cold Trap, Apollo 11) or click <em>Custom Coordinates</em> to pick any location on the South Pole map.</li>
                    <li><strong>Landing Date & Duration:</strong> Pick any UTC landing date and evaluate 14-day, 30-day (1 full synodic lunar day), or 60-day surface stays.</li>
                    <li><strong>Hardware Config:</strong> Select Solar Array Geometry (Vertical 360° Cylinder, Dual-Axis Tracking, or Horizontal Flat Deck), Array Area (m²), and Antenna Multipath Clearance Margin (°).</li>
                  </ul>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white font-mono">Module B: Real-Time KPI & Countdown Strip</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li><strong>Solar Tracking & Sunset Countdown:</strong> Displays instantaneous Sun Elevation, clearance above the crater rim, and live countdown hours until Sunset or Sunrise.</li>
                    <li><strong>Earth DTE Link & Countdown:</strong> Displays Earth Elevation, optical libration clearance, and hours until Earthset or Earthrise.</li>
                    <li><strong>Battery Stress (Max Continuous Eclipse):</strong> Flags in crimson if any continuous shadow period exceeds the lander's 50.0-hour battery limit.</li>
                  </ul>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white font-mono">Module C: 3D Lunar Terrain & Shadow Simulator</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li><strong>Real-Time Grazing Shadows:</strong> Scrubbing the timeline moves the directional Sun light to exact topocentric <code>(Az, El)</code> angles, casting razor-long shadows across the 64×64 LOLA DEM mesh.</li>
                    <li><strong>Camera Modes:</strong> Switch between <em>Orbital Tactical View</em> (bird's-eye) and <em>Lander Horizon View</em> (surface perspective).</li>
                  </ul>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-white font-mono">Module D & E: 360° Polar Radar & Scrubber Dock</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li><strong>360° Polar Azimuthal Sky-Chart:</strong> Plots the gray 360° mountain skyline <code>H(Az)</code> against the gold 360° Sun track and cyan Earth libration ellipse.</li>
                    <li><strong>Launch Slip Simulator (-14d to +28d):</strong> Drag the slip slider to test rocket launch delays and spot "schedule cliffs."</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {tab === 'ops' && (
            <div className="space-y-4">
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-sky-300 font-mono">
                  Mission Flight Rules & Operational Decision Playbook
                </h3>
                <p>
                  Use these operational workflows during pre-mission site selection, launch window analysis, and contingency launch-slip replanning:
                </p>
              </div>

              <div className="space-y-3">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5">
                  <h4 className="font-bold text-amber-300 font-mono mb-1">
                    Workflow 1: Evaluating Battery Survival Across Eclipse Windows
                  </h4>
                  <p>
                    1. Select your candidate site and target landing date.<br />
                    2. Check Card 5 (<strong>Max Eclipse</strong>): Typical commercial (CLPS) and crewed landers carry 40–50 hours of rechargeable lithium-ion battery capacity.<br />
                    3. Look at the <strong>Operational Status Ribbon</strong> (Track 4): Red segments indicate full blackout, while Cyan segments indicate DTE comms during solar eclipse (high battery drain). Click any red segment to inspect which mountain peak on the 360° Polar Sky-Chart is blocking the Sun.
                  </p>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5">
                  <h4 className="font-bold text-sky-300 font-mono mb-1">
                    Workflow 2: Launch Delay ("Schedule Cliff") Contingency Analysis
                  </h4>
                  <p>
                    1. In the bottom dock, inspect the <strong>Schedule Cliff Sensitivity Curve (-14d to +28d)</strong>.<br />
                    2. Drag the <strong>Launch Schedule Slip Simulator</strong> slider to match a proposed launch scrub (e.g., +8 days).<br />
                    3. If the primary site drops from <code>OPTIMAL</code> to <code>MARGINAL</code> or <code>CRITICAL RISK</code>, click <strong>Pin to Trade-Off Matrix</strong> and compare against backup sites (such as Malapert Massif or Shackleton Ridge) on the delayed date.
                  </p>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5">
                  <h4 className="font-bold text-emerald-300 font-mono mb-1">
                    Workflow 3: Direct-to-Earth (DTE) vs. Orbital Relay Sizing
                  </h4>
                  <p>
                    Because Earth’s optical libration causes it to bob between -7° and +7° selenographic latitude every 27.3 days, sites on the far side of local ridges experience periodic 6-to-12 day DTE blackouts. Increase the <strong>Antenna Clearance Margin</strong> in the Hardware popover (from 1.0° to 2.5°) to verify X-band/Ka-band link resilience against regolith multipath interference.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'tech' && (
            <div className="space-y-4">
              <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-emerald-300 font-mono">
                  Mathematical Models, Astrodynamics & System Architecture
                </h3>
                <p>
                  LUNA-NAV is built as a zero-stub monolithic architecture: a <strong>Python FastAPI</strong> physics backend (<code>backend/physics_engine.py</code>, <code>backend/sites_catalog.py</code>) paired with a <strong>React 19 + TypeScript + Three.js + Recharts</strong> frontend.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-amber-300">1. Selenographic Frame & Ephemeris</h4>
                  <p className="font-sans text-gray-300">
                    Computes J2000 ICRF vectors via NASA JPL <code>de421.bsp</code> (<code>skyfield</code>) and transforms into the IAU Mean Earth / Polar Axis (ME) frame via Cassini rotational & physical libration harmonics <code>(E1..E10)</code>, projecting onto the local East-North-Up (ENU) tangent plane.
                  </p>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-sky-300">2. 360° Ray-Caster & Curvature Drop</h4>
                  <p className="font-sans text-gray-300">
                    For each azimuth <code>Az = 0°..359°</code>, ray-marches outward across the 64×64 DEM <code>Z(x, y)</code> with bilinear interpolation and lunar sphere drop-off correction:<br />
                    <code>H(Az) = max arctan((Z(d) - Z0 - d²/(2·R_moon)) / d)</code>
                  </p>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-emerald-300">3. Partial Solar Limb & Array Power</h4>
                  <p className="font-sans text-gray-300">
                    Accounts for the finite solar disk semi-diameter <code>r_sun = 0.266°</code> during multi-hour polar grazing eclipses. Electrical output:<br />
                    <code>P_kW = (1361 · f_sun · η_inc · A_array · 0.28) / 1000</code>
                  </p>
                </div>

                <div className="bg-[#0B0F19] border border-gray-800 rounded-xl p-3.5 space-y-1.5">
                  <h4 className="font-bold text-purple-300">4. REST Endpoints & LRU Caching</h4>
                  <p className="font-sans text-gray-300">
                    • <code>GET /api/sites</code> — Curated LOLA catalog<br />
                    • <code>POST /api/evaluate</code> — Full 3D DEM + timeline<br />
                    • <code>POST /api/compare</code> — Multi-scenario matrix<br />
                    • <code>POST /api/launch-slip-sweep</code> — 22-point slip curve
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400 transition"
          >
            Close Manual
          </button>
        </div>
      </div>
    </div>
  );
};
