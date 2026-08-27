"use client";

/**
 * Drag-down-to-dismiss for the bottom sheets on touch.
 *
 * The climate panel opens over the map on a phone and, until this existed, the
 * only way back to the map was a 14px × close button in the top-right corner —
 * the corner furthest from a thumb. Every native bottom sheet on both mobile
 * platforms closes by being pushed down, so people try that first, and when
 * nothing happens the panel reads as stuck rather than as closable.
 *
 * Pointer Events rather than touch events: the same handler then serves a
 * mouse drag on a narrow desktop window and a stylus, and `setPointerCapture`
 * keeps the gesture alive when the finger leaves the handle mid-drag — which
 * it always does, because the handle is moving away underneath it.
 *
 * The gesture is deliberately downward-only. Sheets here have one resting
 * size, so an upward drag has nowhere to go; resisting it (rather than
 * following the finger into a gap above the sheet) is what makes the sheet
 * feel attached to the bottom of the screen.
 */

import { useCallback, useRef, useState } from "react";

/** Travel below which a gesture is a tap, not a drag. */
const TAP_SLOP = 4;

export type DragDismissOptions = {
  /** Called once the gesture has committed to closing. */
  onDismiss: () => void;
  /** Travel, in px, past which a slow drag closes rather than springs back. */
  threshold?: number;
  /**
   * Downward speed, px/ms, past which a short flick closes regardless of
   * distance. A flick is a complete gesture, not an aborted long drag.
   */
  flickVelocity?: number;
};

export type DragDismissState = {
  /** Current downward offset in px. Apply as `translateY`. */
  offset: number;
  /** True while a finger is down — the caller drops its transition. */
  dragging: boolean;
  /**
   * Whether the pointer actually travelled during the gesture that just
   * ended. A handle that is also a button has to ask: the browser fires a
   * `click` after any press-and-release on it, including the one that ends a
   * drag that sprang back, and treating that as a tap would close the sheet
   * the user just decided not to close.
   */
  didDrag: () => boolean;
  /** Spread onto the element that starts the gesture (a handle, a header). */
  handleProps: {
    onPointerDown: (event: React.PointerEvent) => void;
    onPointerMove: (event: React.PointerEvent) => void;
    onPointerUp: (event: React.PointerEvent) => void;
    onPointerCancel: (event: React.PointerEvent) => void;
    style: { touchAction: "none" };
  };
};

export function useDragDismiss({
  onDismiss,
  threshold = 96,
  flickVelocity = 0.5,
}: DragDismissOptions): DragDismissState {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; time: number } | null>(null);
  const last = useRef<{ y: number; time: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    // Ignore secondary buttons and any pointer already captured elsewhere.
    if (event.button !== 0) return;
    // Capture keeps the gesture alive once the finger leaves the handle, which
    // it always does — the handle is moving away underneath it. Guarded
    // because it is optional in jsdom and absent on a few older engines, and
    // the drag still works without it as long as the finger stays put.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const now = { y: event.clientY, time: event.timeStamp };
    start.current = now;
    last.current = now;
    moved.current = false;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!start.current) return;
    const delta = event.clientY - start.current.y;
    if (Math.abs(delta) > TAP_SLOP) moved.current = true;
    last.current = { y: event.clientY, time: event.timeStamp };
    // Upward travel is damped rather than blocked: the sheet gives slightly,
    // which reads as "this only goes down" instead of as an unresponsive
    // surface.
    setOffset(delta >= 0 ? delta : delta / 6);
  }, []);

  const finish = useCallback(
    (event: React.PointerEvent) => {
      if (!start.current) return;
      const from = start.current;
      const previous = last.current ?? from;
      start.current = null;
      last.current = null;
      setDragging(false);

      const distance = event.clientY - from.y;
      const elapsed = Math.max(1, previous.time - from.time);
      const velocity = distance / elapsed;

      if (distance > threshold || (distance > 24 && velocity > flickVelocity)) {
        // Leave the offset where the finger left it: the sheet unmounts on the
        // same frame, and resetting it first makes it jump back up before it
        // disappears.
        onDismiss();
        return;
      }
      setOffset(0);
    },
    [flickVelocity, onDismiss, threshold],
  );

  const cancel = useCallback(() => {
    start.current = null;
    last.current = null;
    setDragging(false);
    setOffset(0);
  }, []);

  return {
    offset,
    dragging,
    didDrag: () => moved.current,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: cancel,
      style: { touchAction: "none" },
    },
  };
}
