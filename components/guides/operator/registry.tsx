import type { ReactNode } from "react";

import { OnboardingDesigned, OnboardingPlain } from "./guides/onboarding";

// Maps a guide slug to its designed + plain-text renderings. Only guides that
// have been built appear here; the reader falls back to the block reader for
// any slug not present, so the nine can be added incrementally.
export interface DesignedGuideEntry {
  Designed: (props: { initialDone: string[] }) => ReactNode;
  Plain: () => ReactNode;
}

export const DESIGNED_GUIDES: Record<string, DesignedGuideEntry> = {
  "onboard-a-new-client-to-a-property": {
    Designed: OnboardingDesigned,
    Plain: OnboardingPlain,
  },
};

export function getDesignedGuide(slug: string): DesignedGuideEntry | undefined {
  return DESIGNED_GUIDES[slug];
}
