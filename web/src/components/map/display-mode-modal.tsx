"use client";

/**
 * Desktop modal wrapper around `DisplayModePicker`. On small viewports we
 * render `DisplayModeSheet` instead; the choice is made by the caller.
 */

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { DisplayModeId } from "@/lib/display-modes";

import { DisplayModePicker } from "./display-mode-picker";
import type { PremiumFeature } from "./inline-upgrade-popover";

export type DisplayModeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: DisplayModeId;
  onChange: (id: DisplayModeId) => void;
  isPremium: boolean;
  onUpgradeClick?: (feature: PremiumFeature) => void;
  /**
   * Opened by the map's first-visit guide, whose bubble sits beside the
   * dialog. A modal dialog would trap focus away from that bubble, mark it
   * `aria-hidden` and dismiss itself when the bubble is clicked, so for the
   * length of that step it is non-modal and ignores outside presses. The
   * guide's own dimming stands in for the overlay.
   */
  inTour?: boolean;
};

export function DisplayModeModal({
  open,
  onOpenChange,
  activeId,
  onChange,
  isPremium,
  onUpgradeClick,
  inTour = false,
}: DisplayModeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={!inTour}>
      <DialogContent
        className="max-w-[640px] p-0"
        // Half the guide's bubble (320px + 14px gap) to the left, so the dialog
        // and the bubble beside it fit side by side from ~1000px wide rather
        // than the bubble landing on the tiles it describes. Inline so it beats
        // `left-1/2` without depending on utility order.
        style={inTour ? { left: "calc(50% - 167px)" } : undefined}
        data-tour="display-panel"
        onOpenAutoFocus={inTour ? (event) => event.preventDefault() : undefined}
        onInteractOutside={inTour ? (event) => event.preventDefault() : undefined}
      >
        <div className="border-b border-border px-6 py-4">
          <DialogTitle className="text-[18px]">Display mode</DialogTitle>
          <DialogDescription className="mt-0.5 text-[12.5px]">
            Choose what the map shows
          </DialogDescription>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <DisplayModePicker
            activeId={activeId}
            onChange={(id) => {
              onChange(id);
              onOpenChange(false);
            }}
            isPremium={isPremium}
            layout="desktop"
            onUpgradeClick={onUpgradeClick}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
