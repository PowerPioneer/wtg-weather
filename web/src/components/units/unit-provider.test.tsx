import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { UNIT_COOKIE } from "@/lib/units";

import { Temperature } from "./measure";
import { UnitProvider, resolveInitialUnit, useUnit } from "./unit-provider";
import { UnitToggle } from "./unit-toggle";

afterEach(() => {
  cleanup();
  document.cookie = `${UNIT_COOKIE}=; Path=/; Max-Age=0`;
});

describe("resolveInitialUnit", () => {
  it("lets a shared link win over what this browser last chose", () => {
    // Same precedence the weather preferences follow: a link shows what its
    // sender saw, not what the reader happens to have saved.
    expect(resolveInitialUnit("?unit=imperial", "metric")).toBe("imperial");
    expect(resolveInitialUnit("?unit=metric", "imperial")).toBe("metric");
  });

  it("falls back to the cookie, then to metric", () => {
    expect(resolveInitialUnit("", "imperial")).toBe("imperial");
    expect(resolveInitialUnit("", null)).toBe("metric");
    // Metric is also the answer for anything unparseable — it is what the
    // server rendered, so it is the only value that cannot flicker.
    expect(resolveInitialUnit("?unit=kelvin", "furlongs")).toBe("metric");
  });
});

function Readout() {
  const { unit, ready } = useUnit();
  return (
    <div>
      <span data-testid="unit">{unit}</span>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="value">
        <Temperature value={20} />
      </span>
    </div>
  );
}

describe("UnitProvider", () => {
  it("starts metric — what the server rendered — and reports when it has read the browser", async () => {
    render(
      <UnitProvider>
        <Readout />
      </UnitProvider>,
    );
    expect(screen.getByTestId("unit")).toHaveTextContent("metric");
    expect(screen.getByTestId("value")).toHaveTextContent("20°C");
    await waitFor(() =>
      expect(screen.getByTestId("ready")).toHaveTextContent("true"),
    );
  });

  it("picks up an existing cookie", async () => {
    document.cookie = `${UNIT_COOKIE}=imperial; Path=/`;
    render(
      <UnitProvider>
        <Readout />
      </UnitProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("unit")).toHaveTextContent("imperial"),
    );
    expect(screen.getByTestId("value")).toHaveTextContent("68°F");
  });

  it("stores the choice so the next page agrees with this one", async () => {
    render(
      <UnitProvider>
        <UnitToggle />
        <Readout />
      </UnitProvider>,
    );
    await userEvent.click(screen.getByTestId("unit-imperial"));
    expect(screen.getByTestId("value")).toHaveTextContent("68°F");
    // Readable, not HttpOnly, on purpose: a statically generated country page
    // has to read it from client JS. See `lib/units.ts`.
    expect(document.cookie).toContain(`${UNIT_COOKIE}=imperial`);
  });

  it("answers metric outside a provider rather than throwing", () => {
    // Lets a component be dropped into a test or a fixture without one, and
    // matches what the server would have rendered.
    render(<Readout />);
    expect(screen.getByTestId("unit")).toHaveTextContent("metric");
  });
});
