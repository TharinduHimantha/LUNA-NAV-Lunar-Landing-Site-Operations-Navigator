import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type {
  TourBeforeActionContext,
  TourPlacement,
  TourStep,
} from '../../types/workbench';

interface GuidedTourProps {
  isOpen: boolean;
  steps: TourStep[];
  currentStepIndex: number;
  onStepChange: (nextIndex: number) => void;
  onSkip: () => void;
  onDone: () => void;
  actionContext: TourBeforeActionContext;
}

interface CutoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

interface BubblePosition {
  top: number;
  left: number;
  resolvedPlacement: TourPlacement;
  arrowOffset: number;
  isMobileDocked: boolean;
}

const CUTOUT_PADDING = 7;
const CUTOUT_RADIUS = 12;
const BUBBLE_GAP = 14;
const VIEWPORT_MARGIN = 12;
const TARGET_WAIT_TIMEOUT_MS = 1500;

/**
 * Build an evenodd SVG path covering the entire viewport with a rounded rectangular cut-out.
 */
function buildEvenOddSpotlightPath(
  vw: number,
  vh: number,
  cutout: CutoutRect | null
): string {
  const outer = `M 0 0 H ${vw} V ${vh} H 0 Z`;
  if (!cutout || cutout.width <= 0 || cutout.height <= 0) {
    return outer;
  }

  const x = Math.max(0, cutout.x);
  const y = Math.max(0, cutout.y);
  const w = Math.min(vw - x, cutout.width);
  const h = Math.min(vh - y, cutout.height);
  const r = Math.min(cutout.radius, w / 2, h / 2);

  const inner = [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');

  return `${outer} ${inner}`;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  steps,
  currentStepIndex,
  onStepChange,
  onSkip,
  onDone,
  actionContext,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewportSize, setViewportSize] = useState<{ vw: number; vh: number }>(() => ({
    vw: typeof window !== 'undefined' ? window.innerWidth : 1280,
    vh: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));
  const [bubbleSize, setBubbleSize] = useState<{ width: number; height: number }>({
    width: 340,
    height: 210,
  });

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const targetElRef = useRef<HTMLElement | null>(null);

  const step = steps[currentStepIndex] ?? steps[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Capture previously focused element when tour opens & focus dialog
  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const raf = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(raf);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  // Keep viewport dimensions in sync on resize
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      setViewportSize({ vw: window.innerWidth, vh: window.innerHeight });
      if (targetElRef.current) {
        setTargetRect(targetElRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen]);

  // Execute beforeAction & wait for target element via MutationObserver + rAF
  useEffect(() => {
    if (!isOpen || !step) return;

    step.beforeAction?.(actionContext);

    if (!step.targetSelector) {
      targetElRef.current = null;
      const raf = window.requestAnimationFrame(() => setTargetRect(null));
      return () => window.cancelAnimationFrame(raf);
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let rafId = 0;
    const startTime = performance.now();
    const selector = step.targetSelector;

    const attachToElement = (el: HTMLElement) => {
      if (cancelled) return;
      targetElRef.current = el;
      const updateRect = () => {
        if (!cancelled && targetElRef.current) {
          setTargetRect(targetElRef.current.getBoundingClientRect());
        }
      };
      updateRect();
      resizeObserver = new ResizeObserver(updateRect);
      resizeObserver.observe(el);
      resizeObserver.observe(document.body);
    };

    const pollForTarget = () => {
      if (cancelled) return;
      const found = document.querySelector<HTMLElement>(selector);
      if (found) {
        const rect = found.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          mutationObserver?.disconnect();
          attachToElement(found);
          return;
        }
      }

      if (performance.now() - startTime >= TARGET_WAIT_TIMEOUT_MS) {
        mutationObserver?.disconnect();
        console.warn(
          `[GuidedTour] Target "${selector}" not found within ${TARGET_WAIT_TIMEOUT_MS}ms; skipping step "${step.id}".`
        );
        if (currentStepIndex + 1 < steps.length) {
          onStepChange(currentStepIndex + 1);
        } else {
          onDone();
        }
        return;
      }

      rafId = window.requestAnimationFrame(pollForTarget);
    };

    mutationObserver = new MutationObserver(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) {
        const rect = found.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          mutationObserver?.disconnect();
          window.cancelAnimationFrame(rafId);
          attachToElement(found);
        }
      }
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    rafId = window.requestAnimationFrame(pollForTarget);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [isOpen, step, actionContext, currentStepIndex, steps.length, onStepChange, onDone]);

  // Measure speech bubble size so placement & clamping are exact
  useLayoutEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const measure = () => {
      if (!dialogRef.current) return;
      const r = dialogRef.current.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setBubbleSize({ width: r.width, height: r.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(dialogRef.current);
    return () => ro.disconnect();
  }, [isOpen, currentStepIndex]);

  const handleNext = useCallback(() => {
    if (isLastStep) onDone();
    else onStepChange(currentStepIndex + 1);
  }, [isLastStep, onDone, onStepChange, currentStepIndex]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) onStepChange(currentStepIndex - 1);
  }, [isFirstStep, onStepChange, currentStepIndex]);

  // Capture-phase keyboard handler + focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();

      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
        return;
      }

      if (e.key === 'Enter') {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && activeEl.tagName === 'BUTTON' && dialogRef.current?.contains(activeEl)) {
          // Let native button click run, then prevent bubbling
          return;
        }
        e.preventDefault();
        handleNext();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusables.length === 0) {
          e.preventDefault();
          dialogRef.current.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first || !dialogRef.current.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last || !dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen, onSkip, handleNext, handleBack]);

  if (!isOpen || !step) return null;

  const { vw, vh } = viewportSize;
  const isMobile = vw < 768;

  // Determine whether target is full-viewport (Step 2)
  const isFullViewportTarget =
    targetRect !== null &&
    targetRect.width >= vw - 24 &&
    targetRect.height >= vh - 24;

  const cutout: CutoutRect | null =
    targetRect === null
      ? null
      : isFullViewportTarget
      ? {
          x: 6,
          y: 6,
          width: Math.max(0, vw - 12),
          height: Math.max(0, vh - 12),
          radius: CUTOUT_RADIUS,
        }
      : {
          x: Math.max(4, targetRect.left - CUTOUT_PADDING),
          y: Math.max(4, targetRect.top - CUTOUT_PADDING),
          width: Math.min(vw - 8, targetRect.width + CUTOUT_PADDING * 2),
          height: Math.min(vh - 8, targetRect.height + CUTOUT_PADDING * 2),
          radius: CUTOUT_RADIUS,
        };

  // Compute bubble placement, flip if constrained, and clamp inside viewport
  const computeBubblePosition = (): BubblePosition => {
    const bw = Math.min(bubbleSize.width || 340, vw - VIEWPORT_MARGIN * 2);
    const bh = bubbleSize.height || 200;

    // On max-md (<768px) when a drawer or target is active, dock compact card cleanly at top
    if (isMobile && cutout !== null && !isFullViewportTarget) {
      return {
        top: VIEWPORT_MARGIN,
        left: Math.max(VIEWPORT_MARGIN, (vw - bw) / 2),
        resolvedPlacement: 'center',
        arrowOffset: 0,
        isMobileDocked: true,
      };
    }

    if (!cutout || step.placement === 'center' || isFullViewportTarget) {
      // For full-viewport step 2, place card slightly above center-bottom so terrain & top-right controls stay unobstructed
      const top = isFullViewportTarget
        ? Math.max(VIEWPORT_MARGIN, Math.min(vh - bh - 92, vh * 0.56))
        : Math.max(VIEWPORT_MARGIN, (vh - bh) / 2);
      return {
        top,
        left: Math.max(VIEWPORT_MARGIN, (vw - bw) / 2),
        resolvedPlacement: 'center',
        arrowOffset: 0,
        isMobileDocked: false,
      };
    }

    const targetCenterX = cutout.x + cutout.width / 2;
    const targetCenterY = cutout.y + cutout.height / 2;

    const fitsRight = cutout.x + cutout.width + BUBBLE_GAP + bw <= vw - VIEWPORT_MARGIN;
    const fitsLeft = cutout.x - BUBBLE_GAP - bw >= VIEWPORT_MARGIN;
    const fitsBottom = cutout.y + cutout.height + BUBBLE_GAP + bh <= vh - VIEWPORT_MARGIN;
    const fitsTop = cutout.y - BUBBLE_GAP - bh >= VIEWPORT_MARGIN;

    let resolved: TourPlacement = step.placement;
    if (resolved === 'right' && !fitsRight) {
      resolved = fitsLeft ? 'left' : fitsBottom ? 'bottom' : fitsTop ? 'top' : 'center';
    } else if (resolved === 'left' && !fitsLeft) {
      resolved = fitsRight ? 'right' : fitsBottom ? 'bottom' : fitsTop ? 'top' : 'center';
    } else if (resolved === 'bottom' && !fitsBottom) {
      resolved = fitsTop ? 'top' : fitsRight ? 'right' : fitsLeft ? 'left' : 'center';
    } else if (resolved === 'top' && !fitsTop) {
      resolved = fitsBottom ? 'bottom' : fitsRight ? 'right' : fitsLeft ? 'left' : 'center';
    }

    if (resolved === 'center') {
      return {
        top: Math.max(VIEWPORT_MARGIN, (vh - bh) / 2),
        left: Math.max(VIEWPORT_MARGIN, (vw - bw) / 2),
        resolvedPlacement: 'center',
        arrowOffset: 0,
        isMobileDocked: false,
      };
    }

    let rawTop = 0;
    let rawLeft = 0;

    if (resolved === 'right') {
      rawLeft = cutout.x + cutout.width + BUBBLE_GAP;
      rawTop = targetCenterY - bh / 2;
    } else if (resolved === 'left') {
      rawLeft = cutout.x - BUBBLE_GAP - bw;
      rawTop = targetCenterY - bh / 2;
    } else if (resolved === 'bottom') {
      rawTop = cutout.y + cutout.height + BUBBLE_GAP;
      rawLeft = targetCenterX - bw / 2;
    } else {
      rawTop = cutout.y - BUBBLE_GAP - bh;
      rawLeft = targetCenterX - bw / 2;
    }

    const clampedLeft = Math.max(VIEWPORT_MARGIN, Math.min(vw - bw - VIEWPORT_MARGIN, rawLeft));
    const clampedTop = Math.max(VIEWPORT_MARGIN, Math.min(vh - bh - VIEWPORT_MARGIN, rawTop));

    const arrowOffset =
      resolved === 'right' || resolved === 'left'
        ? Math.max(20, Math.min(bh - 20, targetCenterY - clampedTop))
        : Math.max(20, Math.min(bw - 20, targetCenterX - clampedLeft));

    return {
      top: clampedTop,
      left: clampedLeft,
      resolvedPlacement: resolved,
      arrowOffset,
      isMobileDocked: false,
    };
  };

  const pos = computeBubblePosition();
  const clipPathValue = `path(evenodd, "${buildEvenOddSpotlightPath(vw, vh, cutout)}")`;

  return (
    <div
      className="fixed inset-0 z-[60] select-none"
      aria-live="polite"
    >
      {/* 1. Blurred & Dimmed Backdrop with Even-Odd Rounded Cutout */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none tour-transition"
        style={{
          backgroundColor: 'rgba(3, 6, 12, 0.68)',
          backdropFilter: 'blur(3.5px)',
          WebkitBackdropFilter: 'blur(3.5px)',
          clipPath: clipPathValue,
          WebkitClipPath: clipPathValue,
        }}
      />

      {/* 2. Sky-Blue Focus Ring Around Active Cutout */}
      {cutout && (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none tour-transition"
          style={{
            left: cutout.x,
            top: cutout.y,
            width: cutout.width,
            height: cutout.height,
            borderRadius: cutout.radius,
            border: '1.5px solid rgba(56, 189, 248, 0.8)',
            boxShadow: '0 0 0 1px rgba(5, 7, 11, 0.7), 0 0 24px rgba(56, 189, 248, 0.25)',
          }}
        />
      )}

      {/* 3. Full-Screen Click Shield Blocking Underlying UI */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />

      {/* 4. Speech Bubble Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="luna-tour-title"
        aria-describedby="luna-tour-body"
        tabIndex={-1}
        style={{
          top: pos.top,
          left: pos.left,
          width: isMobile ? 'calc(100vw - 24px)' : 352,
          maxWidth: 'calc(100vw - 24px)',
        }}
        className="fixed z-20 hud-panel-strong rounded-xl p-4 text-slate-100 outline-none tour-transition"
      >
        {/* Directional Speech-Bubble Pointer Arrow */}
        {!pos.isMobileDocked && pos.resolvedPlacement === 'right' && (
          <span
            aria-hidden="true"
            style={{ top: pos.arrowOffset - 6 }}
            className="absolute -left-[7px] w-3 h-3 rotate-45 bg-[#0a101d] border-l border-b border-sky-400/50"
          />
        )}
        {!pos.isMobileDocked && pos.resolvedPlacement === 'left' && (
          <span
            aria-hidden="true"
            style={{ top: pos.arrowOffset - 6 }}
            className="absolute -right-[7px] w-3 h-3 rotate-45 bg-[#0a101d] border-r border-t border-sky-400/50"
          />
        )}
        {!pos.isMobileDocked && pos.resolvedPlacement === 'bottom' && (
          <span
            aria-hidden="true"
            style={{ left: pos.arrowOffset - 6 }}
            className="absolute -top-[7px] w-3 h-3 rotate-45 bg-[#0a101d] border-l border-t border-sky-400/50"
          />
        )}
        {!pos.isMobileDocked && pos.resolvedPlacement === 'top' && (
          <span
            aria-hidden="true"
            style={{ left: pos.arrowOffset - 6 }}
            className="absolute -bottom-[7px] w-3 h-3 rotate-45 bg-[#0a101d] border-r border-b border-sky-400/50"
          />
        )}

        {/* Header: Step Counter + Always-Visible Skip Option */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-sky-400">
            <Sparkles className="w-3 h-3" />
            <span>
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </span>

          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] font-mono text-slate-400 hover:text-slate-100 underline underline-offset-2 transition-colors px-1 py-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400"
          >
            Skip tour
          </button>
        </div>

        {/* Title & Body */}
        <h3
          id="luna-tour-title"
          className="text-sm font-semibold text-white tracking-tight"
        >
          {step.title}
        </h3>
        <p
          id="luna-tour-body"
          className="text-xs text-slate-300 leading-relaxed mt-1.5"
        >
          {step.body}
        </p>

        {/* Keyboard Shortcut Chips (Step 3) */}
        {step.shortcutChips && step.shortcutChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {step.shortcutChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-[10px] font-mono text-slate-300"
              >
                <kbd className="px-1 py-0.2 rounded bg-sky-500/20 border border-sky-400/40 text-sky-300 font-bold">
                  {chip.key}
                </kbd>
                <span>{chip.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Footer: Progress Dots + Back / Next (or Done) */}
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800/90">
          <div
            className="flex items-center gap-1"
            aria-label={`Tour progress: step ${currentStepIndex + 1} of ${steps.length}`}
          >
            {steps.map((s, idx) => {
              const active = idx === currentStepIndex;
              const completed = idx < currentStepIndex;
              return (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full tour-transition ${
                    active
                      ? 'w-4 bg-sky-400'
                      : completed
                      ? 'w-1.5 bg-sky-400/50'
                      : 'w-1.5 bg-slate-700'
                  }`}
                />
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleBack}
              disabled={isFirstStep}
              className="px-2.5 py-1 rounded-md text-xs font-medium border border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="px-3 py-1 rounded-md text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-[#05070b] flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <span>{isLastStep ? 'Done' : 'Next'}</span>
              {!isLastStep && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};