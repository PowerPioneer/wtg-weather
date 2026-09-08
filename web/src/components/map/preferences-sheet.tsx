"use client";

/**
 * Mobile wrapper around `PreferencesPanel`. Slides up from the bottom so the
 * sliders sit within thumb reach; on desktop the same panel is a popout card
 * anchored to the map's control cluster.
 */

import type { WeatherPreferences } from "@/lib/scoring";
import type { UnitSystem } from "@/lib/units";

import type { PremiumFeature } from "./inline-upgrade-popover";
import { MapSheet } from "./map-sheet";
import { PreferencesPanel } from "./preferences-panel";

export type PreferencesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: WeatherPreferences;
  onChange: (next: WeatherPreferences) => void;
  onUnitChange?: (next: UnitSystem) => void;
  onReset: () => void;
  isPremium: boolean;
  onUpgradeClick?: (feature: PremiumFeature) => void;
};

export function PreferencesSheet({
  open,
  onOpenChange,
  value,
  onChange,
  onUnitChange,
  onReset,
  isPremium,
  onUpgradeClick,
}: PreferencesSheetProps) {
  return (
    <MapSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Your preferences"
      description="The map recolours as you change these"
    >
      <PreferencesPanel
        showHeading={false}
        value={value}
        onChange={onChange}
        onUnitChange={onUnitChange}
        onReset={onReset}
        isPremium={isPremium}
        onUpgradeClick={onUpgradeClick}
      />
    </MapSheet>
  );
}
