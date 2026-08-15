/**
 * Starring a country or region.
 *
 * The rule this pins is "anonymous users get the sign-in prompt, not a silent
 * no-op". A star that appears to work and does nothing is the worst outcome
 * available: the visitor believes the place is saved and finds an empty
 * account later.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, type FavouriteRecord } from "@/lib/api-client";
import { invalidateFavourites } from "@/hooks/use-favourite";

import { FavouriteButton } from "./favourite-button";

const listFavourites = vi.fn();
const createFavourite = vi.fn();
const deleteFavourite = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    listFavourites: (...args: unknown[]) => listFavourites(...args),
    createFavourite: (...args: unknown[]) => createFavourite(...args),
    deleteFavourite: (...args: unknown[]) => deleteFavourite(...args),
  };
});

const PERU: FavouriteRecord = { id: "f1", countryIso2: "PE", regionCode: null };
const CUSCO: FavouriteRecord = { id: "f2", countryIso2: "PE", regionCode: "PER-1" };

beforeEach(() => {
  invalidateFavourites();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("FavouriteButton", () => {
  it("offers sign-in rather than a dead button to anonymous visitors", async () => {
    listFavourites.mockRejectedValue(new ApiError(401, "/favourites"));
    render(<FavouriteButton countryIso2="PE" name="Peru" />);

    const link = await screen.findByTestId("favourite-signin");
    expect(link).toHaveAttribute("href", "/login");
    expect(link).toHaveTextContent("Sign in to save");
    expect(screen.queryByTestId("favourite-toggle")).not.toBeInTheDocument();
  });

  it("shows an already-saved country as saved", async () => {
    listFavourites.mockResolvedValue([PERU]);
    render(<FavouriteButton countryIso2="PE" name="Peru" />);

    await waitFor(() =>
      expect(screen.getByTestId("favourite-toggle")).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByLabelText("Remove Peru from favourites")).toBeInTheDocument();
  });

  it("does not claim a country is unsaved before the list arrives", async () => {
    // A hollow star rendered optimistically is a claim we cannot back.
    let resolve: (rows: FavouriteRecord[]) => void = () => {};
    listFavourites.mockReturnValue(new Promise<FavouriteRecord[]>((r) => (resolve = r)));
    render(<FavouriteButton countryIso2="PE" name="Peru" />);

    expect(screen.getByTestId("favourite-toggle")).toBeDisabled();
    resolve([]);
    await waitFor(() => expect(screen.getByTestId("favourite-toggle")).toBeEnabled());
  });

  it("distinguishes a region from its country", async () => {
    // Peru is saved; Cusco is not. Matching on country alone would show both.
    listFavourites.mockResolvedValue([PERU]);
    render(<FavouriteButton countryIso2="PE" regionCode="PER-1" name="Cusco" />);

    await waitFor(() =>
      expect(screen.getByTestId("favourite-toggle")).toHaveAttribute("aria-pressed", "false"),
    );
  });

  it("saves a region against its polygon code", async () => {
    listFavourites.mockResolvedValueOnce([]).mockResolvedValueOnce([CUSCO]);
    createFavourite.mockResolvedValue(CUSCO);
    render(<FavouriteButton countryIso2="PE" regionCode="PER-1" name="Cusco" />);

    await waitFor(() => expect(screen.getByTestId("favourite-toggle")).toBeEnabled());
    await userEvent.click(screen.getByTestId("favourite-toggle"));

    expect(createFavourite).toHaveBeenCalledWith({
      countryIso2: "PE",
      regionCode: "PER-1",
    });
    await waitFor(() =>
      expect(screen.getByTestId("favourite-toggle")).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("un-saves by deleting the row it found, not by guessing an id", async () => {
    listFavourites.mockResolvedValueOnce([PERU]).mockResolvedValueOnce([]);
    deleteFavourite.mockResolvedValue(undefined);
    render(<FavouriteButton countryIso2="PE" name="Peru" />);

    await waitFor(() => expect(screen.getByTestId("favourite-toggle")).toBeEnabled());
    await userEvent.click(screen.getByTestId("favourite-toggle"));

    expect(deleteFavourite).toHaveBeenCalledWith("f1");
    await waitFor(() =>
      expect(screen.getByTestId("favourite-toggle")).toHaveAttribute("aria-pressed", "false"),
    );
  });

  it("rolls back and says so when the save fails", async () => {
    listFavourites.mockResolvedValue([]);
    createFavourite.mockRejectedValue(new ApiError(500, "/favourites"));
    render(<FavouriteButton countryIso2="PE" name="Peru" />);

    await waitFor(() => expect(screen.getByTestId("favourite-toggle")).toBeEnabled());
    await userEvent.click(screen.getByTestId("favourite-toggle"));

    expect(await screen.findByText("Couldn't save that. Try again.")).toBeInTheDocument();
    expect(screen.getByTestId("favourite-toggle")).toHaveAttribute("aria-pressed", "false");
  });

  it("falls back to the sign-in prompt if the session expires mid-session", async () => {
    listFavourites.mockResolvedValue([]);
    createFavourite.mockRejectedValue(new ApiError(401, "/favourites"));
    render(<FavouriteButton countryIso2="PE" name="Peru" />);

    await waitFor(() => expect(screen.getByTestId("favourite-toggle")).toBeEnabled());
    await userEvent.click(screen.getByTestId("favourite-toggle"));

    expect(await screen.findByTestId("favourite-signin")).toBeInTheDocument();
  });

  it("fetches the list once for several buttons on one page", async () => {
    // The map's panel mounts a fresh button on every polygon click; without
    // the shared cache that is a request per click.
    listFavourites.mockResolvedValue([PERU]);
    render(
      <>
        <FavouriteButton countryIso2="PE" name="Peru" />
        <FavouriteButton countryIso2="PE" regionCode="PER-1" name="Cusco" />
      </>,
    );

    await waitFor(() => expect(screen.getAllByTestId("favourite-toggle")).toHaveLength(2));
    expect(listFavourites).toHaveBeenCalledTimes(1);
  });
});
