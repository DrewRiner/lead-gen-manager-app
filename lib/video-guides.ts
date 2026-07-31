// Internal training videos for the team + VAs — setup walkthroughs (CallRail,
// Engine Evolve forms, automations). Watched in order, top to bottom.
//
// This is the whole content model: adding a sixth video is ONE object below —
// no component edits, no CMS, no DB, no uploads. Videos are UNLISTED YouTube;
// they're embedded via youtube-nocookie and the page sits behind app auth, so
// they're internal-only.

export interface VideoGuide {
  /** YouTube video id (unlisted). */
  id: string;
  title: string;
  description: string;
}

export const VIDEO_GUIDES: VideoGuide[] = [
  { id: "t2PQfc4MmEs", title: "TODO: title", description: "TODO: description" },
  { id: "3689RqQIWV8", title: "TODO: title", description: "TODO: description" },
  { id: "SzNdzZO-XOE", title: "TODO: title", description: "TODO: description" },
  { id: "ScXXwIKQ_Vk", title: "TODO: title", description: "TODO: description" },
  { id: "ugi-tCxUGN8", title: "TODO: title", description: "TODO: description" },
];
