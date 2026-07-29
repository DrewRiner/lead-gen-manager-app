// ---------------------------------------------------------------------------
// Non-AI, additive spam scoring for FORM leads. The ONE place spam logic lives.
//
// Philosophy: additive score, never a hard block. A lead is FLAGGED as spam
// above a threshold but is ALWAYS saved and stays reviewable. Conservative
// bias — a real lead wrongly flagged is worse than spam we glance at — so
// weights are tuned so no single soft signal (and no lone medium signal) can
// cross the default threshold on its own.
//
// Pure and deterministic given its inputs: the two I/O signals (MX lookup and
// recent-submission rate counts) are injected as deps, so this scores without a
// network or database and is fully unit-testable. Real dep factories live at the
// bottom of this file and are wired in by the ingestion pipeline.
// ---------------------------------------------------------------------------

/** All tunable weights and lists in one place. */
export const SPAM_CONFIG = {
  weights: {
    // Hard signals.
    honeypot: 100, // definitive — a hidden field a human never fills
    fastSubmit: 60, // form submitted implausibly fast (bot autofill)
    noMx: 50, // email domain can't receive mail
    disposable: 40, // known throwaway email domain
    // Medium signals.
    dummyPhone: 30,
    messageUrl: 30,
    nonLatin: 25,
    fakeName: 25,
    // Soft signals (only meaningful in combination).
    repeatContact: 30, // same email/phone 3+ times in the last hour
    multiProperty: 25, // same submitter hitting 3+ properties in a short window
    allEmpty: 15, // every optional field and the message empty
    keywordPerHit: 20,
    keywordCap: 40,
  },

  /** score >= threshold => isSpam. Overridable via app_settings.spam_score_threshold. */
  defaultThreshold: 70,

  /** Submission-to-render faster than this (ms) is bot-like. */
  fastSubmitMs: 2000,

  /**
   * Honeypot field query keys. The GHL form's honeypot is configured as
   * "website"; a human leaves it empty, a bot fills it. Matched
   * case-insensitively so "Website"/"WEBSITE" (or the label) also trip it.
   */
  honeypotKeys: ["website"],

  /** Payload keys that may carry a submission-timing value (best-effort). */
  timingKeys: [
    "time_to_submit",
    "timeToSubmit",
    "elapsed_ms",
    "elapsedMs",
    "form_time",
    "formTime",
    "render_to_submit_ms",
  ],

  /** Editable list of known disposable / throwaway email domains. */
  disposableDomains: [
    "mailinator.com",
    "guerrillamail.com",
    "guerrillamail.info",
    "10minutemail.com",
    "tempmail.com",
    "temp-mail.org",
    "throwawaymail.com",
    "yopmail.com",
    "getnada.com",
    "trashmail.com",
    "sharklasers.com",
    "maildrop.cc",
    "dispostable.com",
    "fakeinbox.com",
    "mailnesia.com",
    "mohmal.com",
    "spam4.me",
    "emailondeck.com",
  ],

  /** Editable list of spammy keyword/phrases (matched case-insensitively). */
  spamKeywords: [
    "seo",
    "rank your site",
    "rank your website",
    "first page of google",
    "make money",
    "work from home",
    "crypto",
    "bitcoin",
    "forex",
    "investment opportunity",
    "backlinks",
    "guest post",
    "increase traffic",
    "web design services",
    "digital marketing services",
    "loan",
    "viagra",
  ],
} as const;

// -- Types -------------------------------------------------------------------

export interface SpamScoreInput {
  email: string | null;
  /** E.164 or raw; digits are extracted for pattern checks. */
  phone: string | null;
  name: string | null;
  message: string | null;
  ip: string | null;
  /** Raw top-level payload keys, used to detect the honeypot + timing fields. */
  rawFields?: Record<string, unknown> | null;
  /** Explicit render-to-submit time in ms, if the caller already extracted it. */
  elapsedMs?: number | null;
}

export interface SpamRateCounts {
  /** Leads with the same email or phone in the last hour (excludes this one). */
  sameContactCount: number;
  /** Distinct properties this submitter hit in a short recent window. */
  distinctProperties: number;
}

export interface SpamDeps {
  /** Resolve whether an email domain has any MX record. Cached in production. */
  lookupMx: (domain: string) => Promise<boolean>;
  /** Recent-submission counts for the rate signals. */
  rateCounts: () => Promise<SpamRateCounts>;
  /** score >= threshold => isSpam. */
  threshold: number;
}

export interface SpamResult {
  score: number;
  /** Human-readable signals that fired, e.g. "no MX record". */
  signals: string[];
  isSpam: boolean;
}

// -- Pure signal detectors (exported for focused tests) ----------------------

const DIGITS = /\d/g;

/** Digits only, reduced to the last 10 (US local number) when longer. */
function phoneDigits(phone: string | null): string {
  const d = (phone ?? "").match(DIGITS)?.join("") ?? "";
  return d.length > 10 ? d.slice(-10) : d;
}

const KNOWN_DUMMY_PHONES = new Set(["1234567890", "0123456789"]);

export function isDummyPhone(phone: string | null): boolean {
  const d = phoneDigits(phone);
  if (d.length < 7) return false;
  if (KNOWN_DUMMY_PHONES.has(d)) return true;
  // All the same digit (5555555555, 0000000000, ...).
  if (new Set(d).size === 1) return true;
  // Strictly sequential ascending or descending.
  let asc = true;
  let desc = true;
  for (let i = 1; i < d.length; i++) {
    const diff = d.charCodeAt(i) - d.charCodeAt(i - 1);
    if (diff !== 1) asc = false;
    if (diff !== -1) desc = false;
  }
  return asc || desc;
}

const URL_RE = /(https?:\/\/|www\.)/i;
export function hasUrl(message: string | null): boolean {
  return !!message && URL_RE.test(message);
}

// Cyrillic, Greek, CJK (Han), Hiragana, Katakana, Hangul, Arabic, Hebrew.
const NON_LATIN_RE =
  /[Ѐ-ӿͰ-Ͽ一-鿿぀-ゟ゠-ヿ가-힯؀-ۿ֐-׿]/;
export function hasNonLatinScript(message: string | null): boolean {
  return !!message && NON_LATIN_RE.test(message);
}

export function isFakeName(name: string | null): boolean {
  const n = (name ?? "").trim().toLowerCase();
  if (n.length === 0) return false;
  const collapsed = n.replace(/\s+/g, " ");
  if (collapsed.length === 1) return true; // single char
  if (/^(.)\1+$/.test(n.replace(/\s+/g, ""))) return true; // all one char (e.g. "aaaa")
  const FAKE = new Set(["asdf", "asdfasdf", "test", "test test", "testtest", "qwerty", "qwe", "aaa", "abc", "xxx", "na", "n/a"]);
  return FAKE.has(collapsed);
}

/** Domain part of an email (lowercased), or null. */
export function emailDomain(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const d = email.slice(at + 1).trim().toLowerCase();
  return d.length > 0 ? d : null;
}

/** Count distinct spam-keyword hits in a message. */
export function keywordHits(message: string | null): string[] {
  if (!message) return [];
  const lower = message.toLowerCase();
  return SPAM_CONFIG.spamKeywords.filter((k) => lower.includes(k));
}

/** Non-empty honeypot value found among the raw payload keys, if any. */
function honeypotTripped(rawFields: Record<string, unknown> | null | undefined): boolean {
  if (!rawFields) return false;
  const keys = SPAM_CONFIG.honeypotKeys.map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(rawFields)) {
    if (!keys.includes(k.toLowerCase())) continue;
    if (typeof v === "string" && v.trim().length > 0) return true;
    if (typeof v === "number") return true;
  }
  return false;
}

/** Best-effort render-to-submit ms from an explicit value or the raw payload. */
function elapsedMsOf(input: SpamScoreInput): number | null {
  if (typeof input.elapsedMs === "number" && Number.isFinite(input.elapsedMs)) {
    return input.elapsedMs;
  }
  const raw = input.rawFields;
  if (!raw) return null;
  const keys = SPAM_CONFIG.timingKeys.map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(raw)) {
    if (!keys.includes(k.toLowerCase())) continue;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) continue;
    // Heuristic units: a key mentioning seconds, or a small value, is seconds.
    const secondsHint = /sec|_s$|time$/.test(k.toLowerCase()) && !/ms/.test(k.toLowerCase());
    return secondsHint || n < 100 ? n * 1000 : n;
  }
  return null;
}

// -- The scorer --------------------------------------------------------------

/**
 * Score a form lead for spam. Additive; higher = more spammy. Records a
 * human-readable signal for each rule that fires.
 */
export async function scoreFormLead(
  input: SpamScoreInput,
  deps: SpamDeps,
): Promise<SpamResult> {
  const w = SPAM_CONFIG.weights;
  let score = 0;
  const signals: string[] = [];
  const add = (points: number, label: string) => {
    score += points;
    signals.push(label);
  };

  // -- Hard signals ---------------------------------------------------------
  if (honeypotTripped(input.rawFields)) add(w.honeypot, "honeypot field filled");

  const elapsed = elapsedMsOf(input);
  if (elapsed != null && elapsed < SPAM_CONFIG.fastSubmitMs) {
    add(w.fastSubmit, "submitted in under 2s");
  }

  const domain = emailDomain(input.email);
  if (domain) {
    if ((SPAM_CONFIG.disposableDomains as readonly string[]).includes(domain)) {
      add(w.disposable, "disposable email");
    }
    // Only worth a real MX lookup when the domain isn't already flagged.
    const hasMx = await deps.lookupMx(domain);
    if (!hasMx) add(w.noMx, "no MX record");
  }

  // -- Medium signals -------------------------------------------------------
  if (isDummyPhone(input.phone)) add(w.dummyPhone, "dummy phone number");
  if (hasUrl(input.message)) add(w.messageUrl, "link in message");
  if (hasNonLatinScript(input.message)) add(w.nonLatin, "non-Latin script in message");
  if (isFakeName(input.name)) add(w.fakeName, "fake-looking name");

  // -- Soft signals (only meaningful in combination) ------------------------
  const rate = await deps.rateCounts();
  if (rate.sameContactCount >= 3) add(w.repeatContact, "repeat submitter (3+ in 1h)");
  if (rate.distinctProperties >= 3) add(w.multiProperty, "hit 3+ properties");

  const emptyName = !input.name || input.name.trim().length === 0;
  const emptyPhone = !input.phone || input.phone.trim().length === 0;
  const emptyEmail = !input.email || input.email.trim().length === 0;
  const emptyMessage = !input.message || input.message.trim().length === 0;
  if (emptyName && emptyPhone && emptyEmail && emptyMessage) {
    add(w.allEmpty, "all fields empty");
  }

  const hits = keywordHits(input.message);
  if (hits.length > 0) {
    const pts = Math.min(hits.length * w.keywordPerHit, w.keywordCap);
    add(pts, `spam keywords (${hits.join(", ")})`);
  }

  return { score, signals, isSpam: score >= deps.threshold };
}

/** Compose the billable_reason for a flagged lead, e.g. "Spam: no MX record, dummy phone number". */
export function spamReason(result: SpamResult): string {
  return `Spam: ${result.signals.join(", ")}`;
}
