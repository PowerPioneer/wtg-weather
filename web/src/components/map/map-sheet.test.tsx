import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MapSheet } from "./map-sheet";

/** jsdom has no pointer-event constructor with coordinates; fire them by hand. */
const pointer = (
  el: Element,
  type: "pointerDown" | "pointerMove" | "pointerUp",
  clientY: number,
) => fireEvent[type](el, { button: 0, pointerId: 1, clientY });

function open(onOpenChange = vi.fn()) {
  render(
    <MapSheet
      open
      onOpenChange={onOpenChange}
      title="Display mode"
      description="Choose what the map shows"
    >
      <p>body</p>
    </MapSheet>,
  );
  return onOpenChange;
}

/**
 * Both map sheets shipped with no way out. The grabber was a decorative
 * `<span aria-hidden>`, there was no close button, and `max-h-[85vh]` measured
 * the large viewport — so on a phone the sheet was taller than the screen and
 * there was no overlay left to press either. Reloading the page was the only
 * escape. These pin each of the three ways out.
 */
describe("MapSheet — the ways out", () => {
  it("closes on the × button", async () => {
    const onOpenChange = open();
    await userEvent.click(screen.getByTestId("map-sheet-close"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on a tap of the grabber", async () => {
    const onOpenChange = open();
    await userEvent.click(screen.getByTestId("map-sheet-handle"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on a drag down past the threshold", () => {
    const onOpenChange = open();
    const handle = screen.getByTestId("map-sheet-handle");

    pointer(handle, "pointerDown", 100);
    pointer(handle, "pointerMove", 260);
    pointer(handle, "pointerUp", 260);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open when a short drag springs back", () => {
    const onOpenChange = open();
    const handle = screen.getByTestId("map-sheet-handle");

    // Under the threshold, then released: the sheet returns to rest. The
    // browser still fires a click on the handle afterwards, and treating that
    // as a tap would close the sheet the user just decided to keep.
    pointer(handle, "pointerDown", 100);
    pointer(handle, "pointerMove", 118);
    pointer(handle, "pointerUp", 118);
    fireEvent.click(handle);

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("gives the grabber and the × accessible names", () => {
    open();
    // The grabber is a real control, not a decoration — reachable by keyboard
    // and announced, so the affordance is not touch-only.
    expect(screen.getByTestId("map-sheet-handle")).toHaveAccessibleName(
      /close/i,
    );
    expect(screen.getByTestId("map-sheet-close")).toHaveAccessibleName(/close/i);
  });

  it("caps its height against the dynamic viewport, not the large one", () => {
    open();
    // `85vh` is the height with the phone's toolbar hidden, so a sheet sized
    // to it runs off the bottom of the screen and takes its own controls with
    // it. This is the assertion that would have caught that.
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("max-h-[85dvh]");
    expect(panel.className).not.toContain("85vh]");
  });
});
