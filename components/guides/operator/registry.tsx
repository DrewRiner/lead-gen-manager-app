import type { ReactNode } from "react";

import { ChangeNotificationDesigned, ChangeNotificationPlain } from "./guides/change-notification";
import { ConnectCallRailDesigned, ConnectCallRailPlain } from "./guides/connect-callrail";
import { ConnectFormDesigned, ConnectFormPlain } from "./guides/connect-form";
import { ConnectTwilioDesigned, ConnectTwilioPlain } from "./guides/connect-twilio";
import { NewPropertyDesigned, NewPropertyPlain } from "./guides/new-property";
import { NoLeadsDesigned, NoLeadsPlain } from "./guides/no-leads";
import { OnboardingDesigned, OnboardingPlain } from "./guides/onboarding";
import { SwitchClientDesigned, SwitchClientPlain } from "./guides/switch-client";
import { UpdateContactDesigned, UpdateContactPlain } from "./guides/update-contact";

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
  "switch-a-property-to-a-new-client": {
    Designed: SwitchClientDesigned,
    Plain: SwitchClientPlain,
  },
  "update-a-clients-phone-or-email": {
    Designed: UpdateContactDesigned,
    Plain: UpdateContactPlain,
  },
  "connect-a-contact-form": {
    Designed: ConnectFormDesigned,
    Plain: ConnectFormPlain,
  },
  "connect-callrail-call-tracking": {
    Designed: ConnectCallRailDesigned,
    Plain: ConnectCallRailPlain,
  },
  "connect-twilio-call-tracking": {
    Designed: ConnectTwilioDesigned,
    Plain: ConnectTwilioPlain,
  },
  "change-how-a-client-gets-notified": {
    Designed: ChangeNotificationDesigned,
    Plain: ChangeNotificationPlain,
  },
  "set-up-a-new-property-to-collect-leads": {
    Designed: NewPropertyDesigned,
    Plain: NewPropertyPlain,
  },
  "client-not-getting-leads-what-to-check": {
    Designed: NoLeadsDesigned,
    Plain: NoLeadsPlain,
  },
};

export function getDesignedGuide(slug: string): DesignedGuideEntry | undefined {
  return DESIGNED_GUIDES[slug];
}
