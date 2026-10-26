"use client";

/**
 * The map's first-visit guide, drawn: one bubble at a time, pointing at the
 * control it describes, with the rest of the page dimmed.
 *
 * The dimming is an SVG path with an even-odd hole over the target, not a
 * backdrop plus a raised z-index. That leaves the target where it is in the
 * stacking order — the open preferences card and the display-mode dialog live
 * in different stacking contexts — and lets pointer events through the hole
 * only, so the month arrows work during the month step while a stray click on
 * the map cannot open a panel underneath the bubble.
 *
 * Targets are found by `data-tour` attribute and re-measured every frame while
 * the tour is up, because the panels the tour opens animate in and a bubble
 * placed against their first frame ends up pointing at nothing.
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { MapTour } from "@/hooks/use-map-tour";
import { cn } from "@/lib/cn";
import { placeBubble, type Box, type Placement, type Side } from "@/lib/map-tour";

/** Breathing room between the target and the edge of the spotlight. */
const HOLE_PAD = 6;
const HOLE_RADIUS = 10;

type Layout = {
  hole: Box | null;
  placement: Placement;
  viewport: { width: number; height: number };
};

export function MapTourLayer({ tour }: { tour: MapTour }) {
  const { step, index, total, next, back, skip } = tour;
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [touch] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches,
  );
  const titleId = useId();
  const bodyId = useId();

  // Hand focus back to wherever it was — usually the "?" button — on close.
  useEffect(() => {
    const previous = document.activeElement;
    return () => {
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, [step?.id]);

  useEffect(() => {
    if (!step) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") skip();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [skip, step]);

  useEffect(() => {
    if (!step) return;
    const raf =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (cb: () => void) => window.setTimeout(cb, 16);
    const cancel =
      typeof window.cancelAnimationFrame === "function"
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);

    let frame = 0;
    let last = "";
    const tick = () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const hole = measure(findTarget(step.targets));
      const bubble = bubbleRef.current;
      const placement = placeBubble({
        target: hole,
        bubble: {
          width: bubble?.offsetWidth ?? 320,
          height: bubble?.offsetHeight ?? 180,
        },
        viewport,
        sides: step.sides,
        frame: measure(findTarget(["map"])) ?? undefined,
        fallback:
          step.id === "intro" ? "center" : viewport.width < 768 ? "bottom" : "top",
      });
      const key = JSON.stringify([hole, placement, viewport]);
      if (key !== last) {
        last = key;
        setLayout({ hole, placement, viewport });
      }
      frame = raf(tick);
    };
    frame = raf(tick);
    return () => cancel(frame);
  }, [step]);

  if (!step) return null;

  const first = index === 0;
  const last = index === total - 1;
  const hole = layout?.hole ?? null;
  const placement = layout?.placement;

  return createPortal(
    <>
      {layout ? (
        <svg
          aria-hidden="true"
          data-testid="map-tour-spotlight"
          className="pointer-events-none fixed inset-0 z-[60] animate-[wtg-fade-in_200ms_ease-out]"
          width={layout.viewport.width}
          height={layout.viewport.height}
        >
          {step.dim ? (
            <path
              d={spotlightPath(layout.viewport, hole)}
              fillRule="evenodd"
              fill="var(--color-overlay)"
              fillOpacity={0.75}
              // Catches clicks on the dimmed page; the hole lets them through.
              className="pointer-events-auto"
            />
          ) : null}
          {hole ? (
            <rect
              x={hole.left - HOLE_PAD}
              y={hole.top - HOLE_PAD}
              width={hole.width + HOLE_PAD * 2}
              height={hole.height + HOLE_PAD * 2}
              rx={HOLE_RADIUS}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
            />
          ) : null}
        </svg>
      ) : null}

      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-testid="map-tour"
        data-step={step.id}
        style={{ top: placement?.top ?? 0, left: placement?.left ?? 0 }}
        className={cn(
          "fixed z-[61] w-[min(320px,calc(100vw-24px))] rounded-lg border border-border bg-surface p-4 font-sans text-text shadow-lg",
          "motion-safe:transition-[top,left] motion-safe:duration-200 motion-safe:ease-out",
          // Measured before it is shown, so the first frame is not at 0,0.
          placement ? "opacity-100" : "opacity-0",
        )}
      >
        {placement?.side ? <Arrow side={placement.side} at={placement.arrow} /> : null}

        <div className="flex items-center justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.14em]">
          <span className="text-accent-text">{step.eyebrow}</span>
          <span className="text-text-muted">
            {index + 1} / {total}
          </span>
        </div>
        <p
          id={titleId}
          className="mt-1.5 font-display text-[17px] font-medium leading-[1.25] text-text"
        >
          {step.title}
        </p>
        <p id={bodyId} className="mt-1.5 text-[13px] leading-[1.5] text-text-muted">
          {touch && step.bodyTouch ? step.bodyTouch : step.body}
        </p>

        <div className="mt-3.5 flex items-center gap-1.5">
          <button
            ref={primaryRef}
            type="button"
            onClick={next}
            data-testid="map-tour-next"
            className="rounded-sm bg-text px-3 py-2 text-[12.5px] font-medium text-surface outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2"
          >
            {first ? "Show me around" : last ? "Start exploring" : "Next"}
          </button>
          {first ? null : (
            <button
              type="button"
              onClick={back}
              className="rounded-sm px-2.5 py-2 text-[12.5px] font-medium text-text-muted outline-none transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2"
            >
              Back
            </button>
          )}
          {last ? null : (
            <button
              type="button"
              onClick={skip}
              data-testid="map-tour-skip"
              className="ml-auto rounded-sm px-2.5 py-2 text-[12.5px] font-medium text-text-muted outline-none transition hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2"
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

/** A small square turned 45°, poking out of the edge that faces the target. */
function Arrow({ side, at }: { side: Side; at: number }) {
  // `side` is where the bubble sits relative to the target, so the arrow is on
  // the opposite edge of the bubble.
  const edge: Record<Side, string> = {
    bottom: "-top-[6px] border-l border-t",
    top: "-bottom-[6px] border-r border-b",
    right: "-left-[6px] border-l border-b",
    left: "-right-[6px] border-r border-t",
  };
  const along = side === "top" || side === "bottom" ? { left: at - 5 } : { top: at - 5 };
  return (
    <span
      aria-hidden="true"
      style={along}
      className={cn("absolute size-[10px] rotate-45 border-border bg-surface", edge[side])}
    />
  );
}

function findTarget(names: readonly string[]): Element | null {
  for (const name of names) {
    const el = document.querySelector(`[data-tour="${name}"]`);
    if (el) return el;
  }
  return null;
}

function measure(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** The whole viewport with a rounded-rectangle hole cut over `hole`. */
function spotlightPath(
  viewport: { width: number; height: number },
  hole: Box | null,
): string {
  const outer = `M0 0H${viewport.width}V${viewport.height}H0Z`;
  if (!hole) return outer;
  const x = hole.left - HOLE_PAD;
  const y = hole.top - HOLE_PAD;
  const w = hole.width + HOLE_PAD * 2;
  const h = hole.height + HOLE_PAD * 2;
  const r = Math.min(HOLE_RADIUS, w / 2, h / 2);
  return (
    outer +
    `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}
