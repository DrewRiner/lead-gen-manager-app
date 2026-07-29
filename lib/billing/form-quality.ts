// ---------------------------------------------------------------------------
// Pure form-lead qualification: is there usable contact info, and does the
// submission look like an obvious test/junk entry? This is FORM logic only and
// never touches call/duration rules. Patterns live in one editable config so
// they're easy to tune. Low-quality requires TWO signals, not one, so a single
// coincidence never blocks a real lead.
// ---------------------------------------------------------------------------

export const FORM_QUALITY_CONFIG = {
  /** Exact (lowercased, whitespace-collapsed) names that are obviously junk. */
  junkNames: [
    "test",
    "test test",
    "testtest",
    "testing",
    "asdf",
    "asdfasdf",
    "qwerty",
    "qwe",
    "abc",
    "aaa",
    "xxx",
    "na",
    "n/a",
    "none",
    "fake",
    "demo",
    "sample",
  ],
  /** Test-email local parts (the bit before @). */
  testEmailLocalParts: [
    "test",
    "tester",
    "testing",
    "asdf",
    "a",
    "x",
    "abc",
    "xyz",
    "none",
    "na",
    "fake",
    "demo",
    "email",
    "noreply",
  ],
  /** Any local part starting with one of these is treated as a test address. */
  testEmailLocalPrefixes: ["test", "asdf", "fake", "demo"],
  /** Throwaway / placeholder email domains. */
  testEmailDomains: [
    "test.com",
    "test.test",
    "example.com",
    "example.org",
    "example.net",
    "a.com",
    "email.com",
    "fake.com",
    "demo.com",
    "sample.com",
  ],
  /** Phone numbers that are obviously placeholders. */
  knownDummyPhones: ["1234567890", "0123456789"],
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

export function hasValidEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_RE.test(email.trim());
}

export function hasValidPhone(phone: string | null | undefined): boolean {
  return !!phone && E164_RE.test(phone.trim());
}

export function isJunkName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (n.length === 0) return false;
  if (n.length === 1) return true; // single char
  if (/^(.)\1+$/.test(n.replace(/\s+/g, ""))) return true; // all one char, e.g. "aaaa"
  return (FORM_QUALITY_CONFIG.junkNames as readonly string[]).includes(n);
}

export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at <= 0) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if ((FORM_QUALITY_CONFIG.testEmailDomains as readonly string[]).includes(domain)) return true;
  if ((FORM_QUALITY_CONFIG.testEmailLocalParts as readonly string[]).includes(local)) return true;
  if (FORM_QUALITY_CONFIG.testEmailLocalPrefixes.some((p) => local.startsWith(p))) return true;
  return false;
}

export function isDummyPhone(phone: string | null | undefined): boolean {
  const digits = (phone ?? "").replace(/\D/g, "");
  const d = digits.length > 10 ? digits.slice(-10) : digits;
  if (d.length < 7) return false;
  if ((FORM_QUALITY_CONFIG.knownDummyPhones as readonly string[]).includes(d)) return true;
  if (new Set(d).size === 1) return true; // all same digit
  let asc = true;
  let desc = true;
  for (let i = 1; i < d.length; i++) {
    const diff = d.charCodeAt(i) - d.charCodeAt(i - 1);
    if (diff !== 1) asc = false;
    if (diff !== -1) desc = false;
  }
  return asc || desc;
}

export interface FormQualityInput {
  email: string | null;
  phone: string | null;
  name: string | null;
  message: string | null;
  /** True when the form carried any custom answers (an "optional fields" signal). */
  hasFormAnswers: boolean;
}

export interface FormQualityResult {
  /** A real email OR phone is present. */
  hasContact: boolean;
  /** Two or more junk signals fired. */
  lowQuality: boolean;
  signals: string[];
}

/** Classify a form submission's contact quality. Pure. */
export function classifyFormQuality(input: FormQualityInput): FormQualityResult {
  const hasContact = hasValidEmail(input.email) || hasValidPhone(input.phone);

  const signals: string[] = [];
  if (isJunkName(input.name)) signals.push("junk name");
  if (isTestEmail(input.email)) signals.push("test email");
  if (isDummyPhone(input.phone)) signals.push("dummy phone");
  const emptyMessage = !input.message || input.message.trim().length === 0;
  if (emptyMessage && !input.hasFormAnswers) signals.push("no message or details");

  return { hasContact, lowQuality: signals.length >= 2, signals };
}
