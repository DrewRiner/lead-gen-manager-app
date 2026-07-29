// Block content shapes for guide_blocks.content (jsonb). One shape per block
// type; the editor and reader both switch on GuideBlock.type.

export type GuideBlockType = "heading" | "text" | "image" | "video" | "embed";

export interface HeadingContent {
  text: string;
  /** 2 or 3 (h1 is the guide title). */
  level: number;
}

export interface TextContent {
  /** Basic markdown: bold, links, lists. */
  markdown: string;
}

export interface ImageContent {
  url: string;
  caption?: string;
  alt?: string;
}

export interface VideoContent {
  /** Public URL of a video uploaded to the guide-media bucket. */
  url: string;
  caption?: string;
}

export interface EmbedContent {
  /** A YouTube/Loom URL; rendered as a responsive iframe. */
  url: string;
  caption?: string;
}

export type GuideBlockContent =
  | HeadingContent
  | TextContent
  | ImageContent
  | VideoContent
  | EmbedContent;

/** A default empty content object for a freshly-added block of each type. */
export function emptyBlockContent(type: GuideBlockType): GuideBlockContent {
  switch (type) {
    case "heading":
      return { text: "", level: 2 };
    case "text":
      return { markdown: "" };
    case "image":
      return { url: "", caption: "", alt: "" };
    case "video":
      return { url: "", caption: "" };
    case "embed":
      return { url: "", caption: "" };
  }
}

export const BLOCK_TYPE_LABELS: Record<GuideBlockType, string> = {
  heading: "Heading",
  text: "Text",
  image: "Image",
  video: "Video",
  embed: "Embed",
};
