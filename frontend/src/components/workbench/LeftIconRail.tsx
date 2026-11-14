import React from 'react';
import {
  Search,
  Layers,
  Compass,
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

interface RailItem {
  id: RailPanelId;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}

const RAIL_ITEMS: RailItem[] = [
  { id: 'sites', label: 'Sites & Search', shortcut: 'S', icon: Search },
  { id: 'layers', label: 'Layers & Colormaps', shortcut: 'L', icon: Layers },
  { id: 'projection', label: 'Projection & Camera', shortcut: 'P', icon: Compass },
  { id: 'tools', label: 'Measure & Profile', shortcut: 'T', icon: Ruler },
  { id: 'bookmarks', label: 'Bookmarks & Share', shortcut: 'B', icon: Bookmark },
  { id: 'compare', label: 'Site & Slip Compare', shortcut: 'C', icon: ArrowLeftRight },
  { id: 'guide', label: 'Science & Ops Guide', shortcut: 'G', icon: BookOpen },
];

export const LeftIconRail: React.FC<LeftIconRailProps> = ({
  activePanel,
  onTogglePanel,
  bookmarkCount,
}) => {
  return (
    <nav
      aria-label="Primary Workbench Tool Rail"
      className="
        fixed z-40 hud-panel-strong
        left-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 p-1.5 rounded-lg
        max-md:left-1/2 max-md:top-auto max-md:bottom-14 max-md:-translate-x-1/2 max-md:translate-y-0 max-md:flex-row max-md:px-2
      "
    >
      {/* Brand Monogram */}
      <div
        className="w-8 h-8 rounded flex items-center justify-center border border-sky-500/30 bg-sky-500/10 text-sky-400 font-mono text-[10px] font-bold tracking-tighter mb-1 max-md:mb-0 max-md:mr-1 select-none"
        title="LUNA-NAV Selenographic Mission Workbench"
      >
        LN
      </div>

      <div className="w-5 h-px bg-slate-700/60 my-0.5 max-md:w-px max-md:h-5 max-md:my-0 max-md:mx-0.5" />

      {RAIL_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activePanel === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTogglePanel(item.id)}
            aria-label={`${item.label} (${item.shortcut})`}
            aria-pressed={isActive}
            title={`${item.label} [${item.shortcut}]`}
            className={`
              relative group w-8 h-8 rounded flex items-center justify-center transition-colors duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400
              ${
                isActive
                  ? 'bg-sky-400/20 text-sky-300 border border-sky-400/50'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 border border-transparent'
              }
            `}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute -left-1.5 top-1.5 bottom-1.5 w-0.5 rounded-full bg-sky-400 max-md:hidden"
              />
            )}
            <Icon className="w-4 h-4" />
            {item.id === 'bookmarks' && bookmarkCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-sky-500 text-[#05070b] font-mono text-[9px] font-bold flex items-center justify-center">
                {bookmarkCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};