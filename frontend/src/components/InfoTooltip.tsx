import React, { useState, useRef } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  title: string;
  content: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ title, content }) => {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Flip popover alignment if near right viewport edge
      setAlignRight(rect.left > window.innerWidth - 280);
    }
    setOpen(true);
  };

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={handleOpen}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else handleOpen();
        }}
        aria-label={`Info: ${title}`}
        className="text-slate-500 hover:text-sky-400 transition-colors focus:outline-none"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          role="tooltip"
          className={`absolute bottom-full mb-2 w-64 p-2.5 rounded-lg bg-[#080C14]/95 backdrop-blur-md border border-slate-700 shadow-2xl z-50 text-left pointer-events-none ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          <div className="text-[11px] font-mono font-bold text-amber-300 mb-1">
            {title}
          </div>
          <p className="text-[11px] font-sans font-normal normal-case tracking-normal text-slate-300 leading-relaxed">
            {content}
          </p>
        </div>
      )}
    </span>
  );
};