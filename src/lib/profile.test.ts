import { describe, expect, it } from "vitest";

import { localeLabel, profileIdentity, tripStats } from "@/lib/profile";

describe("tripStats", () => {
  it("is all zeros without a trip", () => {
    expect(tripStats([])).toEqual({ trips: 0, destinations: 0, days: 0 });
  });

  it("counts the trips, the distinct destinations as typed, and the days in all", () => {
    const stats = tripStats([
      { destinationName: "Kyoto, Japon", days: 4 },
      { destinationName: "kyoto, japon ", days: 3 },
      { destinationName: "Lisbonne", days: 2 },
    ]);
    expect(stats).toEqual({ trips: 3, destinations: 2, days: 9 });
  });
});

describe("profileIdentity", () => {
  it("shows a Google account with its name, its initial and its photo", () => {
    const identity = profileIdentity({
      fullName: "Ana Lima",
      email: "ana@example.com",
      imageUrl: "https://img.clerk.com/ana",
      hasImage: true,
    });
    expect(identity).toEqual({ name: "Ana Lima", email: "ana@example.com", initial: "A", imageUri: "https://img.clerk.com/ana" });
  });

  it("falls back to the email's initial and no photo for an email-code account", () => {
    const identity = profileIdentity({
      fullName: null,
      email: "ben@example.com",
      imageUrl: "https://img.clerk.com/generated",
      hasImage: false,
    });
    expect(identity).toEqual({ name: null, email: "ben@example.com", initial: "B", imageUri: null });
  });

  it("treats a blank name as none and has something to show without a user", () => {
    expect(profileIdentity({ fullName: "  ", email: "c@example.com", imageUrl: "", hasImage: false }).name).toBeNull();
    expect(profileIdentity(null)).toEqual({ name: null, email: "", initial: "?", imageUri: null });
  });
});

describe("localeLabel", () => {
  it("names the language of a tag, or shows the tag when it has no name", () => {
    expect(localeLabel("fr-FR")).toBe("Français");
    expect(localeLabel("en")).toBe("English");
    expect(localeLabel("pt_BR")).toBe("Português");
    expect(localeLabel("ja-JP")).toBe("ja-JP");
  });
});
