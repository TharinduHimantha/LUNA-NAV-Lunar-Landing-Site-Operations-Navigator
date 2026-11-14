import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Info,
  SlidersHorizontal,
  Grid,
  Activity,
  RotateCcw,
} from 'lucide-react';
import type {
  ColormapId,
  ContourSettings,
  GraticuleSettings,
  LayerItemState,
} from '../../types/workbench';

interface LayerManagerPanelProps {
  layers: LayerItemState[];
  onChangeLayers: (next: LayerItemState[]) => void;
  patchMinElevM: number;
  patchMaxElevM: number;
  contourSettings: ContourSettings;
  onChangeContourSettings: (next: ContourSettings) => void;
  graticuleSettings: GraticuleSettings;
  onChangeGraticuleSettings: (next: GraticuleSettings) => void;
}

const COLORMAP_CSS: Record<ColormapId, string> = {
  cividis: 'linear-gradient(90deg, #00224e, #575d6d, #a59c74, #fee838)',
  viridis: 'linear-gradient(90deg, #440154, #31688e, #35b779, #fde725)',
  inferno: 'linear-gradient(90deg, #000004, #781c6d, #ed6925, #fcffa4)',
  grayscale: 'linear-gradient(90deg, #0f172a, #f8fafc)',
};

export const LayerManagerPanel: React.FC<LayerManagerPanelProps> = ({
  layers,
  onChangeLayers,
  patchMinElevM,
  patchMaxElevM,
  contourSettings,
  onChangeContourSettings,
  graticuleSettings,
  onChangeGraticuleSettings,
}) => {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [openStretchId, setOpenStretchId] = useState<string | null>('lola_elevation');

  const moveLayer = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= layers.length || fromIdx === toIdx) return;
    const updated = [...layers];
    const [item] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, item);
    onChangeLayers(updated);
  };

  const updateLayer = (id: string, patch: Partial<LayerItemState>) => {
    onChangeLayers(layers.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  return (
    <div className="space-y-4">
      {/* Section 1: Cartographic Vectors (Contours & Selenographic Graticule) */}
      <div className="p-2.5 rounded-md bg-slate-950/65 border border-slate-800/90 space-y-2.5">
        <span className="section-kicker block">Cartographic Vectors &amp; Grid</span>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-200">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Hypsometric Contours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={contourSettings.intervalM}
              onChange={(e) =>
                onChangeContourSettings({
                  ...contourSettings,
                  intervalM: Number(e.target.value),
                })
              }
              disabled={!contourSettings.visible}
              aria-label="Contour interval in meters"
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-slate-200 disabled:opacity-40"
            >
              <option value={25}>25 m</option>
              <option value={50}>50 m</option>
              <option value={100}>100 m</option>
              <option value={250}>250 m</option>
              <option value={500}>500 m</option>
            </select>
            <button
              type="button"
              onClick={() =>
                onChangeContourSettings({
                  ...contourSettings,
                  visible: !contourSettings.visible,
                })
              }
              aria-label="Toggle Contour Lines"
              className={`p-1 rounded border transition-colors ${
                contourSettings.visible
                  ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                  : 'bg-slate-900 border-slate-700 text-slate-500'
              }`}
            >
              {contourSettings.visible ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-200">
            <Grid className="w-3.5 h-3.5 text-sky-400" />
            <span>Selenographic Graticule &amp; Rings</span>
          </div>
          <button
            type="button"
            onClick={() =>
              onChangeGraticuleSettings({
                ...graticuleSettings,
                visible: !graticuleSettings.visible,
              })
            }
            aria-label="Toggle Selenographic Graticule"
            className={`p-1 rounded border transition-colors ${
              graticuleSettings.visible
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                : 'bg-slate-900 border-slate-700 text-slate-500'
            }`}
          >
            {graticuleSettings.visible ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Section 2: Reorderable Scientific Layer Stack */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="section-kicker">Layer Stack (Top = Higher Priority)</span>
          <span className="text-[10px] font-mono text-slate-500">Drag or ↑↓</span>
        </div>

        {layers.map((layer, idx) => {
          const isInfoOpen = openInfoId === layer.id;
          const isStretchOpen = openStretchId === layer.id;

          return (
            <div
              key={layer.id}
              draggable
              onDragStart={() => setDraggedIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (draggedIdx !== null) {
                  moveLayer(draggedIdx, idx);
                  setDraggedIdx(null);
                }
              }}
              onDragEnd={() => setDraggedIdx(null)}
              className={`p-2.5 rounded-md border transition-colors space-y-2 ${
                draggedIdx === idx
                  ? 'bg-sky-500/10 border-sky-400/60'
                  : 'bg-slate-950/65 border-slate-800/90 hover:border-slate-700'
              }`}
            >
              {/* Layer Header Row */}
              <div className="flex items-center gap-1.5">
                <span
                  className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
                  title="Drag to reorder layer stack"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <span className="section-kicker block leading-none mb-0.5">{layer.group}</span>
                  <div className="text-xs font-medium text-slate-100 truncate">{layer.label}</div>
                </div>

                {/* Reorder Up/Down + Metadata + Stretch + Visibility */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveLayer(idx, idx - 1)}
                    disabled={idx === 0}
                    aria-label={`Move ${layer.label} up`}
                    title="Move layer up"
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLayer(idx, idx + 1)}
                    disabled={idx === layers.length - 1}
                    aria-label={`Move ${layer.label} down`}
                    title="Move layer down"
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-25"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>

                  {layer.colormap && (
                    <button
                      type="button"
                      onClick={() => setOpenStretchId(isStretchOpen ? null : layer.id)}
                      aria-label={`Data stretch controls for ${layer.label}`}
                      title="Colormap & Min/Max/Gamma Stretch"
                      className={`p-1 rounded border transition-colors ${
                        isStretchOpen
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenInfoId(isInfoOpen ? null : layer.id)}
                    aria-label={`Dataset metadata for ${layer.label}`}
                    title="Dataset Provenance & Resolution"
                    className={`p-1 rounded border transition-colors ${
                      isInfoOpen
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                    aria-label={`Toggle ${layer.label}`}
                    className={`p-1 rounded border transition-colors ${
                      layer.visible
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-300'
                        : 'bg-slate-900 border-slate-700 text-slate-500'
                    }`}
                  >
                    {layer.visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Opacity Control */}
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span>Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={layer.opacity}
                  onChange={(e) => updateLayer(layer.id, { opacity: Number(e.target.value) })}
                  className="sci-slider flex-1"
                />
                <span className="w-8 text-right tabular-nums">
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>

              {/* Live Colormap & Min/Max/Gamma Stretch Drawer */}
              {layer.colormap && isStretchOpen && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2 text-[10px] font-mono">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Colormap ({layer.unit})</span>
                    <select
                      value={layer.colormap}
                      onChange={(e) =>
                        updateLayer(layer.id, { colormap: e.target.value as ColormapId })
                      }
                      className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-200"
                    >
                      <option value="cividis">Cividis (Colorblind Safe)</option>
                      <option value="viridis">Viridis</option>
                      <option value="inferno">Inferno</option>
                      <option value="grayscale">Grayscale</option>
                    </select>
                  </div>

                  <div
                    className="h-2 w-full rounded-sm border border-slate-700/60"
                    style={{ background: COLORMAP_CSS[layer.colormap] }}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-0.5">
                        <span>Min ({layer.unit})</span>
                        {layer.id === 'lola_elevation' && (
                          <button
                            type="button"
                            onClick={() =>
                              updateLayer(layer.id, {
                                minVal: Math.round(patchMinElevM),
                                maxVal: Math.round(patchMaxElevM),
                                gamma: 1.0,
                              })
                            }
                            title="Auto-fit stretch to active DEM patch bounds"
                            className="text-sky-400 hover:text-sky-300 flex items-center gap-0.5"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Fit</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        value={layer.minVal ?? 0}
                        onChange={(e) => updateLayer(layer.id, { minVal: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-100 tabular-nums"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Max ({layer.unit})</span>
                      <input
                        type="number"
                        value={layer.maxVal ?? 100}
                        onChange={(e) => updateLayer(layer.id, { maxVal: Number(e.target.value) })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-100 tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <span>Gamma (γ)</span>
                    <input
                      type="range"
                      min={0.3}
                      max={2.5}
                      step={0.1}
                      value={layer.gamma ?? 1.0}
                      onChange={(e) => updateLayer(layer.id, { gamma: Number(e.target.value) })}
                      className="sci-slider flex-1"
                    />
                    <span className="w-7 text-right text-slate-200 tabular-nums">
                      {(layer.gamma ?? 1.0).toFixed(1)}
                    </span>
                  </div>
                </div>
              )}

              {/* Dataset Provenance & Instrument Metadata Popover */}
              {isInfoOpen && (
                <div className="p-2 rounded bg-slate-900/90 border border-sky-500/30 text-[10px] space-y-1 text-slate-300">
                  <div className="font-mono text-sky-300 font-semibold">
                    {layer.instrumentMeta || 'NASA LRO Mission Archive'}
                  </div>
                  <p className="leading-snug text-slate-300">{layer.sourceNote}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[9px] text-slate-400 pt-1 border-t border-slate-800">
                    <span>Res: {layer.resolutionMeta || '80 m/px'}</span>
                    <span>Datum: {layer.datumMeta || 'IAU ME 1737.4 km'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};