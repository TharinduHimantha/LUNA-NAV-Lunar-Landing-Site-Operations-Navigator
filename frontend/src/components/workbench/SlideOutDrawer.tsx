import React from 'react';
import { X, PanelLeftClose } from 'lucide-react';

interface SlideOutDrawerProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const SlideOutDrawer: React.FC<SlideOutDrawerProps> = ({
  isOpen,
  title,
  subtitle,
  wide = false,
  onClose,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <aside
      aria-label={title}
      className={`
        fixed z-30 hud-panel-strong rounded-lg flex flex-col overflow-hidden
        transition-all duration-200 ease-out
        left-16 top-3 bottom-16
        ${wide ? 'w-[420px] max-w-[calc(100vw-5rem)]' : 'w-[324px] max-w-[calc(100vw-5rem)]'}
        max-md:left-2 max-md:right-2 max-md:top-auto max-md:bottom-24 max-md:w-auto max-md:max-w-none max-md:h-[54vh]
      `}
    >
      {/* Drawer Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-700/50 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold tracking-wide text-slate-100 truncate">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse panel"
          title="Collapse panel (Esc)"
          className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <PanelLeftClose className="w-4 h-4 max-md:hidden" />
          <X className="w-4 h-4 md:hidden" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto drawer-scroll p-3.5 space-y-4">
        {children}
      </div>
    </aside>
  );
};