"use client";

/**
 * Mobile wrapper around `PreferencesPanel`. Slides up from the bottom so the
 * sliders sit within thumb reach; on desktop the same panel is a popout card
 * anchored to the map's control cluster.
 */

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { WeatherPreferences } from "@/lib/scoring";
import type { UnitSystem } from "@/lib/units";

import type { PremiumFeature } from "./inline-upgrade-popover";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl p-0">
        <div className="flex items-center justify-center border-b border-border px-4 pb-3 pt-2">
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>
        <div className="px-5 pb-1 pt-3">
          <SheetTitle className="text-[17px]">Your preferences</SheetTitle>
          <SheetDescription className="mt-0.5 text-[12px]">
            The map recolours as you change these
          </SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-3">
          <PreferencesPanel
            showHeading={false}
            value={value}
            onChange={onChange}
            onUnitChange={onUnitChange}
            onReset={onReset}
            isPremium={isPremium}
            onUpgradeClick={onUpgradeClick}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
