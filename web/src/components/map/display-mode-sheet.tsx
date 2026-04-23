"use client";

/**
 * Mobile sheet wrapper around `DisplayModePicker`. Slides up from the bottom
 * so the whole picker is reachable one-handed.
 */

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { DisplayModeId } from "@/lib/display-modes";

import { DisplayModePicker } from "./display-mode-picker";
import type { PremiumFeature } from "./inline-upgrade-popover";

export type DisplayModeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: DisplayModeId;
  onChange: (id: DisplayModeId) => void;
  isPremium: boolean;
  onUpgradeClick?: (feature: PremiumFeature) => void;
};

export function DisplayModeSheet({
  open,
  onOpenChange,
  activeId,
  onChange,
  isPremium,
  onUpgradeClick,
}: DisplayModeSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl p-0">
        <div className="flex items-center justify-center border-b border-border px-4 pb-3 pt-2">
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>
        <div className="px-5 pb-2 pt-3">
          <SheetTitle className="text-[17px]">Display mode</SheetTitle>
          <SheetDescription className="mt-0.5 text-[12px]">
            Choose what the map shows
          </SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          <DisplayModePicker
            activeId={activeId}
            onChange={(id) => {
              onChange(id);
              onOpenChange(false);
            }}
            isPremium={isPremium}
            layout="mobile"
            onUpgradeClick={onUpgradeClick}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
