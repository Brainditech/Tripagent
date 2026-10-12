import type { TripSummary } from "@/lib/trips";

// Pure helpers of the Profil tab: what its cards show is computed here, where it can be tested.

export type TripStats = { trips: number; destinations: number; days: number };

/**
 * The figures of the profile, over every trip of the list (the same count as the home's
 * "Mes voyages"): how many trips, to how many distinct destinations (as typed, so "Kyoto" and
 * "kyoto " are one), and for how many days in all.
 */
export function tripStats(trips: Pick<TripSummary, "destinationName" | "days">[]): TripStats {
  const destinations = new Set(trips.map((trip) => trip.destinationName.trim().toLocaleLowerCase()));
  return {
    trips: trips.length,
    destinations: destinations.size,
    days: trips.reduce((sum, trip) => sum + trip.days, 0),
  };
}

/** What the identity card needs of the Clerk user. */
export type ClerkIdentity = {
  fullName: string | null;
  email: string | null;
  imageUrl: string;
  /** True when the account has a real photo (from Google), false for Clerk's generated placeholder. */
  hasImage: boolean;
};

export type Identity = {
  /** Null for an account created with an email code: Clerk has no name for it. */
  name: string | null;
  email: string;
  /** First letter of the name, else of the email, shown instead of a missing photo. */
  initial: string;
  imageUri: string | null;
};

/** The identity card's content: the name when Clerk holds one, the photo when it is a real one. */
export function profileIdentity(user: ClerkIdentity | null): Identity {
  const name = user?.fullName?.trim() || null;
  const email = user?.email ?? "";
  return {
    name,
    email,
    initial: (name ?? email).charAt(0).toUpperCase() || "?",
    imageUri: user?.hasImage ? user.imageUrl : null,
  };
}

// Languages named in themselves, for the read-only "Langue" row; any other tag is shown as is.
const LANGUAGES: Record<string, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
};

/** "Français" for `fr-FR`, "English" for `en`; the tag itself when its language has no name here. */
export function localeLabel(tag: string): string {
  const language = tag.split(/[-_]/, 1)[0].toLowerCase();
  return LANGUAGES[language] ?? tag;
}

/** The device's language tag (`fr-FR`), as Hermes resolves it; French when it cannot say. */
export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return "fr";
  }
}
