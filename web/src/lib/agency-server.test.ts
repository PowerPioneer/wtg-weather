/**
 * The agency fixtures' opt-in gate.
 *
 * The failure this pins is a reachability bug, not a rendering one:
 * `/account/clients/[id]` resolved its client from the URL through
 * `findClientRecord`, with no `WTG_USE_MOCK_DATA` check and no org scoping, so
 * a fixture client's name, email, phone and notes were served to any
 * agency-entitled user in production. The assertion that matters is the first
 * one — a known-good fixture id resolving to `null` with the flag off.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

/** A real fixture id, so a passing test cannot be a typo resolving to null. */
const FIXTURE_CLIENT_ID = "cli_westfield_8421";
const FIXTURE_ORG_ID = "org_cordillera";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

async function load(flag: string | undefined) {
  vi.resetModules();
  if (flag === undefined) vi.stubEnv("WTG_USE_MOCK_DATA", "");
  else vi.stubEnv("WTG_USE_MOCK_DATA", flag);
  return import("./agency-server");
}

describe("with WTG_USE_MOCK_DATA off", () => {
  it("does not serve a fixture client to a caller who guesses its id", async () => {
    const { getClientRecord } = await load(undefined);
    await expect(getClientRecord(FIXTURE_CLIENT_ID)).resolves.toBeNull();
  });

  it("has no reachable client record at all", async () => {
    const { getClientRecord } = await load(undefined);
    for (const id of [FIXTURE_CLIENT_ID, "cli_hartwell", "cli_okafor", "anything"]) {
      await expect(getClientRecord(id)).resolves.toBeNull();
    }
  });

  it("gives the fixture org an empty dashboard rather than the fixture's", async () => {
    const { getAgencyAccount } = await load(undefined);
    const account = await getAgencyAccount(FIXTURE_ORG_ID);
    expect(account.clients).toEqual([]);
    expect(account.team).toEqual([]);
    expect(account.activity).toEqual([]);
  });

  // "1" is the only value that enables it — not "true", not "0", not any
  // truthy string. Same rule as `env.ts`, restated where it is relied on.
  it.each(["0", "true", "yes", ""])("treats %o as off", async (value) => {
    const { getClientRecord } = await load(value);
    await expect(getClientRecord(FIXTURE_CLIENT_ID)).resolves.toBeNull();
  });
});

describe("with WTG_USE_MOCK_DATA=1", () => {
  it("still resolves the fixture client, so API-less dev keeps working", async () => {
    const { getClientRecord } = await load("1");
    const client = await getClientRecord(FIXTURE_CLIENT_ID);
    expect(client).not.toBeNull();
    expect(client?.id).toBe(FIXTURE_CLIENT_ID);
  });

  it("still resolves the fixture org's dashboard", async () => {
    const { getAgencyAccount } = await load("1");
    const account = await getAgencyAccount(FIXTURE_ORG_ID);
    expect(account.clients.length).toBeGreaterThan(0);
    expect(account.team.length).toBeGreaterThan(0);
  });

  it("gives an unknown org an empty dashboard, not someone else's", async () => {
    const { getAgencyAccount } = await load("1");
    const account = await getAgencyAccount("org_not_a_fixture");
    expect(account.clients).toEqual([]);
    expect(account.team).toEqual([]);
  });

  it("returns null for an id no fixture defines", async () => {
    const { getClientRecord } = await load("1");
    await expect(getClientRecord("cli_not_a_fixture")).resolves.toBeNull();
  });
});
