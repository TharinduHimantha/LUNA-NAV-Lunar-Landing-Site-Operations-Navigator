import React from 'react';
import {
  Layers,
  Award,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import type { PinnedScenario } from '../types/mission';

interface ComparisonMatrixProps {
  pinnedScenarios: PinnedScenario[];
  onRemoveScenario: (id: string) => void;
  onPinCurrent: () => void;
  onLoadReferencePreset: () => void;
  isLoadingPreset: boolean;
}

export const ComparisonMatrix: React.FC<ComparisonMatrixProps> = ({
  pinnedScenarios,
  onRemoveScenario,
  onPinCurrent,
  onLoadReferencePreset,
  isLoadingPreset,
}) => {
  // Determine best scenario by composite viability score
  const bestScenarioId =
    pinnedScenarios.length > 0
      ? pinnedScenarios.reduce((best, cur) =>
          cur.evaluation.kpis.viability_score > best.evaluation.kpis.viability_score
            ? cur
            : best
        ).scenario_id
      : null;

  const barData = pinnedScenarios.map((s) => ({
    name: s.label,
    SunlightPct: s.evaluation.kpis.sunlight_percentage,
    DTECommsPct: s.evaluation.kpis.dte_comms_percentage,
    ViabilityScore: s.evaluation.kpis.viability_score,
    MaxEclipseHrs: s.evaluation.kpis.max_continuous_darkness_hours,
  }));

  return (
    <section className="bg-[#111827] border border-gray-800 rounded-xl p-4 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              Multi-Site & Schedule Trade-Off Matrix ({pinnedScenarios.length}/4 Pinned)
            </h2>
            <p className="text-[11px] text-gray-400">
              Compare primary vs. backup landing sites and launch slip dates side-by-side
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoadReferencePreset}
            disabled={isLoadingPreset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isLoadingPreset ? 'Computing 4 Reference Sites...' : 'Load 4-Site Artemis Trade Study Preset'}
          </button>

          {pinnedScenarios.length < 4 && (
            <button
              type="button"
              onClick={onPinCurrent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Pin Active Scenario
            </button>
          )}
        </div>
      </div>

      {pinnedScenarios.length === 0 ? (
        <div className="bg-[#0B0F19] border border-gray-800 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-gray-300">
            No scenarios pinned yet. Pin up to 4 site/date configurations or load the Artemis 4-Site Trade Study Preset.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={onPinCurrent}
              className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400 transition"
            >
              + Pin Current Active Site
            </button>
            <button
              type="button"
              onClick={onLoadReferencePreset}
              className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs hover:bg-amber-500/30 transition"
            >
              Load 4-Site Trade Study Preset
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Side-by-Side Scenario Cards / Table (8 cols) */}
          <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pinnedScenarios.map((scen) => {
              const isBest = scen.scenario_id === bestScenarioId;
              const k = scen.evaluation.kpis;
              return (
                <div
                  key={scen.scenario_id}
                  className={`rounded-xl p-3.5 border flex flex-col justify-between relative ${
                    isBest
                      ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-950/20'
                      : 'bg-[#0B0F19] border-gray-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        {isBest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold mb-1">
                            <Award className="w-3 h-3" /> RECOMMENDED SITE
                          </span>
                        )}
                        <h3 className="text-xs font-bold text-white font-mono leading-snug">
                          {scen.label}
                        </h3>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Start: {scen.evaluation.effective_start_utc.slice(0, 10)} (
                          {scen.evaluation.launch_slip_days >= 0
                            ? `+${scen.evaluation.launch_slip_days}d`
                            : `${scen.evaluation.launch_slip_days}d`}{' '}
                          slip)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveScenario(scen.scenario_id)}
                        className="text-gray-500 hover:text-red-400 p-1"
                        title="Remove Scenario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono border-t border-gray-800/80 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Viability:</span>
                        <span className="font-bold text-white">{k.viability_score.toFixed(1)} / 100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sunlight:</span>
                        <span className="text-amber-400 font-semibold">
                          {k.sunlight_percentage.toFixed(1)}% ({k.total_sunlight_hours.toFixed(0)}h)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">DTE Comms:</span>
                        <span className="text-sky-400 font-semibold">
                          {k.dte_comms_percentage.toFixed(1)}% ({k.total_dte_hours.toFixed(0)}h)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Joint Ops:</span>
                        <span className="text-emerald-400">{k.joint_window_percentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Max Eclipse:</span>
                        <span
                          className={
                            k.max_continuous_darkness_hours > 50
                              ? 'text-red-400 font-bold'
                              : 'text-emerald-300'
                          }
                        >
                          {k.max_continuous_darkness_hours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Avg Power:</span>
                        <span className="text-gray-200">{k.average_power_kw.toFixed(2)} kW</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-gray-400">VERDICT:</span>
                    {k.feasibility_verdict === 'OPTIMAL' && (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> OPTIMAL
                      </span>
                    )}
                    {k.feasibility_verdict === 'MARGINAL' && (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> MARGINAL
                      </span>
                    )}
                    {k.feasibility_verdict === 'CRITICAL_RISK' && (
                      <span className="text-red-400 font-bold flex items-center gap-1">
                        <XOctagon className="w-3 h-3" /> CRITICAL RISK
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparative Trade-Off Bar Chart (4 cols) */}
          <div className="xl:col-span-4 bg-[#0B0F19] border border-gray-800 rounded-xl p-3 h-64">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono mb-2">
              KPI Trade-Off Comparison
            </div>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 9 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 10 }} width={32} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace' }} />
                <Bar dataKey="SunlightPct" name="Sunlight %" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                <Bar dataKey="DTECommsPct" name="DTE Comms %" fill="#38BDF8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ViabilityScore" name="Viability Score" fill="#10B981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
};
