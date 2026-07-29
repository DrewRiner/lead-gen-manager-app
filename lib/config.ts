// App-wide static configuration. Single source of truth for values surfaced in
// more than one place, so they're edited here and nowhere else.

/**
 * Developer credit shown in the app footer and on the login screen. Update the
 * URL here and both placements follow.
 */
export const DEVELOPER = {
  name: "Engine Evolve",
  url: "https://engineevolve.com",
} as const;

/**
 * The white-labeled platform our team uses to run forms and automations. It is
 * GoHighLevel underneath, but the team only ever sees the Engine Evolve brand —
 * guides and any platform-facing copy reference this, never "GoHighLevel"/"GHL".
 */
export const PLATFORM = {
  name: "Engine Evolve",
  url: "https://app.enginevolve.com",
} as const;
