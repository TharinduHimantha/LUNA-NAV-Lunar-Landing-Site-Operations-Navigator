import React from 'react';
import {
  Search,
  Layers,
  Ruler,
  Bookmark,
  ArrowLeftRight,
  BookOpen,
} from 'lucide-react';
import type { RailPanelId } from '../../types/workbench';

interface LeftIconRailProps {
  activePanel: RailPanelId | null;
  onTogglePanel: (panel: RailPanelId) => void;
  bookmarkCount: number;
}

const RAIL_ITEMS: {
  id: RailPanelId;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'sites', label: 'Sites & Epoch', shortcut: 'S', icon: Search },
  { id: 'layers', label: 'Scientific Layers', shortcut: 'L', icon: Layers },
  { id: 'tools', label: 'Geodesic Tools', shortcut: 'T', icon: Ruler },
  { id: 'bookmarks', label: 'Bookmarks & Export', shortcut: 'B', icon: Bookmark },
  { id: 'compare', label: 'Trade Comparator', shortcut: 'C', icon: ArrowLeftRight },
  { id: 'guide', label: 'Science Guide', shortcut: 'G', icon: BookOpen },
];

export const LeftIconRail: React.FC<LeftIconRailProps> = ({
  activePanel,
  onTogglePanel,
  bookmarkCount,
}) => {
  return (
    <aside
      aria-label="Workbench Tool Rail"
      data-tour="rail"
      className="fixed left-3 top-1/2 -translate-y-1/2 z-30 hud-panel rounded-xl p-1.5 flex flex-col items-center gap-1.5"
    >
      {/* Compact Brand Emblem */}
      <div
        className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-[11px] font-mono font-bold text-sky-300 tracking-tighter"
        title="LUNA-NAV • Selenographic Operations Workbench"
      >
        LN
      </div>

      <div className="w-6 h-px bg-slate-800 my-0.5" />

      {RAIL_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTogglePanel(item.id)}
            aria-label={`${item.label} [${item.shortcut}]`}
            aria-pressed={isActive}
            title={`${item.label} [${item.shortcut}]`}
            className={`relative group w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/50'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 border border-transparent'
            }`}
          >
            {isActive && (
              <span className="absolute -left-1.5 top-1.5 bottom-1.5 w-0.5 rounded-r bg-sky-400" />
            )}
            <Icon className="w-4 h-4" />

            {item.id === 'bookmarks' && bookmarkCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-sky-500 text-[#05070b] text-[9px] font-mono font-bold flex items-center justify-center">
                {bookmarkCount}
              </span>
            )}
          </button>
        );
      })}
    </aside>
  );
};