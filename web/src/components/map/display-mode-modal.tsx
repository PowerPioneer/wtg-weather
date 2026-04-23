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
};

export function DisplayModeModal({
  open,
  onOpenChange,
  activeId,
  onChange,
  isPremium,
  onUpgradeClick,
}: DisplayModeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] p-0">
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
