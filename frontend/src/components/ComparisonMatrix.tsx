import React, { useMemo } from 'react';
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
import { InfoTooltip } from './InfoTooltip';

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
  const bestScenarioId = useMemo(() => {
    if (pinnedScenarios.length === 0) return null;
    return pinnedScenarios.reduce((best, cur) =>
      cur.evaluation.kpis.viability_score > best.evaluation.kpis.viability_score
        ? cur
        : best
    ).scenario_id;
  }, [pinnedScenarios]);

  const barData = useMemo(
    () =>
      pinnedScenarios.map((s) => ({
        name: s.label,
        SunlightPct: s.evaluation.kpis.sunlight_percentage,
        DTECommsPct: s.evaluation.kpis.dte_comms_percentage,
        ViabilityScore: s.evaluation.kpis.viability_score,
        MaxEclipseHrs: s.evaluation.kpis.max_continuous_darkness_hours,
      })),
    [pinnedScenarios]
  );

  return (
    <section className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                4-Scenario Trade-Off Matrix ({pinnedScenarios.length}/4 Pinned)
              </h2>
              <InfoTooltip
                title="Multi-Site Backup & Slip Pinboard"
                content="Pin up to 4 site or launch-slip configurations to rank primary and backup landing candidates side-by-side across solar illumination, DTE link, and battery survival."
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Rank primary vs. backup landing sites and launch slip dates side-by-side
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLoadReferencePreset}
            disabled={isLoadingPreset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isLoadingPreset
                ? 'Computing 4 Reference Sites...'
                : 'Load 4-Site Artemis Trade Study'}
            </span>
          </button>

          {pinnedScenarios.length < 4 && (
            <button
              type="button"
              onClick={onPinCurrent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pin Active Scenario</span>
            </button>
          )}
        </div>
      </div>

      {pinnedScenarios.length === 0 ? (
        <div className="bg-[#080C14] border border-slate-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-sm text-slate-300">
            No scenarios pinned yet. Pin up to 4 site/date configurations or load the Artemis 4-Site Reference Trade Study.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onPinCurrent}
              className="px-4 py-2 rounded-lg bg-sky-400 text-slate-950 font-bold text-xs hover:bg-sky-300 transition"
            >
              + Pin Current Active Site
            </button>
            <button
              type="button"
              onClick={onLoadReferencePreset}
              disabled={isLoadingPreset}
              className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs hover:bg-amber-500/30 transition disabled:opacity-50"
            >
              Load 4-Site Trade Study Preset
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
          {/* Side-by-Side Scenario Cards (8 cols) */}
          <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pinnedScenarios.map((scen) => {
              const isBest = scen.scenario_id === bestScenarioId;
              const k = scen.evaluation.kpis;
              return (
                <div
                  key={scen.scenario_id}
                  className={`rounded-xl p-3.5 border flex flex-col justify-between transition ${
                    isBest
                      ? 'bg-emerald-950/20 border-emerald-500/60 shadow-lg shadow-emerald-950/20'
                      : 'bg-[#080C14] border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        {isBest && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold mb-1">
                            <Award className="w-3 h-3" /> TOP RANKED
                          </span>
                        )}
                        <h3 className="text-xs font-bold text-white font-mono leading-snug">
                          {scen.label}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {scen.evaluation.effective_start_utc.slice(0, 10)} (
                          {scen.evaluation.launch_slip_days >= 0
                            ? `+${scen.evaluation.launch_slip_days}d`
                            : `${scen.evaluation.launch_slip_days}d`}
                          )
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveScenario(scen.scenario_id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition"
                        title="Remove Scenario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono border-t border-slate-800/80 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Viability:</span>
                        <span className="font-bold text-white">{k.viability_score.toFixed(0)} / 100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Sunlight:</span>
                        <span className="text-amber-400 font-semibold">
                          {k.sunlight_percentage.toFixed(1)}% ({k.total_sunlight_hours.toFixed(0)}h)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">DTE Comms:</span>
                        <span className="text-sky-400 font-semibold">
                          {k.dte_comms_percentage.toFixed(1)}% ({k.total_dte_hours.toFixed(0)}h)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Joint Ops:</span>
                        <span className="text-emerald-400">{k.joint_window_percentage.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max Eclipse:</span>
                        <span
                          className={
                            k.max_continuous_darkness_hours > 50
                              ? 'text-rose-400 font-bold'
                              : 'text-emerald-300'
                          }
                        >
                          {k.max_continuous_darkness_hours.toFixed(1)}h
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Avg Power:</span>
                        <span className="text-slate-200">{k.average_power_kw.toFixed(2)} kW</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">VERDICT:</span>
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
                      <span className="text-rose-400 font-bold flex items-center gap-1">
                        <XOctagon className="w-3 h-3" /> CRITICAL RISK
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparative Trade-Off Bar Chart (4 cols) */}
          <div className="xl:col-span-4 bg-[#080C14] border border-slate-800 rounded-xl p-3.5 min-h-[260px] flex flex-col">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-2">
              KPI Trade-Off Comparison
            </div>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-strong)',
                      color: 'var(--text-primary)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: "'Times New Roman', Times, serif",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="SunlightPct" name="Sunlight %" fill="#D97706" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="DTECommsPct" name="DTE Comms %" fill="#0284C7" radius={[3, 3, 0, 0]} />
                  <Bar
                    dataKey="ViabilityScore"
                    name="Viability Score"
                    fill="#059669"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};