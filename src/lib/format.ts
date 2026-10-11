import { isoDateToUtc } from "@/lib/trip-rules";

// Locale-aware formatting for the screens. Hermes ships Intl on Android, but each call is
// guarded so that an unknown currency or locale degrades to a plain string instead of a crash.

/** "156 000 FCFP", "1 200 €": an amount in the given ISO 4217 currency, without decimals. */
export function formatMoney(amount: number, currency: string, locale = "fr-FR"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/** "dimanche 11 octobre" for a `YYYY-MM-DD` day, read in UTC so that no time zone shifts it. */
export function formatDay(isoDate: string, locale = "fr-FR"): string {
  const time = isoDateToUtc(isoDate);
  if (Number.isNaN(time)) return isoDate;
  try {
    return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      time,
    );
  } catch {
    return isoDate;
  }
}
