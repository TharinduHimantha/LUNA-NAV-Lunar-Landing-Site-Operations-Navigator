import React from 'react';
import type { ColormapId, LayerItemState } from '../../types/workbench';

interface FloatingColorBarProps {
  layers: LayerItemState[];
}

const RAMP_GRADIENTS: Record<ColormapId, string> = {
  cividis: 'linear-gradient(90deg, #00224e, #575d6d, #a59c74, #fee838)',
  viridis: 'linear-gradient(90deg, #440154, #31688e, #35b779, #fde725)',
  inferno: 'linear-gradient(90deg, #000004, #781c6d, #ed6925, #fcffa4)',
  grayscale: 'linear-gradient(90deg, #0f172a, #f8fafc)',
};

export const FloatingColorBar: React.FC<FloatingColorBarProps> = ({ layers }) => {
  const activeColorLayers = layers.filter(
    (l) => l.visible && l.colormap !== undefined && l.id !== 'psr_cold_traps'
  );
  const psrActive = layers.some((l) => l.id === 'psr_cold_traps' && l.visible);

  if (activeColorLayers.length === 0 && !psrActive) return null;

  return (
    <aside
      aria-label="Active Scientific Layer Color Bars"
      className="fixed bottom-16 left-3 z-20 flex flex-col gap-1.5 pointer-events-none max-w-[260px]"
    >
      {activeColorLayers.map((layer) => {
        const minV = layer.minVal ?? 0;
        const maxV = layer.maxVal ?? 100;
        const midV = (minV + maxV) * 0.5;
        const unit = layer.unit || '';

        return (
          <div
            key={layer.id}
            className="hud-panel rounded-md px-2.5 py-1.5 text-[10px] font-mono space-y-1"
          >
            <div className="flex items-center justify-between gap-2 text-slate-200">
              <span className="font-sans font-semibold text-[11px] truncate">
                {layer.label}
              </span>
              <span className="text-slate-400 shrink-0">
                [{unit}] γ{(layer.gamma ?? 1.0).toFixed(1)}
              </span>
            </div>

            <div
              className="h-2 w-full rounded-sm border border-slate-700/80"
              style={{ background: RAMP_GRADIENTS[layer.colormap || 'cividis'] }}
            />

            <div className="flex justify-between text-[9px] text-slate-400 tabular-nums">
              <span>{minV.toFixed(0)}</span>
              <span>{midV.toFixed(0)}</span>
              <span>
                {maxV.toFixed(0)} {unit}
              </span>
            </div>

            {layer.id === 'terrain_slope' && (
              <div className="flex items-center gap-1.5 text-[9px] text-emerald-300 pt-0.5">
                <span className="w-2 h-2 rounded-xs bg-emerald-400/80 inline-block" />
                <span>HLS Safe Landing Zone (&lt; 5.0°)</span>
              </div>
            )}
          </div>
        );
      })}

      {psrActive && (
        <div className="hud-panel rounded-md px-2.5 py-1.5 text-[10px] font-mono flex items-center gap-2 text-sky-300">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-600/90 border border-sky-400/70 shrink-0" />
          <span>PSR Cryogenic Cold Trap (&lt; 70 K H₂O Ice)</span>
        </div>
      )}
    </aside>
  );
};