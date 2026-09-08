"use client";

/**
 * Mobile sheet wrapper around `DisplayModePicker`. Slides up from the bottom
 * so the whole picker is reachable one-handed.
 */

import type { DisplayModeId } from "@/lib/display-modes";

import { DisplayModePicker } from "./display-mode-picker";
import type { PremiumFeature } from "./inline-upgrade-popover";
import { MapSheet } from "./map-sheet";

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
    <MapSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Display mode"
      description="Choose what the map shows"
    >
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
    </MapSheet>
  );
}
