import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normalize a phone number to E.164 (+15551234567). Falls back to the trimmed
 * input when it can't be parsed, so we never lose data on odd input.
 */
export function normalizePhone(
  input: string | null | undefined,
  defaultCountry: "US" = "US",
): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  return parsed?.isValid() ? parsed.number : trimmed;
}

/** Format an E.164 number for display; returns the raw value if unparseable. */
export function formatPhone(input: string | null | undefined): string {
  if (!input) return "—";
  const parsed = parsePhoneNumberFromString(input);
  return parsed?.isValid() ? parsed.formatNational() : input;
}
