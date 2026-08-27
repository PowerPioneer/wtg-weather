import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDragDismiss } from "./use-drag-dismiss";

afterEach(() => {
  cleanup();
});

function Sheet({ onDismiss }: { onDismiss: () => void }) {
  const drag = useDragDismiss({ onDismiss });
  return (
    <div data-testid="sheet" style={{ transform: `translateY(${drag.offset}px)` }}>
      <button
        type="button"
        data-testid="handle"
        data-dragging={drag.dragging}
        onClick={() => {
          if (!drag.didDrag()) onDismiss();
        }}
        {...drag.handleProps}
      >
        handle
      </button>
    </div>
  );
}

/** jsdom has no pointer-event constructor with coordinates; fire them by hand. */
const pointer = (
  el: Element,
  type: "pointerDown" | "pointerMove" | "pointerUp",
  clientY: number,
  timeStamp = 0,
) =>
  fireEvent[type](el, {
    button: 0,
    pointerId: 1,
    clientY,
    ...(timeStamp ? { timeStamp } : {}),
  });

describe("useDragDismiss", () => {
  it("dismisses once the drag passes the threshold", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const handle = screen.getByTestId("handle");

    pointer(handle, "pointerDown", 100);
    pointer(handle, "pointerMove", 160);
    expect(screen.getByTestId("sheet")).toHaveStyle("transform: translateY(60px)");
    expect(onDismiss).not.toHaveBeenCalled();

    pointer(handle, "pointerMove", 210);
    pointer(handle, "pointerUp", 210);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("springs back from a short slow drag, and swallows the click that ends it", async () => {
    // Two things at once. A 30px drag is under the 96px threshold, so it must
    // spring back — but only if it was *slow*: the same 30px thrown off in a
    // few milliseconds is a flick, and the velocity test is what tells them
    // apart, which is why this waits between the events rather than firing
    // them in the same tick. And the browser fires a `click` after any
    // press-and-release on a button, including the one ending a drag the user
    // decided not to complete; that click must not close the sheet.
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const handle = screen.getByTestId("handle");

    pointer(handle, "pointerDown", 100);
    await new Promise((resolve) => setTimeout(resolve, 150));
    pointer(handle, "pointerMove", 130);
    pointer(handle, "pointerUp", 130);
    fireEvent.click(handle);

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId("sheet")).toHaveStyle("transform: translateY(0px)");
  });

  it("dismisses on a short fast flick", () => {
    // Same 30px, fired in the same tick — as fast as a gesture can be. A
    // flick is a complete instruction, not an aborted drag.
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const handle = screen.getByTestId("handle");

    pointer(handle, "pointerDown", 100);
    pointer(handle, "pointerMove", 130);
    pointer(handle, "pointerUp", 130);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("still closes on a plain tap", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const handle = screen.getByTestId("handle");

    pointer(handle, "pointerDown", 100);
    pointer(handle, "pointerUp", 100);
    fireEvent.click(handle);
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("damps an upward drag instead of following it", () => {
    // The sheet rests at the bottom of the screen; there is nowhere above it
    // to drag to, and following the finger would open a gap under the sheet.
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const handle = screen.getByTestId("handle");

    pointer(handle, "pointerDown", 100);
    pointer(handle, "pointerMove", 40);
    expect(screen.getByTestId("sheet")).toHaveStyle("transform: translateY(-10px)");
    pointer(handle, "pointerUp", 40);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("abandons the gesture on pointercancel", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const handle = screen.getByTestId("handle");

    pointer(handle, "pointerDown", 100);
    pointer(handle, "pointerMove", 250);
    fireEvent.pointerCancel(handle, { pointerId: 1 });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId("sheet")).toHaveStyle("transform: translateY(0px)");
  });
});
