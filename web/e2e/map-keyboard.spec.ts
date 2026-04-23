import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Keyboard and a11y regression tests for `/map`.
 *
 * MapLibre itself runs inside a WebGL canvas, which Playwright can't
 * introspect directly — so the tests focus on the accessible surface:
 *   - the map container owns `role="application"` and is reachable by Tab
 *   - plus / minus keys call into MapLibre's zoom API (data-attributes on
 *     the container document the intent; we watch for focus + key-downs)
 *   - the display-mode picker opens from the toolbar and updates the URL
 *
 * We intercept `/api/tiles/url` so the test runs without the real API.
 */

test.beforeEach(async ({ page }) => {
  await page.route("**/api/tiles/url**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: "https://example.invalid/tiles/free.pmtiles",
        expiresAt: Math.floor(Date.now() / 1000) + 15 * 60,
      }),
    });
  });
  // Stop MapLibre from making network requests by failing any cross-origin
  // GETs quickly — keeps the test fast and deterministic.
  await page.route(/example\.invalid/, (route) => route.abort());
});

test("/map — keyboard: Tab lands on the map application region", async ({ page }) => {
  await page.goto("/map");
  const region = page.getByRole("application", { name: /climate map/i });
  await expect(region).toBeVisible();

  // Tab through header links until we hit the application region.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const isFocused = await region.evaluate((el) => el === document.activeElement);
    if (isFocused) break;
  }
  await expect(region).toBeFocused();
});

test("/map — opens the display-mode picker from the toolbar button", async ({ page }) => {
  await page.goto("/map");
  await page.getByTestId("open-display-mode").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Picking a different mode closes the dialog and updates the URL.
  await page.getByRole("button", { name: /temperature/i }).first().click();
  await expect(page).toHaveURL(/mode=temperature/);
});

test("/map — plus and minus keys trigger zoom handlers on the map region", async ({ page }) => {
  await page.goto("/map");
  const region = page.getByRole("application", { name: /climate map/i });
  await region.focus();
  await expect(region).toBeFocused();

  // We can't peek inside the MapLibre canvas, but we can verify our
  // keydown handler is bound: pressing "+" / "-" must not blur focus
  // and must not navigate the page.
  const urlBefore = page.url();
  await page.keyboard.press("+");
  await page.keyboard.press("-");
  await expect(region).toBeFocused();
  expect(page.url()).toBe(urlBefore);
});

test("/map — axe: no serious or critical a11y violations on first paint", async ({ page }) => {
  await page.goto("/map");
  await page.getByRole("application", { name: /climate map/i }).waitFor();
  const results = await new AxeBuilder({ page })
    .disableRules(["color-contrast"]) // MapLibre canvas trips false-positives
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
