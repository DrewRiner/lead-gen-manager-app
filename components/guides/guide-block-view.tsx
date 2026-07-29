/* eslint-disable @next/next/no-img-element */
import { embedSrc, renderMarkdown } from "@/lib/guides/render";
import type {
  EmbedContent,
  GuideBlockContent,
  GuideBlockType,
  HeadingContent,
  ImageContent,
  TextContent,
  VideoContent,
} from "@/lib/guides/types";

// Renders a single guide block for readers (and the editor's preview). Media
// uses plain <img>/<video> because the URLs are arbitrary Supabase public hosts.

export function GuideBlockView({
  type,
  content,
}: {
  type: GuideBlockType;
  content: GuideBlockContent;
}) {
  switch (type) {
    case "heading": {
      const c = content as HeadingContent;
      if (!c.text?.trim()) return null;
      return c.level === 3 ? (
        <h3 className="mt-6 text-lg font-semibold">{c.text}</h3>
      ) : (
        <h2 className="mt-8 text-xl font-semibold">{c.text}</h2>
      );
    }
    case "text": {
      const c = content as TextContent;
      if (!c.markdown?.trim()) return null;
      return <div className="text-sm text-foreground/90">{renderMarkdown(c.markdown)}</div>;
    }
    case "image": {
      const c = content as ImageContent;
      if (!c.url) return null;
      return (
        <figure className="space-y-1.5">
          <img
            src={c.url}
            alt={c.alt || c.caption || ""}
            className="max-h-[600px] w-auto max-w-full rounded-md border"
          />
          {c.caption ? (
            <figcaption className="text-xs text-muted-foreground">{c.caption}</figcaption>
          ) : null}
        </figure>
      );
    }
    case "video": {
      const c = content as VideoContent;
      if (!c.url) return null;
      return (
        <figure className="space-y-1.5">
          <video
            src={c.url}
            controls
            className="w-full max-w-2xl rounded-md border"
          />
          {c.caption ? (
            <figcaption className="text-xs text-muted-foreground">{c.caption}</figcaption>
          ) : null}
        </figure>
      );
    }
    case "embed": {
      const c = content as EmbedContent;
      if (!c.url) return null;
      const src = embedSrc(c.url);
      return (
        <figure className="space-y-1.5">
          {src ? (
            <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-md border">
              <iframe
                src={src}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={c.caption || "Embedded video"}
              />
            </div>
          ) : (
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline"
            >
              {c.url}
            </a>
          )}
          {c.caption ? (
            <figcaption className="text-xs text-muted-foreground">{c.caption}</figcaption>
          ) : null}
        </figure>
      );
    }
    default:
      return null;
  }
}
