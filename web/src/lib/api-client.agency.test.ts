/**
 * Contract tests for the agency resources — orgs, invitations, clients, notes.
 *
 * Same job as `api-client.account.test.ts`: assert the *wire*. Method, path,
 * and the snake_case field names the FastAPI schemas actually declare. A
 * mismatch here is silent on both sides — each typechecks fine alone — and the
 * symptom is a blank column or a button that never works.
 *
 * The three invite conflicts get their own tests because the UI branches on
 * them: one is the upgrade path and the other two are corrections. If the API
 * reworded a detail string, the seat-cap panel would quietly become a red
 * error message, which is precisely the behaviour WS-C set out to remove.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function load() {
  return import("./api-client");
}

type Call = { url: string; init: RequestInit };

function stubFetch(responses: Array<{ body?: unknown; status?: number }>) {
  const calls: Call[] = [];
  let i = 0;
  const mock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    const next = responses[Math.min(i++, responses.length - 1)] ?? {};
    const status = next.status ?? 200;
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(next.body ?? {}), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", mock);
  return calls;
}

function body(call: Call): unknown {
  return JSON.parse(String(call.init.body));
}

const ORG_ID = "1f0c8a54-0000-4000-8000-0000000000a1";
const CLIENT_ID = "1f0c8a54-0000-4000-8000-0000000000a2";

/** `OrganizationDetail`, verbatim. */
const ORG_DETAIL = {
  id: ORG_ID,
  name: "Cordillera Travel",
  plan: "agency_starter",
  seat_cap: 3,
  seats_used: 1,
  seats_pending: 1,
};

/** `InvitationRead`, verbatim — note the absence of a token. */
const INVITATION_READ = {
  id: "1f0c8a54-0000-4000-8000-0000000000b1",
  organization_id: ORG_ID,
  email: "agent@example.com",
  role: "agent",
  expires_at: "2026-08-23T00:00:00Z",
  created_at: "2026-08-16T00:00:00Z",
};

/** `ClientRead`, verbatim. */
const CLIENT_READ = {
  id: CLIENT_ID,
  name: "Westfield",
  email: "them@example.com",
  notes: "Prefers shoulder season",
  trip_count: 2,
  created_at: "2026-03-01T00:00:00Z",
};

/** `ClientNoteRead`, verbatim. */
const NOTE_READ = {
  id: "1f0c8a54-0000-4000-8000-0000000000c1",
  body: "Called them",
  author_name: "Ada",
  author_email: "ada@example.com",
  created_at: "2026-04-03T00:00:00Z",
};

describe("organizations", () => {
  it("creates from POST /api/orgs and maps the seat fields", async () => {
    const calls = stubFetch([{ body: ORG_DETAIL, status: 201 }]);
    const { createOrg } = await load();

    expect(await createOrg("Cordillera Travel")).toEqual({
      id: ORG_ID,
      name: "Cordillera Travel",
      plan: "agency_starter",
      seatCap: 3,
      seatsUsed: 1,
      seatsPending: 1,
    });
    expect(calls[0]!.url).toBe("/api/orgs");
    expect(calls[0]!.init.method).toBe("POST");
    expect(body(calls[0]!)).toEqual({ name: "Cordillera Travel" });
  });

  it("reads an unrecognised plan as free, never as premium", async () => {
    stubFetch([{ body: { ...ORG_DETAIL, plan: "agency_platinum" } }]);
    const { getOrg } = await load();
    expect((await getOrg(ORG_ID)).plan).toBe("free");
  });
});

describe("invitations", () => {
  it("invites at POST /api/orgs/{id}/invites with email and role", async () => {
    const calls = stubFetch([{ body: INVITATION_READ, status: 201 }]);
    const { inviteAgent } = await load();

    const invite = await inviteAgent(ORG_ID, { email: "agent@example.com" });

    expect(calls[0]!.url).toBe(`/api/orgs/${ORG_ID}/invites`);
    expect(calls[0]!.init.method).toBe("POST");
    expect(body(calls[0]!)).toEqual({
      email: "agent@example.com",
      role: "agent",
    });
    expect(invite).toEqual({
      id: INVITATION_READ.id,
      email: "agent@example.com",
      role: "agent",
      expiresAt: "2026-08-23T00:00:00Z",
      invitedAt: "2026-08-16T00:00:00Z",
    });
  });

  it("never expects a token in the response", async () => {
    // The API does not return one, and nothing here should start reading a
    // field that would only exist if it did.
    stubFetch([{ body: INVITATION_READ, status: 201 }]);
    const { inviteAgent } = await load();
    const invite = await inviteAgent(ORG_ID, { email: "agent@example.com" });
    expect(JSON.stringify(invite)).not.toContain("token");
  });

  it("tells the seat cap apart from the other two conflicts", async () => {
    const { inviteAgent, isSeatCapReached, isConflict } = await load();

    stubFetch([{ status: 409, body: { detail: "seat cap reached" } }]);
    const capped = await inviteAgent(ORG_ID, { email: "a@example.com" }).catch(
      (e: unknown) => e,
    );
    expect(isSeatCapReached(capped)).toBe(true);

    for (const detail of ["already a member", "invitation already pending"]) {
      stubFetch([{ status: 409, body: { detail } }]);
      const err = await inviteAgent(ORG_ID, { email: "a@example.com" }).catch(
        (e: unknown) => e,
      );
      expect(isConflict(err)).toBe(true);
      expect(isSeatCapReached(err)).toBe(false);
    }
  });

  it("revokes at DELETE /api/orgs/{id}/invites/{invite}", async () => {
    const calls = stubFetch([{ status: 204 }]);
    const { revokeInvite } = await load();
    await revokeInvite(ORG_ID, "inv-1");
    expect(calls[0]!.url).toBe(`/api/orgs/${ORG_ID}/invites/inv-1`);
    expect(calls[0]!.init.method).toBe("DELETE");
  });

  it("removes a member at DELETE /api/orgs/{id}/memberships/{membership}", async () => {
    const calls = stubFetch([{ status: 204 }]);
    const { removeMember } = await load();
    await removeMember(ORG_ID, "mem-1");
    expect(calls[0]!.url).toBe(`/api/orgs/${ORG_ID}/memberships/mem-1`);
    expect(calls[0]!.init.method).toBe("DELETE");
  });

  it("accepts at POST /api/invites/accept, carrying the token in the body", async () => {
    const calls = stubFetch([
      {
        body: {
          organization_id: ORG_ID,
          organization_name: "Cordillera Travel",
          role: "agent",
        },
      },
    ]);
    const { acceptInvite } = await load();

    expect(await acceptInvite("tok.en.value")).toEqual({
      organizationId: ORG_ID,
      organizationName: "Cordillera Travel",
      role: "agent",
    });
    expect(calls[0]!.url).toBe("/api/invites/accept");
    expect(body(calls[0]!)).toEqual({ token: "tok.en.value" });
    // A cookie comes back on this call; it must be a same-origin request or
    // the browser will not keep it.
    expect(calls[0]!.init.credentials).toBe("same-origin");
  });
});

describe("clients", () => {
  it("lists from GET /api/orgs/{id}/clients with the trip count", async () => {
    const calls = stubFetch([{ body: [CLIENT_READ] }]);
    const { listClients } = await load();

    expect(await listClients(ORG_ID)).toEqual([
      {
        id: CLIENT_ID,
        name: "Westfield",
        email: "them@example.com",
        notes: "Prefers shoulder season",
        trips: 2,
        createdAt: "2026-03-01T00:00:00Z",
      },
    ]);
    expect(calls[0]!.url).toBe(`/api/orgs/${ORG_ID}/clients`);
  });

  it("creates with the schema's field names, sending null for blanks", async () => {
    const calls = stubFetch([{ body: CLIENT_READ, status: 201 }]);
    const { createClient } = await load();

    await createClient(ORG_ID, { name: "Westfield", email: "" });

    expect(calls[0]!.init.method).toBe("POST");
    // `EmailStr | None` refuses "", so an untouched optional field has to go
    // over as null rather than an empty string.
    expect(body(calls[0]!)).toEqual({
      name: "Westfield",
      email: null,
      notes: null,
    });
  });

  it("patches only what changed", async () => {
    const calls = stubFetch([{ body: CLIENT_READ }]);
    const { updateClient } = await load();

    await updateClient(ORG_ID, CLIENT_ID, { notes: "New note" });

    expect(calls[0]!.url).toBe(`/api/orgs/${ORG_ID}/clients/${CLIENT_ID}`);
    expect(calls[0]!.init.method).toBe("PATCH");
    expect(body(calls[0]!)).toEqual({ notes: "New note" });
  });

  it("deletes at DELETE /api/orgs/{id}/clients/{client}", async () => {
    const calls = stubFetch([{ status: 204 }]);
    const { deleteClient } = await load();
    await deleteClient(ORG_ID, CLIENT_ID);
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(calls[0]!.url).toBe(`/api/orgs/${ORG_ID}/clients/${CLIENT_ID}`);
  });

  it("adds a note and reads its attribution", async () => {
    const calls = stubFetch([{ body: NOTE_READ, status: 201 }]);
    const { addClientNote } = await load();

    expect(await addClientNote(ORG_ID, CLIENT_ID, "Called them")).toEqual({
      id: NOTE_READ.id,
      body: "Called them",
      author: "Ada",
      createdAt: "2026-04-03T00:00:00Z",
    });
    expect(calls[0]!.url).toBe(`/api/orgs/${ORG_ID}/clients/${CLIENT_ID}/notes`);
    // The author is the session, never a field the caller supplies.
    expect(body(calls[0]!)).toEqual({ body: "Called them" });
  });

  it("falls back to the author's address when they have no name", async () => {
    stubFetch([{ body: { ...NOTE_READ, author_name: null }, status: 201 }]);
    const { addClientNote } = await load();
    expect((await addClientNote(ORG_ID, CLIENT_ID, "x")).author).toBe(
      "ada@example.com",
    );
  });

  it("surfaces 404 as not-found so a stale client id is not an error page", async () => {
    stubFetch([{ status: 404, body: { detail: "client not found" } }]);
    const { listClients, isNotFound } = await load();
    const err = await listClients(ORG_ID).catch((e: unknown) => e);
    expect(isNotFound(err)).toBe(true);
  });
});
