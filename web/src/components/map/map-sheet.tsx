"use client";

/**
 * The bottom sheet the map's two mobile menus share.
 *
 * It exists because both of them were impossible to close. Each rendered a
 * grabber as a bare `<span aria-hidden>` — it looked like a handle and did
 * nothing — and neither had a close button. Radix does close a dialog on
 * outside press, but the sheets were capped at `85vh` of the *large* viewport,
 * which on a phone is taller than the screen: there was no overlay left to
 * press. With no handle, no button and no reachable overlay, the only way out
 * was reloading the page.
 *
 * So there are now three ways out, one per habit: drag the grabber down, press
 * the ×, or press the map above the sheet. The gesture is `useDragDismiss` —
 * the same hook the climate panel uses — so dragging feels identical whichever
 * sheet you are in.
 */

import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDragDismiss } from "@/hooks/use-drag-dismiss";

export function MapSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  const close = () => onOpenChange(false);
  const drag = useDragDismiss({ onDismiss: close });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // `dvh`, not `vh`: `85vh` measures the viewport as it is with the
        // browser toolbar hidden, so on a phone the sheet ran off the bottom of
        // the screen and took its own controls with it.
        className="max-h-[85dvh] rounded-t-xl p-0"
        style={{
          transform: drag.offset ? `translateY(${drag.offset}px)` : undefined,
          transition: drag.dragging ? "none" : "transform 180ms ease-out",
        }}
      >
        <button
          type="button"
          onClick={() => {
            // A drag that sprang back still ends in a click; only a real tap
            // should close.
            if (!drag.didDrag()) close();
          }}
          aria-label="Drag down to close"
          data-testid="map-sheet-handle"
          className="flex w-full shrink-0 touch-none items-center justify-center py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--color-focus-ring)]"
          {...drag.handleProps}
        >
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-border-strong" />
        </button>

        <div className="flex items-start justify-between gap-3 border-b border-border px-5 pb-3">
          <div className="min-w-0">
            <SheetTitle className="text-[17px]">{title}</SheetTitle>
            <SheetDescription className="mt-0.5 text-[12px]">
              {description}
            </SheetDescription>
          </div>
          {/*
            The 44px way out, for anyone who does not think to drag. Deliberately
            a plain button rather than Radix's `SheetClose` so the tests can
            drive it without a portal, and so it reads the same as the climate
            panel's ×.
          */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            data-testid="map-sheet-close"
            // `size-11` below `md`: the icon stays 18px but the target is a
            // full 44px, because at the 34px `p-2` gave it this was a button
            // you had to aim at.
            className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-text-muted outline-none transition hover:bg-surface-2 hover:text-text md:size-9 focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]"
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
